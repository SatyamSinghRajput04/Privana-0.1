# 📖 Privana Domain Glossary (.ai/GLOSSARY.md)

This glossary defines standard terminology used across Privana's codebase and specifications.

---

### 1. `AnalysisPlan`
* The deterministic JSON contract output by the NLU planner describing the user's analytical intent (intent type, metric column, target column, group-by dimension, filters, and confidence score).

### 2. `AnalyticsResult`
* The immutable snapshot representing the verified mathematical truth of an analysis. Contains exact values, $p$-values, degrees of freedom, sample sizes, and warning flags.

### 3. `ComputeEngine`
* The abstract data access interface (`src/domain/compute/ComputeEngine.ts`) separating statistical mathematics from data retrieval/aggregation mechanisms. Exposes `groupedAggregate`, `moments`, and `samplePoints`.

### 4. `Shifted Moments`
* Numerical technique where a constant origin ($\text{shiftX}$) is subtracted from data points before accumulating sums ($\Sigma(x - \text{shiftX})$, $\Sigma(x - \text{shiftX})^2$). Restores floating-point conditioning across massive magnitudes (e.g. timestamps).

### 5. `VisualContract`
* The declarative mapping that translates an `AnalyticsResult` snapshot into a concrete Recharts or tabular layout blueprint without recalculating any numbers.

### 6. `Virtual File System (VFS)`
* The in-browser filesystem layer inside DuckDB-WASM that maps native browser `File` objects directly to WebAssembly memory using `DuckDBDataProtocol.BROWSER_FILEREADER`.
