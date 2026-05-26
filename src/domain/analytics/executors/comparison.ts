// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/comparison.ts
// S8h COMPARISON EXECUTOR — Computes differences in metrics across groups.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';

export const ComparisonExecutor = {
  /**
   * Computes statistics comparing plan.metric values across groups in plan.groupBy.
   */
  execute(plan: AnalysisPlan, rows: any[]): ExecutorResult {
    const metric = plan.metric;
    const groupBy = plan.groupBy;

    if (!metric || !groupBy || groupBy.length === 0 || !rows || rows.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    const groupKeyCol = groupBy[0];
    const groupStats: Record<string, number[]> = {};

    for (const r of rows) {
      const gVal = r[groupKeyCol];
      const mVal = Number(r[metric]);

      if (gVal === null || gVal === undefined || isNaN(mVal)) continue;

      const key = String(gVal);
      if (!groupStats[key]) {
        groupStats[key] = [];
      }
      groupStats[key].push(mVal);
    }

    const comparisonRows = Object.entries(groupStats).map(([groupVal, vals]) => {
      const sorted = [...vals].sort((a, b) => a - b);
      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = sum / vals.length;
      const min = sorted[0];
      const max = sorted[sorted.length - 1];

      return {
        group_label: groupVal,
        mean,
        count: vals.length,
        min,
        max,
      };
    });

    const hasSmallCells = comparisonRows.some(r => r.count < 5);

    return {
      status: hasSmallCells ? 'partial_small_n' : 'success',
      rows: comparisonRows,
      metadata: {
        metric,
        groupByCol: groupKeyCol,
        comparedGroupsCount: comparisonRows.length,
      }
    };
  }
};
