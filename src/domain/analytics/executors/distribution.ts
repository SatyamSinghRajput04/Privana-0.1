// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/distribution.ts
// S8b DISTRIBUTION EXECUTOR — Pure function for histogram & categorical frequencies.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';
import { computeEngine } from '../../compute';

export const DistributionExecutor = {
  /**
   * Computes frequencies for categorical columns or histogram bins for numeric columns.
   */
  execute(plan: AnalysisPlan, rows: any[]): ExecutorResult {
    const metric = plan.metric;
    if (!metric || !rows || rows.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    const distResult = computeEngine.distribution(rows, metric);

    if (distResult.totalCount === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    return {
      status: rows.length < 5 ? 'partial_small_n' : 'success',
      rows: distResult.rows,
      metadata: {
        metric,
        isNumeric: distResult.isNumeric,
      }
    };
  }
};
