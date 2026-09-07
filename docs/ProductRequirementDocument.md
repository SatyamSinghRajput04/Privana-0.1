# Enterprise Product Requirement Document (PRD): Privana

## 1. Product Vision & Goals
Privana empowers enterprise data analysts and privacy-sensitive organizations to explore, query, and visualize tabular datasets instantly without transmitting sensitive data outside the local browser environment.

## 2. Core Operational Pillars
1. **Zero Data Egress**: All CSV/JSON data ingestion, SQL parsing, statistical calculations, and rendering occur strictly in-browser.
2. **Tabular Agnosticism**: Privana works seamlessly across any domain dataset (e.g. e-commerce Olist, healthcare, finance, HR) without hardcoding domain assumptions or column names.
3. **Sub-Second Performance**: UI frame rates remain locked at 60 FPS even when working with 100,000+ row datasets.

## 3. High-Priority Functional Requirements

| Requirement ID | Module | Feature Description | Performance Target |
|----------------|--------|---------------------|--------------------|
| PRD-FR-01 | Ingestion | Stream and parse CSV datasets up to 100 MB | No browser freeze ("Page Unresponsive") |
| PRD-FR-02 | Profiling | Compute `ColumnProfile` heuristics (types, metrics, cardinality) | <5 ms for 1,000 sample rows |
| PRD-FR-03 | Analytics | Natural Language & Preset Query Planning via SQL pushdown | Sub-50ms execution on 100k rows |
| PRD-FR-04 | Visuals | Auto-select chart specs (Bar, Line, Scatter, KPI) based on `ColumnProfile` | Fluid re-render, 60 FPS |
| PRD-FR-05 | Privacy | Detect and flag PII (emails, names, SSN, phones) | Zero external data leakage |
