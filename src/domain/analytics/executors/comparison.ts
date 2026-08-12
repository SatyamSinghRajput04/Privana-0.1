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
    const groupStats: Record<string, { sum: number; count: number; min: number; max: number }> = {};

    for (let i = 0; i < rows.length; i++) {
      const gVal = rows[i][groupKeyCol];
      const mVal = Number(rows[i][metric]);

      if (gVal === null || gVal === undefined || isNaN(mVal)) continue;

      const key = String(gVal);
      if (!groupStats[key]) {
        groupStats[key] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
      }
      groupStats[key].sum += mVal;
      groupStats[key].count++;
      if (mVal < groupStats[key].min) groupStats[key].min = mVal;
      if (mVal > groupStats[key].max) groupStats[key].max = mVal;
    }

    // Filter comparison groups if filters are specified for the groupBy column
    const allowedGroupVals = new Set<string>();
    if (plan.filters) {
      for (const filter of plan.filters) {
        if (filter.column === groupKeyCol && filter.operator === '=') {
          allowedGroupVals.add(String(filter.value).toLowerCase());
        }
      }
    }

    const comparisonRows = Object.entries(groupStats)
      .filter(([groupVal]) => {
        if (allowedGroupVals.size === 0) return true;
        return allowedGroupVals.has(groupVal.toLowerCase());
      })
      .map(([groupVal, stats]) => {
        const mean = stats.sum / stats.count;
        return {
          group_label: groupVal,
          mean,
          count: stats.count,
          min: stats.min,
          max: stats.max,
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
