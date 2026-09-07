# Enterprise Feature Tickets & Roadmap Tracking: Privana

## Epic 1: Performance & Non-Blocking Engine Architecture

### Ticket PRV-101: Main-Thread Freeze Elimination & Async Parsing
- **Priority**: P0 (Blocker)
- **Status**: In Plan Review
- **Description**: Large CSV uploads (100k+ rows) cause Chrome to display a "Page Unresponsive" dialog due to synchronous parsing and regex checks in `Papa.parse`.
- **Acceptance Criteria**:
  1. `loadCSV` parses files asynchronously without blocking UI frames.
  2. Schema profiling is bounded to max 1,000 sample rows (under 5ms execution).
  3. No main-thread UI freeze when uploading 100k+ row datasets like `olist_orders_dataset.csv`.

### Ticket PRV-102: Schema-First Caching & Skip Redundant Re-Parsing
- **Priority**: P0 (Blocker)
- **Status**: In Plan Review
- **Description**: Navigating between "Datasets" and "Analyze" pages forces a complete reload of the dataset from IndexedDB and re-parses raw CSV text synchronously.
- **Acceptance Criteria**:
  1. If `SCHEMA_PROFILES[tableName]` or in-memory table exists, skip fetching raw text from IndexedDB.
  2. Transition to `AnalyzePage` in <10ms with zero dataset parsing overhead.

### Ticket PRV-103: SQL Pushdown Aggregation Engine
- **Priority**: P1 (High)
- **Status**: In Plan Review
- **Description**: `AnalyzePage.tsx` currently calls `getTableRows(tableName, Infinity)`, sending 100,000 raw JS objects to analytical intent executors.
- **Acceptance Criteria**:
  1. `runAnalyticsQuestion()` executes SQL pushdown queries (`SELECT COUNT(*), AVG(val) GROUP BY dim`) directly on the database engine.
  2. Canvas previews limit raw row returns to `LIMIT 50`.

---

## Epic 2: Tabular-Agnostic Intelligence & Unification

### Ticket PRV-201: Single Source of Truth `ColumnProfile` Enforcement
- **Priority**: P1 (High)
- **Status**: Active
- **Description**: Enforce rule 2 (Tabular-Agnostic Card Specs) across all preset query generators, KPI cards, and chart mapping functions.
- **Acceptance Criteria**: No hardcoded dataset column names (`sleep_hours`, `gender`, `anxiety_level`) in card specifications or query builders.

### Ticket PRV-202: Unified Execution Pipeline
- **Priority**: P1 (High)
- **Status**: Active
- **Description**: All side panels, main search bar, and chat interactions must execute exclusively through `runAnalyticsQuestion()`.
- **Acceptance Criteria**: Zero duplicate SQL execution loops or side-channel statistical calculators in UI components.
