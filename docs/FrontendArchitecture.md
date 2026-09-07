# Enterprise Frontend Architecture Specification: Privana

## 1. UI Component Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REACT APP (App.tsx)                              │
│                                                                             │
│  ┌─────────────────────────┐                   ┌─────────────────────────┐  │
│  │   DatasetsPage.tsx      │                   │     AnalyzePage.tsx     │  │
│  │  (File Upload & Meta)   │                   │  (Query, Chart & Q&A)   │  │
│  └────────────┬────────────┘                   └────────────┬────────────┘  │
│               │                                             │               │
│               ▼                                             ▼               │
│  ┌─────────────────────────┐                   ┌─────────────────────────┐  │
│  │    DatasetValidator     │                   │  QueryResultCanvas.tsx  │  │
│  │   (Profile & PII)       │                   │   (Recharts Renderers)  │  │
│  └────────────┬────────────┘                   └────────────┬────────────┘  │
│               │                                             │               │
│               └──────────────────────┬──────────────────────┘               │
│                                      │                                      │
│                                      ▼                                      │
│                        ┌───────────────────────────┐                        │
│                        │   runAnalyticsQuestion()  │                        │
│                        │   (Unified Domain Layer)  │                        │
│                        └───────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Dynamic Design System & State Rules

### State Management Stores (`src/store/`)
- `useWorkspaceStore`: Active workspace context, dataset lists, active tab selection.
- `useVaultStore`: PII redaction settings, privacy policy constraints, audit logs.
- `useAnswerWorkspaceStore`: Multi-chart compound question answers and Q&A card stacks.
- `useCockpitStore`: Local UI navigation state and modal controls.

### Non-Blocking UI Contract
1. **Immediate Feedback**: Buttons like "🔍 Analyze" trigger immediate route transitions to `AnalyzePage` with skeletons, yielding to the browser event loop before launching heavy analytical tasks.
2. **Fluid Responsiveness**: Layouts adapt dynamically to container bounds without arbitrary pixel offsets or hardcoded column names.
3. **No Decorative Fluff**: Data density, scannability, and high-performance charting take precedence over visual clutter.
