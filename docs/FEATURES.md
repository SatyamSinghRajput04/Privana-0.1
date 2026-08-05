# Features Documentation for Privana

This document details the features of Privana, including how they work, their current status, and technical implementation.

## 1. Solo Mode (Fully Offline)
- **Description:** Zero cloud dependency, zero authentication required.
- **Data Storage:** All data stored in IndexedDB (`privana_local_db` v2).
- **Authentication:** User enters a local passphrase (SHA-256 hashed, stored in `localStorage`).
- **Stored Data:** Datasets CSV content, workspaces, queries, bookmarks, audit logs.
- **Auto-pruning:** Audit logs capped at 1000 per workspace.
- **Status:** FULLY FUNCTIONAL

## 2. Server Mode (Team Collaboration)
- **Description:** Uses Vercel Serverless Functions + Supabase PostgreSQL for team collaboration.
- **Data Privacy:** Only metadata synced to cloud (questions HMAC-hashed, timestamps). Raw data NEVER leaves the browser.
- **Tenant Isolation:** Tenant isolation via HMAC-SHA256(`session_id`).
- **Authentication:** Google OAuth for authentication.
- **Onboarding:** Auto-seeding default workspace for new users.
- **Status:** FUNCTIONAL

## 3. Natural Language Query Engine
- **Pipeline:** Question → `IntentPlanner` → `SlotResolver` → `PlanValidator` → `Executor` → `VisualContract`
- **Supported Intents:** 8 supported intents: `summary`, `distribution`, `grouped_average`, `correlation`, `feature_importance`, `ranking`, `filter`, `comparison`.
- **Confidence Scoring:** (0.50-0.95): <0.60 = unsupported, 0.60-0.85 = clarification, >0.85 = execute.
- **Matching:** Fuzzy column matching via Jaro-Winkler similarity + domain synonyms. N-gram tokenization for multi-word column names.
- **Status:** FUNCTIONAL (deterministic pipeline)

## 4. Local AI Integration (Ollama)
- **Description:** Connects to locally running Ollama at `localhost:11434`.
- **Supported Models:** Supports CodeLlama, Llama 3, and other models.
- **Privacy:** Schema Firewall obfuscates column names before sending (e.g., `salary`→`c0`, `name`→`c1`, `table`→`t0`).
- **Diagnostics:** OllamaDiagnostics component shows connection status and available models.
- **Feature Flag:** `USE_LLM_PLAN_PROPOSER` (currently `false`).
- **Status:** INTEGRATED but behind feature flag

## 5. In-Browser SQL Engine (AlaSQL)
- **Description:** Parses CSV (PapaParse) and JSON files in-browser.
- **Limits:** 100MB file size, 500 columns max, duplicate header rejection.
- **SchemaContract:** Profiling: column types, cardinality, null counts, roles.
- **Compilation:** Parameterized SQL compilation (prevents injection).
- **Cache:** LRU query cache: 50 entries / 64MB memory limit.
- **Security:** Only `SELECT`/`WITH` statements allowed.
- **Status:** FULLY FUNCTIONAL

## 6. Statistical Analysis Engine (safeCompute)
- **Description:** Pure TypeScript, zero external math dependencies.
- **Correlation:** Pearson r, Spearman ρ (rank-based), Point-Biserial.
- **ANOVA:** One-Way with F-statistic and Eta-squared (η²).
- **Association:** Chi-Square test, Cramer's V.
- **P-values:** Student's t-distribution, F-distribution, Chi-Square.
- **Multiple Comparison:** Benjamini-Hochberg FDR correction, Bonferroni.
- **Mathematical Internals:** Lanczos log-gamma approximation, Lentz continued fraction for incomplete beta.
- **Feature Importance:** Ranking with leakage detection (r > 0.99 excluded).
- **Status:** FULLY FUNCTIONAL

## 7. Privacy Firewall (Zero Egress)
- **Interceptor:** Fail-closed fetch interceptor (`privacyFetch.ts`).
- **URL Classification:** same-origin, loopback, private LAN (10.x, 172.16-31.x, 192.168.x), company server, BLOCKED.
- **PII Scanner:** email, phone, credit card (Luhn validated), SSN, Aadhaar, PAN, API keys, PEM keys.
- **Hashing:** All detected PII hashed with session-salted SHA-256.
- **Audit Log:** Written to IndexedDB with custom event dispatch. Network Monitor UI shows real-time audit trail.
- **Status:** FULLY FUNCTIONAL

## 8. Workspace Blueprint System
- **Description:** Auto-generated multi-sheet analytical dashboards from schema.
- **Sheets:** Overview Dashboard, Relationships, Breakdowns, AI Insights.
- **Pipeline:** `CardSpec` → SQL compilation → Parallel execution → `VisualContract` mapping.
- **Immutability:** `deepFreeze` on all results.
- **History:** 5-sheet FIFO snapshot queue.
- **Status:** FUNCTIONAL

## 9. Interactive Clarification
- **Description:** When confidence is 60-85%, system presents disambiguation options.
- **UI:** `ClarifyView` renders clickable choice cards.
- **Execution:** User selection re-executes with forced intent.
- **Status:** FUNCTIONAL

## 10. Result Views (7-State Discriminated Union)
- **computed:** Full visualization + KPI + narrative
- **partial:** Degraded results with warnings
- **clarify:** Disambiguation choices
- **blocked:** Dataset safety violations
- **unsupported:** Out-of-scope intent
- **refused:** Schema verification failures with corrections
- **error:** Runtime panics with debug IDs

## 11. Data Visualization
- **UnifiedChart:** Universal Recharts wrapper (bar, line, area, scatter, pie/donut).
- **AnalyticsTable:** Smart data grid with spark-bars and sort.
- **KPI Gauges:** SVG circular progress indicators.
- **Workspace Cards:** Cards with chart + narrative pairs.

## 12. Dataset Management
- **Upload:** Drag-and-drop CSV/JSON upload.
- **Introspection:** Schema introspection with column type detection.
- **Viewer:** TenSEAL Simulator table (column metadata viewer).
- **Seeding:** Sample dataset seeding (1200-row Teen Mental Health CSV).

## 13. Query History & Saved Analyses
- **View:** Master-detail view for past queries.
- **Bookmarks:** Bookmark/pin system.
- **SQL:** SQL viewer toggle.
- **Persistence:** Dual-mode persistence (IndexedDB for Solo, API for Server).

## 14. Shadow Testing
- **Description:** `ShadowTester` compares legacy vs parameterized SQL outputs.
- **Comparison:** Cell-by-cell comparison with floating point tolerance (0.005).
- **Reports:** Console reports with pass/fail parity.
- **Status:** DEVELOPMENT TOOL

## 15. Feature Flags
- `USE_NEW_ANALYTICS_PIPELINE`: `true` (new domain-driven architecture)
- `USE_NEW_ANALYTICS_VISUALS`: `true` (new result views)
- `USE_LLM_PLAN_PROPOSER`: `false` (AI plan suggestion - not ready)
- **Testing:** `localStorage` override for dev testing.
