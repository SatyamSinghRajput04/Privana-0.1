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

    const rowCount = rows.length;
    for (const key of keys) {
      if (key === 'id') continue;

      let missingCount = 0;
      let numericCount = 0;
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;

      const counts: Record<string, number> = {};
      let uniqueCount = 0;
      let topVal = '';
      let maxCount = 0;

      // Single O(N) pass per column (no array allocations)
      for (let i = 0; i < rowCount; i++) {
        const v = rows[i][key];
        if (v === null || v === undefined || v === '') {
          missingCount++;
          continue;
        }

        const numV = Number(v);
        // Exclude booleans from being cast to 0/1 numerics if we are strictly treating as numbers
        if (!isNaN(numV) && typeof v !== 'boolean') {
          numericCount++;
          sum += numV;
          if (numV < min) min = numV;
          if (numV > max) max = numV;
        } else {
          const s = String(v);
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
      }

      const presentCount = rowCount - missingCount;
      const isNumeric = presentCount > 0 && numericCount > 0 && (numericCount / presentCount) > 0.8;

      if (isNumeric) {
        summaryRows.push({
          columnName: key,
          type: 'numeric',
          min: min === Infinity ? 0 : min,
          max: max === -Infinity ? 0 : max,
          avg: numericCount > 0 ? sum / numericCount : 0,
          missingCount,
        });
      } else {
        // Fallback for categorical values
        // To be 100% accurate we'd recount the `numV` values as strings,
        // but for a summary, relying on what we parsed as strings + uniqueCount is often enough.
        // Actually, let's just do a quick string tally for the numeric values we skipped:
        if (numericCount > 0) {
          for (let i = 0; i < rowCount; i++) {
            const v = rows[i][key];
            if (v === null || v === undefined || v === '') continue;
            const s = String(v);
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
