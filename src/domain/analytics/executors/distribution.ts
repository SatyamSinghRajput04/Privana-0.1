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

    const numericVals: number[] = [];
    const categoricalCounts: Record<string, number> = {};
    let presentCount = 0;
    let hasNonInteger = false;
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < rows.length; i++) {
      const v = rows[i][metric];
      if (v === null || v === undefined || v === '') continue;
      presentCount++;

      const numV = Number(v);
      if (!isNaN(numV) && typeof v !== 'boolean') {
        numericVals.push(numV);
        if (numV < min) min = numV;
        if (numV > max) max = numV;
        if (!Number.isInteger(numV)) hasNonInteger = true;
      } else {
        const s = String(v);
        categoricalCounts[s] = (categoricalCounts[s] || 0) + 1;
      }
    }

    if (presentCount === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    let uniqueNumericSize = 0;
    if (hasNonInteger) {
      uniqueNumericSize = 11;
    } else {
      const tempSet = new Set<number>();
      for (let i = 0; i < numericVals.length; i++) {
        tempSet.add(numericVals[i]);
        if (tempSet.size > 10) {
          uniqueNumericSize = 11;
          break;
        }
      }
      uniqueNumericSize = tempSet.size;
    }

    const isNumeric = numericVals.length > 0 && 
                      (numericVals.length / presentCount) > 0.8 &&
                      (uniqueNumericSize > 10 || hasNonInteger);

    const distributionRows: any[] = [];

    if (isNumeric) {
      const range = max - min;
      if (range === 0) {
        distributionRows.push({
          binRange: `${min}`,
          binLabel: `${min}`,
          count: numericVals.length,
          minVal: min,
          maxVal: max,
        });
      } else {
        const binCount = Math.ceil(Math.log2(numericVals.length) + 1);
        const binWidth = range / binCount;
        const counts = new Array(binCount).fill(0);

        for (let i = 0; i < numericVals.length; i++) {
          const v = numericVals[i];
          let binIndex = Math.floor((v - min) / binWidth);
          if (binIndex >= binCount) binIndex = binCount - 1;
          if (binIndex < 0) binIndex = 0;
          counts[binIndex]++;
        }

        for (let i = 0; i < binCount; i++) {
          const start = min + i * binWidth;
          const end = start + binWidth;
          const label = `${start.toFixed(1)} - ${end.toFixed(1)}`;
          distributionRows.push({
            binRange: label,
            binLabel: label,
            count: counts[i],
            minVal: start,
            maxVal: end,
          });
        }
      }
    } else {
      // Add back the numbers we collected as strings
      for (let i = 0; i < numericVals.length; i++) {
        const s = String(numericVals[i]);
        categoricalCounts[s] = (categoricalCounts[s] || 0) + 1;
      }

      for (const [key, count] of Object.entries(categoricalCounts)) {
        distributionRows.push({
          binRange: key,
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
