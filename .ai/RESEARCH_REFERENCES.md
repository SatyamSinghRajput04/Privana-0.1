# 📚 Privana Academic & Research References (.ai/RESEARCH_REFERENCES.md)

This document situates Privana within the academic literature on database systems, in-browser analytics, and visualization architectures.

---

## 📄 Primary Literature References

### 1. In-Browser Analytical Processing
* **DuckDB-Wasm: Fast Analytical Processing for the Web** (VLDB 2022)
  * *Authors*: André Wohlke, Hannes Mühleisen, Mark Raasveldt.
  * *Key Contribution*: Brings vectorized C++ OLAP engines to WebAssembly running asynchronously in Web Workers via virtualized file systems (`BROWSER_FILEREADER`).
  * *Privana Adoption*: Used as the high-performance backing implementation of `ComputeEngine`.

### 2. Scalable Interactive Visualization
* **Mosaic: An Architecture for Scalable Interactive Data Systems** (IEEE VIS 2024)
  * *Authors*: Jeffrey Heer, Dominik Moritz (UW Interactive Data Lab).
  * *Key Contribution*: Decouples data processing from visual clients using Apache Arrow columnar vectors and database pushdown.
  * *Privana Adoption*: Enforces bounded materialization; Recharts only renders small, aggregated visual contracts.

### 3. Natural Language Interfaces to Data
* **NL4DV: A Toolkit for Generating Analytic Specifications for Data Visualization from Natural Language Queries** (IEEE TVCG 2021)
  * *Authors*: Arpit Narechania, Arjun Srinivasan, John Stasko.
  * *Key Contribution*: Deterministic semantic parsing of user intent into visualization specifications.
  * *Privana Adoption*: Informs our slot-based `AnalysisPlan` intent resolution architecture.

---

## 🎯 Academic Scope & Novelty Positioning
> **Scope**: Privana investigates the integration of established deterministic natural language understanding, robust statistical computing (shifted moments), and vectorized in-browser execution (DuckDB-WASM/Arrow) under a **strict, local-first, zero-data-egress runtime architecture**.
