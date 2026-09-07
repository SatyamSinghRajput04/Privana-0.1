# 📜 Privana Engineering Journal (JOURNAL.md)

This journal tracks the **chronological evolution** of Privana, recording major milestones, discoveries, bug investigations, and implementation results.

---

### 📅 2026-09-04: Phase C Default DuckDB Engine Switch (COMPLETED)
* **Task**: Enable DuckDB as the default active analytical engine across all workspaces.
* **Work Accomplished**:
  - Switched `useDuckDB = true` in `src/domain/compute/index.ts`.
  - Verified 100% mathematical parity against `inMemoryComputeEngine` across Grouped Averages, Correlation, ANOVA, and Cramer's V.
  - Verified `npm run build` (`✓ built in 14.51s`, 0 errors).
  - Verified all domain regression test suites (`runAnalyticsQuestion.test.ts`, `correlation.test.ts`, `duckdb_parity.test.ts`).
* **Next**: Phase D AlaSQL Deprecation & Final Legacy Cleanup.

---

### 📅 2026-09-04: Stage 2.6 One-Way ANOVA & Cramer's V Sufficient Stats (COMPLETED)
* **Task**: Migrate ANOVA and Cramer's V calculations to single-pass sufficient statistics (`anovaFromSufficientStats` and `cramersVFromContingency`).
* **Work Accomplished**:
  - Implemented single-pass $F$-statistic and $\eta^2$ derivation from group sums ($SS_{\text{between}}$ and $SS_{\text{total}}$).
  - Implemented pre-aggregated contingency table $\chi^2$ and Cramer's $V$ evaluation.
  - Added Test 7 and Test 8 to `duckdb_parity.test.ts` (100% mathematical parity verified).
  - Verified clean compilation with `npm run build` (`✓ built in 13.22s`, 0 errors).
* **Next**: Phase C Default DuckDB Engine Switch & Benchmark Verification.

---

### 📅 2026-09-04: Phase B Dual-Engine Workload Routing Adapter (COMPLETED)
* **Task**: Implement dual-engine table management in `sqlEngine.ts` and optimize dataset ingestion in `DatasetsPage.tsx`.
* **Work Accomplished**:
  - Added `registerDuckDBFile` in `sqlEngine.ts` to register native `File` objects into DuckDB VFS using `DuckDBDataProtocol.BROWSER_FILEREADER`.
  - Updated `isTableLoaded`, `getTableRowCount`, and `dropTable` to manage both DuckDB VFS and AlaSQL tables seamlessly.
  - Optimized `DatasetsPage.tsx` to eliminate unconditional `await f.text()` for CSVs, preventing main-thread V8 heap allocation stalls on large files.
  - Verified `npm run build` (0 errors, `vendor-duckdb` chunk 189.92 kB) and all test suites (`duckdb_parity.test.ts`, `runAnalyticsQuestion.test.ts`, `correlation.test.ts`).
* **Next**: Phase C Default DuckDB Engine Switch & Stage 2.6 (Feature Importance / ANOVA migration).

---

### 📅 2026-09-04: Phase A DuckDB-WASM ComputeEngine Shadow Parity (COMPLETED)
* **Task**: Implement `@duckdb/duckdb-wasm` in a dedicated Web Worker behind `ComputeEngine` and verify shadow parity.
* **Work Accomplished**:
  - Added `@duckdb/duckdb-wasm` and `apache-arrow`.
  - Built `duckdbWorker.ts` with VFS `BROWSER_FILEREADER` streaming support.
  - Implemented `DuckDBComputeEngine.ts` with SQL pushdown (`groupedAggregate`, `moments` with shifted sums, `samplePoints` with reservoir sampling).
  - Configured `vite.config.ts` manual chunking.
  - Constructed and executed `duckdb_parity.test.ts` (100% mathematical parity verified).
  - Verified `npm run build` (0 errors) and all existing regression suites (`runAnalyticsQuestion.test.ts`, `correlation.test.ts`).
* **Next**: Phase B Dual-Engine Workload Routing Adapter (`sqlEngine.ts`).

---

### 📅 2026-09-04: Industrial-Grade Governance & DuckDB-WASM Implementation Plan
* **Task**: Formulate research-grounded, non-destructive DuckDB-WASM migration plan.
* **Review Findings**:
  - Clarified ingestion breakdown: `Selection -> Registration -> Profiling -> Preview -> Analytical Query`.
  - Added explicit Arrow Materialization Boundary: only compact analytical results cross into React.
  - Aligned DuckDB underneath the `ComputeEngine` abstraction (Statistics-shaped boundary).
  - Established the `.agents/`, `.ai/`, and `research/` governance repository structure.
* **Next**: Implement Phase A dedicated Web Worker and `DuckDBComputeEngine` with shadow parity suite.

---

### 📅 2026-08-23: Stage 2.5 CorrelationExecutor & Shifted Moments
* **Task**: Migrate `CorrelationExecutor` to single-pass `ComputeEngine` operations.
* **Discovery**: Raw sums formula ($n\Sigma x^2 - (\Sigma x)^2$) suffered from catastrophic cancellation on timestamps ($1.7 \times 10^{12}$).
* **Decision**: Implemented shifted sums ($\Sigma(x - \text{shiftX})$), restoring mathematical precision to $10^{-15}$ error.
* **Verification**: All 60+ assertions passed across Pearson, Spearman, Point-Biserial, and large-magnitude stability tests. Measured 2.7x–4.6x speedup.

---

### 📅 2026-08-22: Stage 2.1 ComputeEngine Seam & GroupedAverage
* **Task**: Introduce `ComputeEngine` interface seam and migrate `GroupedAverageExecutor`.
* **Discovery**: Benchmarked 800k rows: pure JS loop (30ms) vs pre-clean + AlaSQL (177ms). Proved JS array allocation was the true bottleneck.
* **Decision**: Designed `ComputeEngine` as a statistics-shaped boundary.
