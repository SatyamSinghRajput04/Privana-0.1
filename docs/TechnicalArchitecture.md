# Enterprise Technical Architecture Specification: Privana

## 1. Core Technology Stack
1. **Frontend Logic & View**: React 19 + TypeScript 5 (Vite bundler).
2. **Database Engine**: AlaSQL (in-memory SQL query engine).
3. **Storage Subsystem**: Browser IndexedDB (`privana_local_db`).
4. **Data Ingestion**: PapaParse streaming parser.
5. **Visualization Engine**: Recharts.

## 2. Invariant Rules & System Guarantees
1. **Unified Pipeline Enforcement**: Every analytical query MUST route through `runAnalyticsQuestion()`.
2. **Tabular-Agnostic Profiling**: Column profiles dynamically drive filters, KPIs, visual specs, and AI summaries based on semantic types (`metric`, `dimension`, `time`, `id`).
3. **Compiler Invariant Verification**: All code changes are validated using explicit build checks (`npm run build`).
4. **Immutable Analytical Snapshot**: Analytics results are committed once and consumed downstream without post-execution mutation.
