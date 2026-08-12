<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

---

### 🛡️ Analytics Unification & Tabular-Agnostic Rules

1. **Unified Pipeline Enforcement**:
   - Every analytical query (whether entered via the main search bar, preset suggestions, or floating chat assistants) MUST route through the single unified execution domain layer (`runAnalyticsQuestion()`). 
   - Never allow chat components or side panels to maintain duplicate statistical calculation loops or legacy SQL executors.

2. **Tabular-Agnostic Card Specs**:
   - Layout blueprints and schema profiles must be derived dynamically using column types (numeric vs. categorical) and naming heuristics (e.g. matching suffixes like `_level`, `_index`, `_score`).
   - Never hardcode dataset-specific column names (`gender`, `sleep_hours`, `anxiety_level`) in card specifications, SQL generators, or visual contract mappers.

3. **Compiler Invariant Verification**:
   - Always run an explicit execution test (using a scratch runner or test suite) against files modified during refactoring. 
   - Do not rely solely on incremental `tsc` checks as caching can mask dangling braces or import syntax errors in unreferenced paths.

4. **Single Source of Truth**:
   - Every analytical visualization, KPI, table, AI explanation, workspace card, or exported report must originate from the same immutable `AnalyticsResult` snapshot.
   - No component may independently recompute, reinterpret, or fabricate analytical values after execution.

5. **Immutable Analytical Snapshot**:
   - Once an `AnalyticsResult` has been committed, it becomes immutable.
   - Filtering, sorting, visualization, AI narratives, and exports must consume the snapshot, never mutate it.
