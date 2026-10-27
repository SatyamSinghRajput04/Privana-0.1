// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/groupedAverage.ts
// S8c GROUPED AVERAGE EXECUTOR — Computes metric averages grouped by a category.
//
// Stage 2.1 reference migration: data retrieval/aggregation goes through
// ComputeEngine.groupedAggregate() instead of a hand-rolled accumulator loop.
// This executor owns everything ABOUT the result (ranking, small-cell status,
// metadata) — the engine only fetches the numbers.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';
import { computeEngine, ComputeEngine, DataSource, MaybePromise } from '../../compute';

export const GroupedAverageExecutor = {
  /**
   * Computes average values of plan.metric grouped by plan.groupBy columns.
   * Agnostic to data storage: accepts either in-memory row array or DuckDB table source.
   */
  execute(
    plan: AnalysisPlan,
    source: DataSource | any[],
    engine: ComputeEngine = computeEngine
  ): MaybePromise<ExecutorResult> {
    const metric = plan.metric;
    const groupBy = plan.groupBy;

    if (!metric || !groupBy || groupBy.length === 0 || !source) {
      return { status: 'partial_missing', rows: [] };
    }
    if (Array.isArray(source) && source.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    const groupKeyCol = groupBy[0]; // Currently supporting single group-by column MVP
    const resOrPromise = engine.groupedAggregate(source, metric, groupKeyCol);

    const format = (resultRows: any[]): ExecutorResult => {
      if (!resultRows || resultRows.length === 0) {
        return { status: 'partial_missing', rows: [] };
      }

      // Sort by average descending (highest average first) — presentation decision
      resultRows.sort((a, b) => b.average_value - a.average_value);

      // Denominator tracking: count eligible rows across all groups
      const totalEligibleRows = resultRows.reduce((sum, r) => sum + (Number(r.count) || 0), 0);

      // Check if any group cell count is below 5 (privacy suppression flag)
      const hasSmallCells = resultRows.some(r => r.count < 5);

      return {
        status: hasSmallCells ? 'partial_small_n' : 'success',
        rows: resultRows,
        metadata: {
          metric,
          groupByCol: groupKeyCol,
          totalEligibleRows
        }
      };
    };

    if (resOrPromise instanceof Promise) {
      return resOrPromise.then(format);
    }
    return format(resOrPromise);
  }
};
