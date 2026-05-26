// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/summary.ts
// S8a SUMMARY EXECUTOR — Pure function for row count & descriptive statistics.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';

export const SummaryExecutor = {
  /**
   * Computes dataset metrics, null/missing counts, and numeric descriptive stats.
   */
  execute(plan: AnalysisPlan, rows: any[]): ExecutorResult {
    if (!rows || rows.length === 0) {
      return {
        status: 'partial_missing',
        rows: [],
        metadata: { rowCount: 0 }
      };
    }

    // Determine target columns to summarize
    const keys = Object.keys(rows[0]);
    const summaryRows: any[] = [];

    for (const key of keys) {
      if (key === 'id') continue;

      const vals = rows.map(r => r[key]).filter(v => v !== null && v !== undefined && v !== '');
      const missingCount = rows.length - vals.length;

      // Check if mostly numeric
      const numericVals = vals.map(v => Number(v)).filter(v => !isNaN(v));
      const isNumeric = numericVals.length > 0 && (numericVals.length / vals.length) > 0.8;

      if (isNumeric) {
        const sum = numericVals.reduce((acc, curr) => acc + curr, 0);
        const avg = sum / numericVals.length;
        const sorted = [...numericVals].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];

        summaryRows.push({
          columnName: key,
          type: 'numeric',
          min,
          max,
          avg,
          missingCount,
        });
      } else {
        // Categorical stats
        const counts: Record<string, number> = {};
        let uniqueCount = 0;
        let topVal = '';
        let maxCount = 0;

        for (const val of vals) {
          const s = String(val);
          if (!counts[s]) {
            counts[s] = 0;
            uniqueCount++;
          }
          counts[s]++;
          if (counts[s] > maxCount) {
            maxCount = counts[s];
            topVal = s;
          }
        }

        summaryRows.push({
          columnName: key,
          type: 'categorical',
          uniqueCount,
          topValue: topVal,
          missingCount,
        });
      }
    }

    return {
      status: rows.length < 5 ? 'partial_small_n' : 'success',
      rows: summaryRows,
      metadata: {
        rowCount: rows.length,
        planId: plan.planId
      }
    };
  }
};
