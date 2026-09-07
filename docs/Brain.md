# Enterprise Brain & System Knowledge Index: Privana

## 1. Executive Summary & Core Identity
Privana is an enterprise local-first AI analytics platform engineered for complete tabular agnosticism and zero data egress. 

## 2. Key Architectural Invariants
- **Schema Analyzer**: Produces `ColumnProfile` contracts as single source of truth (`src/domain/analytics/schemaAnalyzer.ts`).
- **Unified Domain Pipeline**: Single entry point `runAnalyticsQuestion()` (`src/domain/analytics/runAnalyticsQuestion.ts`).
- **SQL Pushdown Engine**: Computes aggregations via database engine SQL rather than materializing 100k JS objects.
- **Main-Thread Protection**: Non-blocking streaming CSV ingest and bounded sample schema sniffing.

## 3. High-Priority Maintenance Protocols
- Always run `npm run build` after modifications.
- Do not mutate committed `AnalyticsResult` snapshots.
- Do not introduce hardcoded column strings (`sleep_hours`, `gender`, `anxiety_level`).
