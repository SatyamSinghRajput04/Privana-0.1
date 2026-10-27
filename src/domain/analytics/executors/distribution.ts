// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/distribution.ts
// S8b DISTRIBUTION EXECUTOR — Pure function for histogram & categorical frequencies.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';
import { computeEngine, ComputeEngine, DataSource, MaybePromise } from '../../compute';

export const DistributionExecutor = {
  /**
   * Computes frequencies for categorical columns or histogram bins for numeric columns.
   * Agnostic to data storage: accepts either in-memory row array or DuckDB table source.
   */
  execute(
    plan: AnalysisPlan,
    source: DataSource | any[],
    engine: ComputeEngine = computeEngine
  ): MaybePromise<ExecutorResult> {
    const metric = plan.metric;
    if (!metric || !source) {
      return { status: 'partial_missing', rows: [] };
    }
    if (Array.isArray(source) && source.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    const resOrPromise = engine.distribution(source, metric);

    const format = (distResult: any): ExecutorResult => {
      if (!distResult || distResult.totalCount === 0) {
        return { status: 'partial_missing', rows: [] };
      }

      const totalEligibleRows = distResult.totalCount;

      return {
        status: distResult.totalCount < 5 ? 'partial_small_n' : 'success',
        rows: distResult.rows,
        metadata: {
          metric,
          isNumeric: distResult.isNumeric,
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
