# 🏛️ Privana Architectural Decisions Record (DECISIONS.md)

This document indexes all formal **Architectural Decision Records (ADRs)** adopted in Privana. Architectural decisions cannot be undone or bypassed without an approved superseding ADR.

---

### ADR-001: Immutable AnalyticsResult as Single Source of Truth
* **Status**: Accepted
* **Context**: Different UI widgets, floating assistants, and side panels previously recalculated numbers independently, creating visual inconsistencies and race conditions.
* **Decision**: All analytical views must consume an immutable snapshot of `AnalyticsResult`.
* **Consequence**: Zero UI divergence; no component may independently re-run queries or modify statistical output after execution.

---

### ADR-002: Statistics-Shaped ComputeEngine Boundary
* **Status**: Accepted
* **Context**: Passing rows back and forth between SQL and JavaScript causes massive object allocation and GC stalls.
* **Decision**: `ComputeEngine` exposes statistics-shaped methods (`groupedAggregate`, `moments`, `samplePoints`) rather than raw row sets.
* **Consequence**: Enables drop-in replacement by DuckDB-WASM; allows full SQL pushdown without rewriting executor logic.

---

### ADR-003: Phased Shadow Migration to DuckDB-WASM
* **Status**: Accepted
* **Context**: Replacing AlaSQL in one big-bang release carries high regression risk across edge cases.
* **Decision**: Execute DuckDB in shadow parity mode alongside AlaSQL before cutting over production workloads.
* **Consequence**: Golden-result parity testing guarantees zero semantic regressions.

---

### ADR-004: Shifted Sums for Correlation Numerical Conditioning
* **Status**: Accepted
* **Context**: Naive computational formulas ($n\Sigma x^2 - (\Sigma x)^2$) suffer from catastrophic cancellation on timestamps ($1.7 \times 10^{12}$).
* **Decision**: Accumulate shifted moments ($\Sigma(x - \text{shiftX})$).
* **Consequence**: Exact mathematical precision ($10^{-15}$ error) maintained across all magnitudes.

---

### ADR-005: Zero Hardcoded Schema Heuristics
* **Status**: Accepted
* **Context**: Dataset-specific column names (`gender`, `sleep_hours`) hardcoded in logic break general tabular compatibility.
* **Decision**: All schemas and types must be dynamically inferred from dataset profiles.
* **Consequence**: True tabular-agnostic platform capable of handling any valid CSV, Parquet, or JSON dataset.
