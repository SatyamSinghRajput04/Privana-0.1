// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/filter.ts
// S8g FILTER EXECUTOR — Pure function to filter records by plan criteria.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';

export const FilterExecutor = {
  /**
   * Applies the list of filters to rows.
   */
  execute(plan: AnalysisPlan, rows: any[]): ExecutorResult {
    if (!rows || rows.length === 0) {
      return { status: 'success', rows: [] };
    }

    const filters = plan.filters || [];
    if (filters.length === 0) {
      return {
        status: rows.length < 5 ? 'partial_small_n' : 'success',
        rows,
        metadata: { filterCount: 0 }
      };
    }

    const filteredRows = rows.filter(r => {
      // Must satisfy all filters
      for (const filter of filters) {
        const colVal = r[filter.column];
        const targetVal = filter.value;

        if (colVal === null || colVal === undefined) return false;

        const val = Number(colVal);
        const targetNum = Number(targetVal);

        // If numeric comparison is possible
        const isNumericCompare = !isNaN(val) && !isNaN(targetNum);

        switch (filter.operator) {
          case '=':
            if (String(colVal).toLowerCase().trim() !== String(targetVal).toLowerCase().trim()) return false;
            break;
          case '!=':
            if (String(colVal).toLowerCase().trim() === String(targetVal).toLowerCase().trim()) return false;
            break;
          case '>':
            if (!isNumericCompare || val <= targetNum) return false;
            break;
          case '<':
            if (!isNumericCompare || val >= targetNum) return false;
            break;
          case '>=':
            if (!isNumericCompare || val < targetNum) return false;
            break;
          case '<=':
            if (!isNumericCompare || val > targetNum) return false;
            break;
          case 'contains':
            if (!String(colVal).toLowerCase().includes(String(targetVal).toLowerCase())) return false;
            break;
        }
      }
      return true;
    });

    return {
      status: 'success',
      rows: filteredRows,
      metadata: {
        filterCount: filters.length,
        originalCount: rows.length
      }
    };
  }
};
