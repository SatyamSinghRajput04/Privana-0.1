// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/distribution.ts
// S8b DISTRIBUTION EXECUTOR — Pure function for histogram & categorical frequencies.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';

export const DistributionExecutor = {
  /**
   * Computes frequencies for categorical columns or histogram bins for numeric columns.
   */
  execute(plan: AnalysisPlan, rows: any[]): ExecutorResult {
    const metric = plan.metric;
    if (!metric || !rows || rows.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    const vals = rows.map(r => r[metric]).filter(v => v !== null && v !== undefined && v !== '');
    if (vals.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    // Check if numeric
    const numericVals = vals.map(v => Number(v)).filter(v => !isNaN(v));
    const isNumeric = numericVals.length > 0 && (numericVals.length / vals.length) > 0.8;

    const distributionRows: any[] = [];

    if (isNumeric) {
      // Compute histogram bins (Sturges' formula or fixed bins, let's do 5 simple uniform bins)
      const sorted = [...numericVals].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const range = max - min;

      if (range === 0) {
        distributionRows.push({
          binLabel: `${min}`,
          count: numericVals.length,
          minVal: min,
          maxVal: max,
        });
      } else {
        const binCount = Math.min(5, numericVals.length);
        const binWidth = range / binCount;

        for (let i = 0; i < binCount; i++) {
          const start = min + i * binWidth;
          const end = start + binWidth;
          // Include upper bound on last bin
          const count = numericVals.filter(v => 
            i === binCount - 1 ? (v >= start && v <= end) : (v >= start && v < end)
          ).length;

          distributionRows.push({
            binLabel: `${start.toFixed(1)} - ${end.toFixed(1)}`,
            count,
            minVal: start,
            maxVal: end,
          });
        }
      }
    } else {
      // Categorical frequency
      const counts: Record<string, number> = {};
      for (const val of vals) {
        const s = String(val);
        counts[s] = (counts[s] || 0) + 1;
      }

      for (const [key, count] of Object.entries(counts)) {
        distributionRows.push({
          category_label: key,
          count,
        });
      }
    }

    return {
      status: rows.length < 5 ? 'partial_small_n' : 'success',
      rows: distributionRows,
      metadata: {
        metric,
        isNumeric,
      }
    };
  }
};
