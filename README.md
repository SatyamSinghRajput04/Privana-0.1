<div align="center">

# 🔒 Privana

### Privacy-First Local AI Analytics Platform

**Analyze sensitive datasets with AI — without sending a single byte to the cloud.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Built with React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Powered by Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)](https://vitejs.dev)
[![Local AI](https://img.shields.io/badge/AI-Ollama%20Local-orange)](https://ollama.com)

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

- 📂 **Upload CSV** → parsed in-browser (never touches a server)
- 🗣️ **Ask in plain English** → AI generates SQL locally via Ollama
- 📊 **Get instant charts** → statistical analysis runs on your CPU
- 🔒 **Zero data egress** → 0 bytes of raw data ever leave your device

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Solo Mode** | Fully offline, zero auth, zero cloud dependency |
| **Natural Language Queries** | Ask questions in English, get charts and insights |
| **Local AI via Ollama** | Connects to locally hosted LLMs (CodeLlama, Llama 3, etc.) |
| **In-Browser SQL Engine** | AlaSQL runs SQL queries entirely inside the browser |
| **Statistical Analysis** | Pearson r, Spearman ρ, OLS regression, p-values — all computed locally |
| **Privacy Audit Log** | Network monitor confirms 0 outbound data connections |
| **Server Mode** | Optional team collaboration — only metadata synced, raw data stays local |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript + Vite 7 |
| **Styling** | TailwindCSS v4 + Custom CSS Design System |
| **State Management** | Zustand 5 |
| **Charts** | Recharts 3 (Bar, Line, Pie, Scatter, Composed) |
| **Animations** | Framer Motion 12 |
| **In-Browser SQL** | AlaSQL 4 |
| **CSV Parsing** | PapaParse 5 |
| **Local AI** | Ollama (localhost:11434) |
| **Local Storage** | IndexedDB + LocalStorage |
| **Server Mode Backend** | Vercel Serverless Functions + Supabase PostgreSQL |
| **Icons** | Lucide React |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- [npm](https://npmjs.com) v9 or higher
- *(Optional, for AI features)* [Ollama](https://ollama.com) installed and running locally

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/SatyamSinghRajput04/Privana.git
cd Privana

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and fill in your values (only needed for Server Mode)

# 4. Start the development server
npm run dev
```

Open your browser at **http://localhost:5173**

### Running with Local AI (Optional)

To enable natural language query generation via a local LLM:

```bash
# Install Ollama from https://ollama.com
# Then pull a code model:
ollama pull codellama

# Privana will auto-detect Ollama at http://localhost:11434
```

---

## 📁 Project Structure

```
Privana/
├── api/                    # Vercel Serverless API functions (Server Mode)
│   ├── analyze.js          # AI intent classification + SQL generation
│   ├── workspaces.js       # Workspace CRUD
│   ├── datasets.js         # Dataset metadata CRUD
│   ├── queries.js          # Query history CRUD
│   └── saved.js            # Bookmarks CRUD
│
├── src/
│   ├── components/         # Shared UI components
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   ├── VaultChart.tsx  # Universal chart renderer
│   │   └── NetworkMonitor.tsx
│   │
│   ├── pages/              # Full-page route components
│   │   ├── LandingPage.tsx # Auth gate + mode selection
│   │   ├── AnalyzePage.tsx # Core analytics surface
│   │   ├── DatasetsPage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── SavedPage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── store/
│   │   └── useVaultStore.ts # Global state (Zustand) + dual-mode dispatch
│   │
│   ├── lib/
│   │   ├── sqlEngine.ts    # AlaSQL wrapper + NLQ → SQL generation
│   │   ├── indexedDb.ts    # Local persistence layer
│   │   ├── schemaFirewall.ts # Column name obfuscation for privacy
│   │   └── supabase.ts     # Supabase client (Server Mode only)
│   │
│   └── index.css           # Design system tokens + component styles
│
├── .env.example            # Environment variable template
├── vercel.json             # Vercel deployment config
├── vite.config.ts          # Build configuration
└── package.json
```

---

## 🔐 Privacy Architecture

Privana implements a layered privacy model:

```
Your CSV File
     │
     ▼  (parsed in-browser by PapaParse)
Browser Memory (AlaSQL in-memory table)
     │
     ├──[Solo Mode]──→ IndexedDB (on-device only)
     │                  Analysis runs on local CPU
     │                  0 bytes sent externally ✅
     │
     └──[Server Mode]──→ Only column metadata sent to server
                          Raw row data stays in browser
                          result_data: [] enforced ✅
```

**Schema Firewall**: Before any LLM call, column names are obfuscated (`salary` → `c1`). The LLM never sees your actual column names or data.

---

## 🌐 Deployment

### Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Set these environment variables in your Vercel dashboard (for Server Mode):
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Run API locally (with frontend)

```bash
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — API server
node api-dev-server.mjs
```

The frontend proxies `/api/*` requests to the local API server automatically.

---

## 🗺️ Roadmap

- [ ] Passphrase-encrypted IndexedDB (Web Crypto API AES-256)
- [ ] Full Ollama NLQ → SQL pipeline (schema firewall integrated)
- [ ] Tauri desktop app (native file system + real network monitoring)
- [ ] Web Workers for large dataset processing
- [ ] Export to PDF / PNG report

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for privacy-conscious data professionals.**

*Analyze freely. Share safely. Own your data.*

</div>
