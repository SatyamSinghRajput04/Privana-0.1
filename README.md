<div align="center">

# 🔒 Privana

### Privacy-First Local AI Analytics Platform

**Analyze sensitive datasets with AI — without sending a single byte to the cloud.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Built with React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Powered by Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)](https://vitejs.dev)
[![Local AI](https://img.shields.io/badge/AI-Ollama%20Local-orange)](https://ollama.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)

</div>

---

## 🚨 The Problem

Modern BI and AI analytics tools (Tableau, Power BI, Cloud LLMs) require uploading sensitive datasets to external servers. This creates:

- **Regulatory violations** — GDPR, HIPAA, SOC 2 exposure
- **IP leakage** — Financial models, employee data, internal KPIs sent to third parties
- **Zero data sovereignty** — No control over where raw records are stored or processed

---

## 💡 What Privana Does

Privana **inverts the trust model**. Instead of sending your data to the cloud, the entire analytical pipeline runs **locally on your machine**:

- 📂 **Upload CSV/JSON** → parsed in-browser (never touches a server)
- 🗣️ **Ask in plain English** → deterministic NLQ pipeline classifies intent + extracts entities locally
- 🤖 **Optional Local AI** → Ollama LLM generates SQL with obfuscated column names
- 📊 **Get instant charts** → statistical analysis runs on your CPU (Pearson, ANOVA, Chi-Square, FDR corrections)
- 🔒 **Zero data egress** → fail-closed privacy firewall blocks all unknown external URLs
- 📋 **Audit everything** → real-time network monitor confirms 0 outbound data connections

---

## ✨ Key Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Solo Mode** | Fully offline, zero auth, zero cloud dependency | ✅ Functional |
| **Server Mode** | Optional team collaboration — only HMAC-hashed metadata synced | ✅ Functional |
| **Natural Language Queries** | 8 intent types with confidence scoring and interactive clarification | ✅ Functional |
| **Local AI via Ollama** | Schema-obfuscated LLM calls to locally hosted models | 🔧 Behind flag |
| **In-Browser SQL Engine** | AlaSQL with parameterized queries, 100MB/500-col limits, LRU cache | ✅ Functional |
| **Statistical Analysis** | Pearson r, Spearman ρ, Point-Biserial, ANOVA, Cramer's V, BH-FDR | ✅ Functional |
| **Privacy Firewall** | Fail-closed egress, PII scanning (email/phone/SSN/CC/Aadhaar/API keys) | ✅ Functional |
| **Workspace Blueprints** | Auto-generated multi-sheet dashboards from schema profiles | ✅ Functional |
| **Feature Importance** | Ranked feature associations with leakage detection | ✅ Functional |
| **Privacy Audit Log** | Real-time network monitor with session-salted SHA-256 hashing | ✅ Functional |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Local)                        │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Pages   │→ │  Zustand     │→ │   Domain Layer    │  │
│  │  (React) │  │  Stores (3)  │  │   (Pure Logic)    │  │
│  └──────────┘  └──────────────┘  └───────┬───────────┘  │
│       │                                   │              │
│       │         ┌─────────────┐   ┌──────┴──────┐       │
│       └────────→│ UnifiedChart│   │   AlaSQL    │       │
│                 │ AnalyticsTbl│   │ (In-Memory) │       │
│                 └─────────────┘   └─────────────┘       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │        Infrastructure: Privacy Firewall           │   │
│  │   PII Scanner │ Fail-Closed Fetch │ Audit Log    │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                               │
│                    ┌─────┴─────┐                        │
│                    │ IndexedDB │  ← Solo Mode storage   │
│                    └───────────┘                        │
└──────────────────────┬──────────────────────────────────┘
                       │ (metadata only, Server Mode)
              ┌────────┴────────┐
              │ Vercel API      │
              │ (HMAC-hashed    │
              │  questions only)│
              └────────┬────────┘
              ┌────────┴────────┐
              │   Supabase      │
              │  (PostgreSQL)   │
              └─────────────────┘
```

> **Raw data NEVER leaves the browser.** In Server Mode, only HMAC-hashed question metadata and timestamps are synced.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript + Vite 7 |
| **Styling** | TailwindCSS v4 + Custom CSS Design System (43KB) |
| **State Management** | Zustand 5 (VaultStore, CockpitStore, WorkspaceStore) |
| **Charts** | Recharts 3 (Bar, Line, Area, Scatter, Pie/Donut) |
| **Animations** | Framer Motion 12 |
| **In-Browser SQL** | AlaSQL 4 |
| **CSV Parsing** | PapaParse 5 |
| **Local AI** | Ollama (localhost:11434) |
| **Local Storage** | IndexedDB + LocalStorage |
| **Server Backend** | Vercel Serverless Functions + Supabase PostgreSQL |
| **Statistics** | Custom TypeScript engine (Lanczos gamma, Student's t, F-distribution) |
| **Icons** | Lucide React |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) v18+
- [npm](https://npmjs.com) v9+
- *(Optional)* [Ollama](https://ollama.com) for AI features

### Installation

```bash
git clone https://github.com/SatyamSinghRajput04/Privana.git
cd Privana
npm install
cp .env.example .env
npm run dev
```

Open **http://localhost:5173** → Select **Solo Desktop** → Enter any passphrase → Start analyzing.

> **Solo Mode requires ZERO environment variables.** No Supabase, no API keys, no cloud.

### With Local AI

```bash
ollama pull codellama
# Privana auto-detects Ollama at http://localhost:11434
```

### With Server Mode

```bash
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — API server
node api-dev-server.mjs
```

See [docs/SETUP.md](docs/SETUP.md) for complete setup instructions including Supabase configuration.

---

## 📁 Project Structure

```
Privana/
├── api/                        # Vercel Serverless Functions (Server Mode)
│   ├── _security.js            # CORS, rate limiting, HMAC hashing
│   ├── analyze.js              # METADATA-ONLY query persistence
│   ├── workspaces.js           # Workspace CRUD (tenant-isolated)
│   ├── datasets.js             # Dataset metadata CRUD
│   ├── queries.js              # Query history CRUD
│   └── network-log.js          # Audit log sync with PII scanning
│
├── src/
│   ├── domain/                 # Pure business logic (no React deps)
│   │   ├── analytics/          # NLQ pipeline: intent → plan → execute → visualize
│   │   │   ├── executors/      # 8 intent executors (summary, correlation, etc.)
│   │   │   └── features/       # Result view components (7-state union)
│   │   ├── safeCompute/        # Statistical engine (Pearson, ANOVA, FDR)
│   │   ├── resolver/           # Fuzzy column matching (Jaro-Winkler)
│   │   ├── validator/          # Dataset profiling & PII detection
│   │   ├── verifier/           # Post-execution result verification
│   │   └── sql/                # Parameterized SQL generator
│   │
│   ├── infrastructure/firewall/# Privacy firewall & egress control
│   ├── lib/                    # AlaSQL engine, IndexedDB, schema firewall
│   ├── store/                  # Zustand stores (Vault, Cockpit, Workspace)
│   ├── pages/                  # Route components
│   ├── components/             # Shared UI (UnifiedChart, AnalyticsTable)
│   └── services/               # API client (privacyFetch-wrapped)
│
├── docs/                       # Comprehensive documentation
└── Configuration files
```

---

## 🔐 Privacy Architecture

Privana implements a **fail-closed, zero-trust** privacy model:

1. **Schema Firewall** — Column names obfuscated before LLM calls (`salary` → `c0`, `name` → `c1`)
2. **Privacy Firewall** — All `fetch()` calls intercepted; unknown external URLs **blocked by default**
3. **PII Scanner** — Emails, phones, credit cards (Luhn-validated), SSNs, Aadhaar, API keys detected and hashed
4. **Audit Log** — Every network event recorded with session-salted SHA-256 hashes in IndexedDB
5. **Metadata-Only API** — Server endpoints only store HMAC-hashed questions; `result_data: null` enforced

---

## 📊 Analytics Pipeline

```
User Question → IntentPlanner (regex/keyword) → SlotResolver (entity extraction)
     → PlanValidator (schema check) → Executor (1 of 8) → VisualContract (frozen)
     → UnifiedChart / AnalyticsTable / KPI Gauge
```

**8 Supported Intents:** `summary` · `distribution` · `grouped_average` · `correlation` · `feature_importance` · `ranking` · `filter` · `comparison`

**Confidence Scoring:** `< 0.60` → unsupported | `0.60–0.85` → interactive clarification | `> 0.85` → auto-execute

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | Problem, solution, features, status |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture with Mermaid diagrams |
| [CODEBASE_GUIDE.md](docs/CODEBASE_GUIDE.md) | Every folder & file explained |
| [SETUP.md](docs/SETUP.md) | Installation, config, deployment |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | All API endpoints with examples |
| [FEATURES.md](docs/FEATURES.md) | Detailed feature documentation |
| [TECH_DECISIONS.md](docs/TECH_DECISIONS.md) | Why each technology was chosen |
| [REVIEW_REPORT.md](docs/REVIEW_REPORT.md) | Honest architectural review with scores |
| [ROADMAP.md](docs/ROADMAP.md) | Prioritized improvement plan |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | How to contribute |

---

## 🧪 Testing

```bash
npm test                    # Run analytics domain tests
npm run test:regression     # Regression test suite
npm run eval:analytics      # Analytics evaluation suite
```

16 test files cover the analytics domain layer (executors, resolvers, validators).

---

## 🌐 Deployment

### Vercel (Recommended)

```bash
npm i -g vercel
vercel
```

Set environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Build for Production

```bash
npm run build
```

Outputs optimized chunks: `vendor-alasql`, `vendor-charts`, `vendor-core`.

---

## 🗺️ Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full roadmap. Key priorities:

- 🔴 **P0**: Remove hardcoded secrets from version control, decompose AnalyzePage.tsx
- 🟡 **P1**: CI/CD pipeline, expand test coverage to 60%+, fix auth vulnerabilities
- 🟢 **P2**: DuckDB-WASM migration, accessibility (WCAG 2.1 AA), CSV/PDF export

---

## 🤝 Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

```bash
# Quick start
git clone https://github.com/YOUR-USERNAME/Privana.git
cd Privana && npm install && npm run dev
```

**Key Rule:** All data processing MUST happen in the browser. Never send raw data externally.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for privacy-conscious data professionals.**

*Analyze freely. Share safely. Own your data.*

</div>
