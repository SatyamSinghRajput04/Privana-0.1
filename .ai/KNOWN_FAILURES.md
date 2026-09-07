# ⚠️ Privana Known Failures & Historical Anti-Patterns (.ai/KNOWN_FAILURES.md)

This document cataloges **known failure modes and historical bugs** to ensure they are never reintroduced.

---

### 1. The `await f.text()` Ingestion Freeze
* **Failure Mode**: Calling `await f.text()` on a 200MB CSV file forces V8 to allocate >1GB of contiguous UTF-16 string memory on the main thread, resulting in Chrome's *"Page Unresponsive"* dialog.
* **Invariant**: Always pass native browser `File` objects directly to `DuckDBDataProtocol.BROWSER_FILEREADER` for paged lazy streaming.

---

### 2. Catastrophic Floating-Point Cancellation in Moments
* **Failure Mode**: The naive sum-of-squares formula ($n\Sigma x^2 - (\Sigma x)^2$) cancels out on large base offsets (timestamps $\sim 1.7 \times 10^{12}$), reporting $r=0.000$ instead of $r=0.998$.
* **Invariant**: Always accumulate shifted moments ($\Sigma(x - \text{shiftX})$).

---

### 3. Redundant Table Re-Parsing on Page Mount
* **Failure Mode**: When switching from the Datasets page to the Analyze page, an un-cached check triggered a second `getDatasetCSV()` read from IndexedDB, re-parsing 100,000 rows a second time.
* **Invariant**: Always check in-memory table registry and schema cache fast-paths (`SCHEMA_PROFILES`) before querying IndexedDB.

---

### 4. Direct SQL Leakage into Analytical Executors
* **Failure Mode**: Allowing executors to build raw SQL strings couples analytical semantics directly to database dialects and breaks portability.
* **Invariant**: Executors must only interact with `ComputeEngine` via statistics-shaped methods (`groupedAggregate`, `moments`, `samplePoints`).
