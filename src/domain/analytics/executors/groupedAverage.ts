// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/groupedAverage.ts
// S8c GROUPED AVERAGE EXECUTOR — Computes metric averages grouped by a category.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';

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

    // Grouping calculations
    const groupKeyCol = groupBy[0]; // Currently supporting single group-by column MVP
    const groups: Record<string, { sum: number; count: number }> = {};

    for (const r of rows) {
      const gVal = r[groupKeyCol];
      const mVal = Number(r[metric]);

      if (gVal === null || gVal === undefined || isNaN(mVal)) continue;

      const key = String(gVal);
      if (!groups[key]) {
        groups[key] = { sum: 0, count: 0 };
      }
      groups[key].sum += mVal;
      groups[key].count++;
    }

    const resultRows = Object.entries(groups).map(([groupVal, stats]) => ({
      category_label: groupVal,
      average_value: stats.sum / stats.count,
      count: stats.count
    }));

    // Sort by average descending (highest average first)
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
