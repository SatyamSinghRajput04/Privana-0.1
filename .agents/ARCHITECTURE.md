# 🏛️ Privana System Architecture & Layer Boundaries (ARCHITECTURE.md)

This document establishes the **explicit architectural layers and boundaries** of Privana. No component may violate or bypass its designated layer responsibility.

---

## 🗺️ System Layer Responsibility Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. PRESENTATION LAYER (React 19 / Tailwind / Recharts)                  │
│    • Renders VisualContracts and UI layouts                             │
│    • Strictly stateless regarding statistical computation               │
│    • Consumes immutable AnalyticsResult snapshots only                  │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. STATE & COCKPIT LAYER (Zustand)                                      │
│    • Holds active dataset selection, workspace tabs, and query history  │
│    • Manages UI interaction state without mutating analytical data      │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. INTENT & NLU LAYER (Natural Language Understanding)                  │
│    • Parses user queries, matches synonyms, extracts filters            │
│    • Produces a deterministic AnalysisPlan contract                     │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. STATISTICAL EXECUTORS LAYER (domain/analytics/executors)             │
│    • Receives AnalysisPlan and requests data from ComputeEngine         │
│    • Applies statistical formulas (Pearson, ANOVA, Benjamini-Hochberg)  │
│    • Enforces zero-variance guards and constructs AnalyticsResult       │
├─────────────────────────────────────────────────────────────────────────┤
│ 5. COMPUTE ENGINE LAYER (domain/compute)                                │
│    • Abstract, statistics-shaped data access contract                   │
│    • Dispatches to InMemoryComputeEngine or DuckDBComputeEngine         │
│    • Never interprets statistical significance                          │
├─────────────────────────────────────────────────────────────────────────┤
│ 6. DATABASE & VFS LAYER (lib/sqlEngine & DuckDB-WASM Worker)            │
│    • Ingestion, streaming FileReader VFS, and WebAssembly execution     │
│    • Vectorized C++ aggregation and pushdown execution                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Layer Contract Definitions

| Layer | Input | Output | Invariant |
|---|---|---|---|
| **NLU / Planner** | User Query String | `AnalysisPlan` | Deterministic slot resolution; no calculation |
| **Executor** | `AnalysisPlan` + `ComputeEngine` | `AnalyticsResult` | Owns statistical math and zero-variance guards |
| **ComputeEngine** | `MomentsRequest` / `GroupBy` | `PairMoments` / Aggregates | Statistics-shaped; no SQL leakage to executors |
| **Database Adapter** | File handle / Query | Arrow RecordBatch / Rows | Streaming VFS; no full-table JS materialization |
| **Visualization** | `VisualContract` | Rendered SVG/DOM | Pure presentation; never recomputes statistics |
