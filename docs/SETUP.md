# Privana Setup Guide

This document provides comprehensive instructions for setting up, running, and deploying Privana.

## Prerequisites
- **Node.js** v18 or higher
- **npm** v9 or higher
- *(Optional, for AI features)* **Ollama** installed and running locally
- *(Optional, for Server Mode)* **Supabase** account
- *(Optional, for Server Mode)* **Vercel** account

## Installation

```bash
git clone https://github.com/SatyamSinghRajput04/Privana.git
cd Privana
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173` in your browser.

## Environment Variables

From `.env.example`:

```env
# Supabase (Server Mode only)
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
FULLSTACK_PROJECT_REF=your_supabase_project_ref_here
FULLSTACK_RESTORE_API_URL=your_restore_api_url_here

# Google OAuth (Optional — Server Mode only)
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
VITE_GOOGLE_AUTH_PROXY=your_google_auth_proxy_url_here
```

> [!NOTE]
> **Solo Mode** works with ZERO environment variables.

## Running Locally

### Solo Mode (fully offline)

```bash
npm run dev
```
- Open `http://localhost:5173`
- Select **'Solo Desktop'** mode on the landing page
- Set any passphrase (stored locally as SHA-256 hash)
- No external services needed

### With Local AI (Ollama)

```bash
# Install from https://ollama.com
# Pull a code model:
ollama pull codellama
```
*Privana auto-detects Ollama at `http://localhost:11434`*

### With Server Mode (API + Frontend)

```bash
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — API server
node api-dev-server.mjs
```
The frontend proxies `/api/*` requests to `localhost:3001`.

> The `api-dev-server.mjs` is an Express server that mimics Vercel serverless functions locally.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |
| `npm test` | Run analytics domain tests |
| `npm run test:regression` | Regression tests |
| `npm run eval:analytics` | Analytics evaluation suite |

## Building for Production

```bash
npm run build
```

Produces output in `dist/` with code splitting:
- `vendor-alasql` (AlaSQL chunk)
- `vendor-charts` (Recharts + D3)
- `vendor-core` (React + other deps)

*Vite config has manual chunks configured for optimal loading.*

## Vercel Deployment

```bash
npm i -g vercel
vercel
```

Set environment variables in the Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Supabase Setup

Create the following tables in your Supabase project:

- `viq_workspaces` (id, name, description, mode, owner, created_at)
- `viq_datasets` (id, workspace_id, name, file_type, row_count, col_count, size_bytes, columns_meta, created_at)
- `viq_queries` (id, workspace_id, dataset_id, question, generated_sql, result_data, chart_type, insights, execution_ms, row_count, status, created_at)
- `viq_saved_analyses` (id, workspace_id, title, query_id, notes, pinned, created_at)
- `viq_network_log` (id, workspace_id, session_id, event_type, process_name, dst_ip, dst_port, bytes_sent, message, created_at)

## Docker

No Docker configuration exists yet. This is a planned improvement.

## Troubleshooting

1. **Ollama not detected**: Ensure Ollama is running at `localhost:11434`. Check Settings > Ollama Diagnostics page.
2. **CORS errors in Server Mode**: Ensure `api-dev-server.mjs` is running on port 3001.
3. **CSV upload fails**: Check file is < 100MB, has < 500 columns, no duplicate headers.
4. **Build fails**: Run `npx tsc --noEmit` to check TypeScript errors.
5. **Supabase connection fails**: Verify env variables are set correctly. Solo mode doesn't need them.
