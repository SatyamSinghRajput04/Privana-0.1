# Enterprise Security & Access Control Specification: Privana

## 1. Zero-Trust Local Isolation Architecture
- **In-Browser Data Perimeter**: All dataset records reside exclusively within IndexedDB storage and in-memory WebAssembly/AlaSQL runtime buffers. No dataset records are sent to cloud LLMs or third-party APIs.
- **Air-Gapped Operation**: Network monitoring hooks verify zero egress byte count for analytical datasets.

## 2. PII Detection & Redaction Engine
- **Automated Regex & Semantic Scanning**: Detects emails, names, SSN/tax IDs, and telephone numbers during schema profiling.
- **TenSEAL CKKS Homomorphic Encryption Simulation**: Supports encrypted preview modes for sensitive numerical columns (`DECIMAL`, `INTEGER`).

## 3. Compliance & Audit Logging (`src/lib/indexedDb.ts`)
- Local audit logs track event types (`INFO`, `ALLOW`, `WARN`, `BLOCK`) and payload hashes without logging unredacted raw user data.
