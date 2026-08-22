// ─────────────────────────────────────────────────────────────────────────────
// src/domain/compute/ComputeEngine.ts
// COMPUTE ENGINE — the architectural boundary between "what statistic does
// this executor need" and "how is it actually retrieved/aggregated".
//
//   AnalysisPlan → Executor → ComputeEngine → raw statistical inputs →
//   Statistics layer (formulas, significance, zero-variance guards) →
//   AnalyticsResult
//
// A ComputeEngine implementation is DELIBERATELY dumb: it retrieves and
// aggregates data, nothing more. It never decides what a result MEANS —
// formulas (Pearson's r, ANOVA's F-statistic, Benjamini-Hochberg correction,
// zero-variance handling) stay in the executor / statistics layer, which is
// engine-agnostic and shared across every implementation of this interface.
// That split is what lets a second implementation (e.g. DuckDB-Wasm) slot in
// later without touching executor code or re-deriving/re-testing any math.
//
// Stage 2.1 (current): only groupedAggregate exists, backing
// GroupedAverageExecutor (and, by composition, RankingExecutor's grouped
// path, which already delegates to GroupedAverageExecutor). Further methods
// (moments, contingencyTable, distribution, samplePoints) are added only
// when a specific executor migration actually needs them — the interface
// grows from real call sites, not speculative design.
// ─────────────────────────────────────────────────────────────────────────────

export interface GroupedAggregateRow {
  category_label: string;
  average_value: number;
  count: number;
}

export interface ComputeEngine {
  /**
   * Average of `metric` grouped by `groupBy`, one row per distinct group
   * value present in the (already null/non-numeric filtered) data. Row
   * order is retrieval order, not ranked — ranking/sorting is an executor
   * concern, not a data-access concern.
   */
  groupedAggregate(rows: any[], metric: string, groupBy: string): GroupedAggregateRow[];
}
