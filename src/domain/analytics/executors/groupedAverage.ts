// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/groupedAverage.ts
// S8c GROUPED AVERAGE EXECUTOR — Computes metric averages grouped by a category.
//
// Stage 2.1 reference migration: data retrieval/aggregation now goes through
// ComputeEngine.groupedAggregate() instead of a hand-rolled accumulator loop.
// This executor owns everything ABOUT the result (ranking, small-cell status,
// metadata) — the engine only fetches the numbers. RankingExecutor's grouped
// path calls this executor directly, so it picks up the same engine boundary
// automatically with no changes of its own.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';
import { computeEngine } from '../../compute';

export const GroupedAverageExecutor = {
  /**
   * Computes average values of plan.metric grouped by plan.groupBy columns.
   */
  execute(plan: AnalysisPlan, rows: any[]): ExecutorResult {
    const metric = plan.metric;
    const groupBy = plan.groupBy;

    if (!metric || !groupBy || groupBy.length === 0 || !rows || rows.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    const groupKeyCol = groupBy[0]; // Currently supporting single group-by column MVP
    const resultRows = computeEngine.groupedAggregate(rows, metric, groupKeyCol);

    // Sort by average descending (highest average first) — a ranking/
    // presentation decision, not a data-access one, so it stays here.
    resultRows.sort((a, b) => b.average_value - a.average_value);

    // Check if any group cell count is below 5 (potential privacy suppression warning/state)
    const hasSmallCells = resultRows.some(r => r.count < 5);

    return {
      status: hasSmallCells ? 'partial_small_n' : 'success',
      rows: resultRows,
      metadata: {
        metric,
        groupByCol: groupKeyCol
      }
    };
  }
};
