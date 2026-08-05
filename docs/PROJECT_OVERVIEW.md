# Privana - Project Overview

Privana is a privacy-first local AI analytics platform designed to solve the critical data privacy challenges inherent in modern Business Intelligence (BI) and Artificial Intelligence (AI) tools.

## The Problem

Modern BI and AI analytics tools (such as Tableau, Power BI, and Cloud LLMs) require users to upload sensitive datasets to external servers. This practice creates significant risks:
- **Regulatory Violations**: Potential breaches of GDPR, HIPAA, and other data protection regulations.
- **Intellectual Property (IP) Leakage**: Exposure of proprietary algorithms, formulas, or business metrics.
- **Zero Data Sovereignty**: Loss of control over where and how data is stored and processed.

## The Solution

Privana inverts the traditional trust model. The entire analytical pipeline runs **locally** on the user's machine:
- CSV files are parsed directly in-browser—they never touch a server.
- Plain English questions are converted to SQL locally using an Ollama LLM.
- Statistical analysis is executed entirely on the user's CPU.
- **Zero bytes of raw data ever leave the device.**

## Target Users

- Data Professionals
- Compliance-Conscious Enterprises
- Healthcare Analysts
- Financial Analysts
- HR Teams (handling sensitive employee data)
- Privacy-Conscious Researchers

## Key Features

| Feature | Description |
|---|---|
| **Solo Mode** | Fully offline operation with zero authentication and zero cloud dependency. |
| **Server Mode** | Optional team collaboration where only metadata is synced; raw data remains local. |
| **Natural Language Queries** | Users can ask questions in plain English and receive charts and insights. |
| **Local AI via Ollama** | Connects to locally hosted LLMs (e.g., CodeLlama, Llama 3) for processing. |
| **In-Browser SQL Engine** | Powered by AlaSQL to run SQL queries entirely inside the browser environment. |
| **Statistical Analysis Engine** | Computes Pearson r, Spearman ρ, Point-Biserial, ANOVA, Cramer's V, Chi-Square, Benjamini-Hochberg FDR correction, OLS regression, and p-values locally. |
| **Schema Firewall** | Obfuscates column names before any calls are made to the LLM to protect data structure. |
| **Privacy Firewall** | Implements fail-closed egress control and PII scanning for emails, phones, SSNs, credit cards, and API keys. |
| **Privacy Audit Log** | Network monitor confirming zero outbound data connections for raw data. |
| **Workspace Blueprint System** | Auto-generates multi-sheet analytical dashboards. |
| **Feature Importance Engine** | Ranks feature associations utilizing various statistical methods. |
| **Interactive Clarification** | When query confidence falls between 60-85%, users can select from suggested paths to refine queries. |

## Tech Stack

| Category | Technology |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite 7 |
| **Styling** | TailwindCSS v4 + Custom CSS Design System |
| **State Management** | Zustand 5 (VaultStore, CockpitStore, WorkspaceStore) |
| **Charts & Animations** | Recharts 3 + Framer Motion 12 |
| **In-Browser SQL** | AlaSQL 4 |
| **CSV Parsing** | PapaParse 5 |
| **Local AI** | Ollama (localhost:11434) |
| **Local Storage** | IndexedDB + LocalStorage |
| **Server Mode Backend**| Vercel Serverless Functions + Supabase PostgreSQL |
| **Icons** | Lucide React |

## Current Status

- **Stage**: MVP/Alpha
- **Functionality**: The core analytics pipeline is functional. Solo mode operates fully offline, and Server mode works via Vercel + Supabase.
- **Testing**: The project currently has 16 unit tests covering the analytics domain layer.
- **Technical Debt**: `AnalyzePage.tsx` is a large 210KB monolith that requires refactoring.
- **Ongoing Work**: There is an active migration from a legacy inline analytics pipeline to a new, robust domain-driven architecture.

## High-Level Architecture

Privana operates as a Client-side React Single Page Application (SPA) with a local-first architecture. The Domain layer handles all computation, the Infrastructure layer provides the privacy firewall, and an optional serverless API layer handles metadata synchronization.

```mermaid
graph TD
    subgraph Client Application [User Machine - Local Processing]
        UI[React UI / Workspace]
        
        subgraph Domain Layer
            NLP[Natural Language Engine]
            SQL[AlaSQL Engine]
            Stat[Statistical Analysis Engine]
            Features[Feature Importance Engine]
        end
        
        subgraph Infrastructure Layer
            SchemaFW[Schema Firewall]
            PrivacyFW[Privacy Firewall / PII Scanner]
            Storage[IndexedDB / LocalStorage]
        end
        
        UI -->|Plain English| NLP
        NLP <-->|Obfuscated Schema| SchemaFW
        SchemaFW <-->|Prompt/SQL| LocalLLM[(Ollama - Localhost)]
        
        UI -->|Raw CSV| PrivacyFW
        PrivacyFW -->|Clean Data| SQL
        NLP -->|Generated SQL| SQL
        
        SQL -->|Data Views| Stat
        SQL -->|Data Views| Features
        
        Stat -->|Results| UI
        Features -->|Results| UI
        SQL -->|Raw Output| UI
        
        PrivacyFW <--> Storage
    end

    subgraph Optional Cloud [Metadata Only]
        Vercel[Vercel Serverless Functions]
        Supabase[(Supabase PostgreSQL)]
    end

    UI -.->|Sync Metadata Only| Vercel
    Vercel -.-> Supabase

    classDef local fill:#e6f3ff,stroke:#0066cc,stroke-width:2px
    classDef cloud fill:#f9f9f9,stroke:#999,stroke-width:1px,stroke-dasharray: 5 5
    
    class Client Application,Domain Layer,Infrastructure Layer local
    class Optional Cloud,Vercel,Supabase cloud
```
