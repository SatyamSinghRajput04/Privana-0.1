# 🔬 Open-Source & Research Repository References (research/REFERENCES.md)

This file tracks curated open-source repositories and research systems, documenting what we learned, what we adopted, and what we explicitly rejected.

---

## 📂 Repository Analysis Matrix

### 1. `duckdb/duckdb-wasm` (In-Browser OLAP)
* **Repository**: [https://github.com/duckdb/duckdb-wasm](https://github.com/duckdb/duckdb-wasm)
* **What We Learned**:
  - `registerFileHandle()` with `BROWSER_FILEREADER` allows paged lazy reading without reading large strings into memory.
  - Asynchronous worker communication using Apache Arrow vectors minimizes serialization overhead.
* **What We Adopted**:
  - Web Worker deployment singleton (`AsyncDuckDB`).
  - Streaming VFS File handle registration.
* **What We Explicitly Did NOT Adopt**:
  - Direct SQL query generation inside UI components (violated layer isolation). All analytical queries must pass through `ComputeEngine`.

---

### 2. `uwdata/mosaic` (UW Interactive Data Lab)
* **Repository**: [https://github.com/uwdata/mosaic](https://github.com/uwdata/mosaic)
* **What We Learned**:
  - Visual charts must never receive un-aggregated million-row arrays.
  - Declarative coordinators push filtering and aggregation directly into the database engine.
* **What We Adopted**:
  - The Arrow Materialization Boundary: only compact, aggregated data is converted to JavaScript objects for UI rendering.
* **What We Explicitly Did NOT Adopt**:
  - Multi-engine server-side proxies (Privana is strictly 100% in-browser, local-first).

---

### 3. `simonw/datasette-lite`
* **Repository**: [https://github.com/simonw/datasette-lite](https://github.com/simonw/datasette-lite)
* **What We Learned**:
  - Running WASM engines directly against remote or local URLs without server-side compute.
* **What We Adopted**:
  - In-browser SQLite/WASM sandbox lifecycle patterns.
* **What We Explicitly Did NOT Adopt**:
  - Global mutable Python Pyodide runtime (we use TypeScript + native WebAssembly for performance).
