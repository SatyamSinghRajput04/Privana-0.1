# Privana API Reference

This document outlines the Vercel serverless functions available under `/api/` which use Supabase PostgreSQL as the backend.

## Authentication and Authorization

All API endpoints enforce strict tenant isolation. Authentication is handled via two mandatory HTTP headers on every request.

| Header | Type | Description |
|---|---|---|
| `x-workspace-id` | Integer | The ID of the workspace being accessed. |
| `x-session-id` | String | A unique session identifier. |

**Tenant Isolation:** The `x-session-id` is HMAC-SHA256 hashed with the service role key to derive an owner token. This ensures users can only access their own workspaces and cannot impersonate others.

## Shared Security Middleware

All endpoints are protected by a shared security middleware (`_security.js`) which enforces the following policies:

| Security Feature | Description |
|---|---|
| **CORS** | Strict Cross-Origin Resource Sharing. Only allows localhost, same-origin, and the Vercel deployment URL. |
| **Authentication** | Validates the presence and validity of session and workspace headers. |
| **Payload Size Limit** | Restricts request bodies to a maximum of **10KB**. |
| **Rate Limiting** | Enforces a sliding window limit of **60 requests per minute** per IP address. |
| **Data Privacy** | All user queries (`question` fields) are persisted using a SHA-256 HMAC hash. Raw questions are never stored in the cloud. |

---

## Endpoints

### Analytics

#### `/api/analyze`
Persists query metadata for history synchronization. **This endpoint NEVER computes analytics.** Analytics computation runs entirely locally in the browser/client.

| Method | Request Body | Success Response | Error Codes |
|---|---|---|---|
| `POST` | `{"question": "string", "dataset_id": integer}` | `200 OK`: `{"id": integer, "status": "local_only", "message": "string", "privacyStatus": object}` | 400, 401, 405, 429, 500 |

**Request Example:**
```json
{
  "question": "What is the distribution of sleep_hours?",
  "dataset_id": 42
}
```

**Response Example:**
```json
{
  "id": 123,
  "status": "local_only",
  "message": "Analytics computation runs locally...",
  "privacyStatus": { "bytesSent": 0, "connections": 0, "teeActive": false }
}
```

---

### Workspaces

Manage user workspaces. Accessing the list of workspaces will automatically seed a default workspace if none exist.

| Method | Endpoint | Request Body | Success Response |
|---|---|---|---|
| `GET` | `/api/workspaces` | None | `200 OK`: Array of Workspace objects |
| `POST` | `/api/workspaces` | `{"name": "...", "description": "...", "mode": "solo"}` | `201 Created`: Created Workspace object |
| `DELETE` | `/api/workspaces` | `{"id": integer}` | `200 OK`: `{"ok": true}` |

**Workspace Object Example:**
```json
[
  {
    "id": 1,
    "name": "Default Cloud Workspace",
    "description": "My secure workspace.",
    "mode": "server",
    "owner": "abc123...",
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

---

### Datasets

Manage dataset metadata. Actual dataset files are not uploaded to these endpoints, only their metadata.

| Method | Endpoint | Request Body | Success Response |
|---|---|---|---|
| `GET` | `/api/datasets?workspace_id={id}` | None | `200 OK`: Array of Dataset metadata objects |
| `POST` | `/api/datasets` | `{"name": "...", "file_type": "csv", "row_count": 1200, "col_count": 10, "size_bytes": 50000, "columns_meta": [...]}` | `201 Created`: Created Dataset object |
| `PUT` | `/api/datasets` | `{"id": integer, "columns_meta": [...]}` | `200 OK`: Updated Dataset object |
| `DELETE` | `/api/datasets` | `{"id": integer}` | `200 OK`: `{"ok": true}` |

---

### Queries

Manage query history. Note that the actual text of the question is hashed before persistence for privacy.

| Method | Endpoint | Request Body | Success Response |
|---|---|---|---|
| `GET` | `/api/queries?workspace_id={id}&limit={n}` | None | `200 OK`: Array of Query history objects |
| `POST` | `/api/queries` | Full query metadata object | `201 Created`: Created Query object |
| `DELETE` | `/api/queries` | `{"id": integer}` | `200 OK`: `{"ok": true}` |

---

### Saved Analyses

Manage saved analysis results and notes.

| Method | Endpoint | Request Body | Success Response |
|---|---|---|---|
| `GET` | `/api/saved?workspace_id={id}` | None | `200 OK`: Array of Saved analyses with joined query data |
| `POST` | `/api/saved` | `{"title": "...", "query_id": integer, "notes": "..."}` | `201 Created`: Created Saved analysis object |
| `PUT` | `/api/saved` | `{"id": integer, "pinned": boolean, "notes": "..."}` | `200 OK`: Updated Saved analysis object |
| `DELETE` | `/api/saved` | `{"id": integer}` | `200 OK`: `{"ok": true}` |

---

### Network Logging

Audit events and network activity logging.

| Method | Endpoint | Request Body | Success Response |
|---|---|---|---|
| `GET` | `/api/network-log` | None | `200 OK`: Array of audit events (max 200, scoped by session_id) |
| `POST` | `/api/network-log` | `{"event_type": "ALLOW", "process_name": "...", "dst_ip": "...", "dst_port": 443, "bytes_sent": 0, "message": "..."}` | `201 Created`: Created Log entry |

**Security Note on POST:** The server performs validation to reject messages containing PII, SQL keywords, or secret tokens.

---

### System

#### `/api/_wake`
A simple health check endpoint used to prevent Vercel cold starts.

| Method | Request Body | Success Response |
|---|---|---|
| `GET` | None | `200 OK` |
