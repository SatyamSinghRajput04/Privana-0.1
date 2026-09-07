# 🧠 Privana Brain: Architectural Philosophy & Conceptual Design

This document explains **how Privana is conceptually designed**, how its cognitive layers interact, and why its architecture is structured to deliver private, deterministic, enterprise-grade analytics.

---

## 🏛️ 1. Core Philosophy: The Separation of Intelligence from Computation

Privana is built on a fundamental principle:
> **AI understands the user's question; deterministic mathematical engines compute the answer.**

```
                     ┌───────────────────────────────────┐
                     │          USER INTENT              │
                     │  "What is the average sleep by    │
                     │   gender for high stress users?"  │
                     └─────────────────┬─────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │          NLU & PLANNER            │
                     │  Understands intent, resolves     │
                     │  columns, builds AnalysisPlan     │
                     └─────────────────┬─────────────────┘
                                       │ (Deterministic Intent Contract)
                                       ▼
                     ┌───────────────────────────────────┐
                     │            EXECUTOR               │
                     │  Executes statistical method      │
                     │  (GroupedAverage, Pearson, etc.)  │
                     └─────────────────┬─────────────────┘
                                       │ (Data Request)
                                       ▼
                     ┌───────────────────────────────────┐
                     │         COMPUTE ENGINE            │
                     │  Single-pass streaming retrieval  │
                     │  (InMemoryEngine / DuckDB-WASM)   │
                     └─────────────────┬─────────────────┘
                                       │ (Raw Statistics / Shifted Sums)
                                       ▼
                     ┌───────────────────────────────────┐
                     │        ANALYTICS RESULT           │
                     │  Canonical, immutable truth       │
                     │  (Value, P-value, Sample Size)    │
                     └─────────────────┬─────────────────┘
                                       │ (VisualContract Mapping)
                                       ▼
                     ┌───────────────────────────────────┐
                     │          VISUALIZATION            │
                     │  Pure rendering layer (Recharts)  │
                     │  NEVER recalculates statistics    │
                     └───────────────────────────────────┘
```

---

## 🔒 2. Privacy-First Local Runtime Architecture

1. **Zero-Trust Local Isolation**:
   - Data never leaves the user's browser sandbox.
   - All computation happens in-browser via WebAssembly and JavaScript workers.
2. **Tabular-Agnostic Intelligence**:
   - The platform dynamically profiles any tabular CSV, Parquet, or JSON schema.
   - It identifies metric columns, categorical dimensions, temporal sequences, and primary keys through heuristic variance analysis without hardcoded domain assumptions.
3. **Canonical Snapshot Immutability**:
   - Once computed, an `AnalyticsResult` is frozen.
   - When a user filters, sorts, changes chart views, or asks the AI assistant to explain a chart, every component consumes the immutable snapshot. No component is permitted to re-query or mutate the source truth.
