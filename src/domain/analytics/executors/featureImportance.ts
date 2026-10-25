// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/featureImportance.ts
// S8e FEATURE IMPORTANCE EXECUTOR — Wraps the safeCompute domain stats engine.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';
import { runSafeCompute } from '../../safeCompute';

export const FeatureImportanceExecutor = {
  /**
   * Calculates ranked feature associations by leveraging the safeCompute engine.
   */
  execute(plan: AnalysisPlan, rows: any[]): ExecutorResult {
    const target = plan.target;
    if (!target || !rows || rows.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    // Build the query and run safeCompute
    const result = runSafeCompute({
      question: `Which feature has the strongest relationship with ${target}?`,
      tableName: plan.datasetHash || 'dataset.csv',
      rows,
    });

    if (result.status === 'blocked') {
      return {
        status: 'partial_missing',
        rows: [],
        metadata: {
          reason: 'SafeCompute block: ' + (result.reason || 'Privacy or data quality blocker.')
        }
      };
    }

    if (result.status === 'unsupported') {
      return {
        status: 'partial_missing',
        rows: [],
        metadata: {
          reason: 'SafeCompute unsupported: ' + (result.reason || 'Unsupported statistical path.')
        }
      };
    }

    // Map safeCompute output rows to executor rows format
    // safeCompute returns features ranked by score
    const associationRows = (result.rows || []).map((r: any) => ({
      feature: r.feature,
      association: r.score || 0,
      method: r.method,
      pValue: r.rawPValue,
    }));

    return {
      status: 'success',
      rows: associationRows,
      metadata: {
        target,
        excludedFeatures: result.excludedFeatures || [],
        targetSummary: result.targetSummary
      }
    };
  }
};
