# 🧠 Privana Long-Term Engineering Memory (MEMORY.md)

This file stores **durable engineering discoveries, performance benchmarks, mathematical lessons, and empirical findings**. Before proposing architectural changes, consult this record to avoid repeating historical pitfalls.

---

## 📌 Discovery 1: The JavaScript Array Boundary & Materialization Bottleneck
* **Date**: August 2026
* **Empirical Finding (800k rows benchmark)**:
  - Single-pass native JS reduction: `~30ms`
  - Pre-cleaning pass + AlaSQL `GROUP BY`: `~177ms` (`129ms` clean + `48ms` SQL)
* **Lesson**: The primary performance bottleneck in in-browser analytics is **not** SQL aggregation itself, but the **JavaScript array materialization boundary** (allocating millions of objects in V8 memory, string copies, and garbage collection pauses).
* **Implication**: Moving data into SQL only provides massive speedups if the data is held in native columnar memory (DuckDB/Arrow) and never materialized as JavaScript objects on the main thread.

---

## 📌 Discovery 2: Catastrophic Floating-Point Cancellation in Correlation Sums
* **Date**: August 2026
* **Mathematical Finding**:
  - Naive sum-of-squares formula ($n\Sigma x^2 - (\Sigma x)^2$) collapses on data with large magnitudes relative to spread (e.g. Unix timestamps $\sim 1.7 \times 10^{12}$, UUIDs, large IDs).
  - At $10^9$, true correlation $r = 0.998$ reported as $r = 0.408$. At $10^{12}$, reported as $r = 0.000$.
* **Solution**: Implemented **Shifted Sums** ($\Sigma(x - \text{shiftX})$). Because correlation is shift-invariant, subtracting a per-column origin restores numerical precision to $10^{-15}$ error while remaining single-pass and SQL-translatable.

---

## 📌 Discovery 3: Browser DevTools (F12) Heuristic Slowdown
* **Date**: August 2026
* **Observation**: Processing 100k+ rows with Chrome DevTools open causes V8 to run in un-optimized debug mode, creating heap snapshot metadata for every object and making execution 10x–50x slower.
* **Rule**: Production benchmarks must always be conducted in clean browser windows without active debugger hooks.

---

## 📌 Discovery 4: Ingestion Lifecycle Separation (Registration vs Parsing)
* **Date**: September 2026
* **Finding**: `db.registerFileHandle(name, file, BROWSER_FILEREADER, true)` registers the File handle into the VFS instantly without reading the full file.
* **Rule**: Ingestion must be measured across 5 distinct stages: `Selection -> Registration -> Schema Inference -> Preview -> Analytical Query`.
