# Technical Decisions & Rationale

Document every significant architectural and technical decision with WHY it was made, what alternatives were considered, and what the trade-offs are.

## 1. Client-Side-First Architecture
**Decision**: All data processing happens in the browser. Server is optional and metadata-only.
**Rationale**: The core product differentiator is privacy. By processing everything locally, Privana guarantees zero data egress — a regulatory advantage for GDPR/HIPAA compliance.
**Alternatives**: Server-side processing with E2E encryption (like some medical analytics tools)
**Trade-offs**: Limited by browser memory/CPU. Cannot scale to huge datasets. No server-side caching across sessions.

## 2. AlaSQL as In-Browser SQL Engine
**Decision**: Use AlaSQL for SQL execution entirely within the browser.
**Rationale**: Enables familiar SQL semantics without server roundtrips. Supports JOIN, GROUP BY, aggregation.
**Alternatives**: DuckDB-WASM (better performance but larger WASM bundle), sql.js (SQLite in WASM)
**Trade-offs**: AlaSQL has limited window function support (PERCENTILE_CONT, STDDEV, OVER() are regex-replaced with AVG). No indexes. Performance degrades on datasets >100K rows.

## 3. Deterministic Intent Classification (No LLM)
**Decision**: Intent planning uses regex patterns and keyword matching (IntentPlanner) instead of LLM classification.
**Rationale**: Eliminates LLM latency, cost, and privacy risk for query understanding. Deterministic = reproducible results.
**Alternatives**: GPT-4 or local LLM for intent classification
**Trade-offs**: Limited to 8 predefined intents. Cannot handle novel query patterns. Requires manual synonym maintenance.

## 4. Discriminated Union for AnalyticsResult
**Decision**: AnalyticsResult uses a TypeScript discriminated union with 7 states (computed, partial, clarify, blocked, unsupported, refused, error).
**Rationale**: Exhaustive type checking at compile time. UI components can pattern-match on status. No invalid states possible.
**Alternatives**: Single object with nullable fields, or class hierarchy
**Trade-offs**: Verbose type definitions. Every consumer must handle all 7 cases.

## 5. Object.freeze for Immutable Snapshots
**Decision**: Committed AnalyticsResults and VisualContracts are deep-frozen with Object.freeze.
**Rationale**: Per SPEC V1.1, once an AnalyticsResult is committed, no component may mutate it. Prevents React re-renders from corrupting shared state.
**Alternatives**: Immer for structural sharing, or read-only TypeScript types
**Trade-offs**: Recursive Object.freeze has O(N) cost on large result arrays. TypeScript readonly is compile-time only.

## 6. Zustand over Redux
**Decision**: Three Zustand stores instead of Redux.
**Rationale**: Minimal boilerplate, no action types/reducers/middleware. Zustand integrates cleanly with React 19 concurrent features. Three stores provide clear separation: Vault (global), Cockpit (analytics), Workspace (canvas).
**Alternatives**: Redux Toolkit, Jotai, Recoil
**Trade-offs**: No Redux DevTools (though Zustand has middleware for devtools). No built-in time-travel debugging.

## 7. Fail-Closed Privacy Firewall
**Decision**: privacyFetch blocks ALL unknown external URLs by default.
**Rationale**: Zero-trust egress model. If a URL isn't explicitly whitelisted (same-origin, loopback, LAN, company), it's blocked.
**Alternatives**: Allowlist-only approach, or CSP headers
**Trade-offs**: Can break legitimate API integrations if not properly whitelisted. Developers must manually add new trusted domains.

## 8. Schema Firewall (Column Obfuscation)
**Decision**: Replace real column names with placeholders (c0, c1, t0) before sending to LLMs.
**Rationale**: Even with local Ollama, the schema names themselves could leak domain knowledge. Obfuscation prevents the LLM from learning column semantics.
**Alternatives**: Sending real names to local LLM (acceptable for many), or differential privacy
**Trade-offs**: LLM gets less context, potentially generating worse SQL. Restoration via regex can fail on edge cases.

## 9. HMAC-Derived Tenant Isolation
**Decision**: Derive tenant owner tokens from HMAC-SHA256(session_id, service_role_key) instead of using Supabase Auth tokens.
**Rationale**: Works without requiring full authentication setup. Session-based isolation without OAuth dependency.
**Alternatives**: Supabase Row Level Security with auth tokens, JWT-based multi-tenancy
**Trade-offs**: Not true authentication — anyone with the session ID can access their workspace. No password reset or account recovery.

## 10. Custom Statistical Engine (No External Math Library)
**Decision**: Implement Pearson, Spearman, ANOVA, Chi-Square, FDR corrections from scratch in TypeScript.
**Rationale**: Zero external dependencies = smaller bundle, no supply chain risk, auditable math. Also avoids loading large libraries like mathjs or jstat.
**Alternatives**: jstat, mathjs, simple-statistics
**Trade-offs**: More code to maintain. Potential numerical precision issues in edge cases (Lanczos approximation has iteration limits). No GPU acceleration.

## 11. IndexedDB for Offline Storage
**Decision**: Use IndexedDB instead of localStorage for all persistent data in Solo Mode.
**Rationale**: localStorage has a 5MB cap. IndexedDB can store gigabytes. Async API doesn't block main thread.
**Alternatives**: OPFS (Origin Private File System), localForage wrapper
**Trade-offs**: Verbose API requiring Promise wrappers. No built-in search/query capability.

## 12. Vercel Serverless Functions
**Decision**: API layer uses Vercel's serverless functions instead of a traditional backend.
**Rationale**: Zero infrastructure management. Auto-scaling. Deploy via git push. Free tier for MVP.
**Alternatives**: Express on Railway/Render, AWS Lambda, Supabase Edge Functions
**Trade-offs**: Cold starts. Rate limiter is per-instance (not shared). Limited to 10-second execution timeout.

## 13. PapaParse for CSV Parsing
**Decision**: PapaParse over manual parsing or csv-parse.
**Rationale**: Battle-tested, streaming-capable, handles edge cases (quoted fields, BOM, encoding).
**Alternatives**: csv-parse/sync, d3-dsv, manual regex
**Trade-offs**: 40KB gzipped bundle size.

## 14. Recharts for Visualization
**Decision**: Recharts over D3 directly, Victory, or Nivo.
**Rationale**: React-native component model. Composable API. Good TypeScript support.
**Alternatives**: D3 (more control), Nivo (prettier defaults), ECharts (better performance)
**Trade-offs**: Limited customization for exotic chart types. Performance issues with >10K data points.

## 15. Monolithic AnalyzePage.tsx (Acknowledged Debt)
**Decision**: The 210KB AnalyzePage.tsx was NOT an intentional architecture decision. It grew organically.
**Impact**: Contains legacy inline statistics, custom markdown renderer, hardcoded schema processing, 30+ useState hooks.
**Migration Plan**: Partially migrated to src/components/analytics/ and src/domain/analytics/features/. Feature flags gate new vs legacy.
**Lesson**: This is technical debt, not a design choice.
