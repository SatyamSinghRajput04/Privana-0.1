// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/correlation.ts
// S8d CORRELATION EXECUTOR — Pure function for statistical correlation.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';
import {
  getPearsonCorrelation,
  getSpearmanCorrelation,
  resolveBinaryMapping,
  computePointBiserial,
  testCorrelationSignificance,
  hasZeroVariance
} from '../../safeCompute/relationshipRanker';

// Maximum scatter overlay points for visualization. Statistics (r, p-value)
// are always computed on 100% of rows — only the SVG scatter gets capped.
const MAX_SCATTER_POINTS = 2_000;

/** Project a single row to {x, y}, honoring Point-Biserial binary mapping. */
function projectPoint(
  r: any, metric: string, target: string,
  method: string, binaryMapping: any,
  isMetricNumeric: boolean, isTargetNumeric: boolean
): { x: number; y: number } {
  let x = Number(r[metric]);
  let y = Number(r[target]);
  if (method === 'Point-Biserial' && binaryMapping) {
    if (!isMetricNumeric) {
      x = (r[metric] === binaryMapping.posValue || String(r[metric]) === String(binaryMapping.posValue)) ? 1 : 0;
    }
    if (!isTargetNumeric) {
      y = (r[target] === binaryMapping.posValue || String(r[target]) === String(binaryMapping.posValue)) ? 1 : 0;
    }
  }
  return { x, y };
}

export const CorrelationExecutor = {
  /**
   * Computes Pearson, Spearman, or Point-Biserial correlation between plan.metric and plan.target.
   */
  execute(plan: AnalysisPlan, rows: any[]): ExecutorResult {
    const metric = plan.metric;
    const target = plan.target;

    if (!metric || !target || !rows || rows.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    // Filter out missing values
    const cleanRows = rows.filter(r => 
      r[metric] !== null && r[metric] !== undefined && r[metric] !== '' &&
      r[target] !== null && r[target] !== undefined && r[target] !== ''
    );

    if (cleanRows.length < 3) {
      return { status: 'partial_missing', rows: [], metadata: { reason: 'At least 3 complete records are required.' } };
    }

    // Extract values
    const metricVals = cleanRows.map(r => r[metric]);
    const targetVals = cleanRows.map(r => r[target]);

    // Check if numeric
    const isMetricNumeric = metricVals.every(v => !isNaN(Number(v)));
    const isTargetNumeric = targetVals.every(v => !isNaN(Number(v)));

    let rVal = 0;
    let method = 'Pearson';
    let pVal = 1.0;
    const warnings: string[] = [];

    let binaryMapping: any = null;

    if (isMetricNumeric && isTargetNumeric) {
      // Both numeric -> Pearson/Spearman
      const xs = metricVals.map(Number);
      const ys = targetVals.map(Number);

      // Zero variance in the actually-analyzed (post-filter) values makes
      // correlation mathematically undefined — report that plainly instead
      // of a misleading r=0 ("no correlation") that a user can't tell apart
      // from a genuinely weak relationship.
      if (hasZeroVariance(xs) || hasZeroVariance(ys)) {
        const zeroVarCol = hasZeroVariance(xs) ? metric : target;
        return {
          status: 'partial_missing',
          rows: [],
          metadata: {
            reason: `"${zeroVarCol}" has zero variance in the current data (every value is identical) — correlation is mathematically undefined here, not zero. This can happen if active filters have narrowed the dataset to a single value.`
          }
        };
      }

      // Check the original question text for Spearman request (planId is auto-generated and never contains 'spearman')
      const originalQ = ((plan as any)._originalQuestion || '').toLowerCase();
      const useSpearman = originalQ.includes('spearman') || (plan as any).source === 'spearman';

      if (useSpearman) {
        rVal = getSpearmanCorrelation(xs, ys);
        method = 'Spearman';
      } else {
        rVal = getPearsonCorrelation(xs, ys);
        method = 'Pearson';
      }

      const sig = testCorrelationSignificance(rVal, cleanRows.length);
      pVal = sig.p;
    } else if (isMetricNumeric || isTargetNumeric) {
      // One numeric, one categorical. Check if categorical is binary
      const numVals = isMetricNumeric ? metricVals.map(Number) : targetVals.map(Number);
      const catVals = isMetricNumeric ? targetVals : metricVals;

      const uniqueCats = Array.from(new Set(catVals));
      if (uniqueCats.length === 2) {
        // Binary vs Numeric -> Point-Biserial. (The categorical side is
        // already guaranteed non-degenerate here — uniqueCats.length === 2 —
        // only the numeric side needs a zero-variance check.)
        if (hasZeroVariance(numVals)) {
          return {
            status: 'partial_missing',
            rows: [],
            metadata: {
              reason: `"${isMetricNumeric ? metric : target}" has zero variance in the current data (every value is identical) — Point-Biserial correlation is mathematically undefined here, not zero.`
            }
          };
        }

        binaryMapping = resolveBinaryMapping(uniqueCats);
        const pb = computePointBiserial(numVals, catVals, binaryMapping);
        rVal = pb.correlation;
        method = 'Point-Biserial';
        
        const sig = testCorrelationSignificance(rVal, cleanRows.length);
        pVal = sig.p;

        if (binaryMapping.isAmbiguous) {
          warnings.push(binaryMapping.mappingNote || 'Point-biserial mapping is ambiguous.');
        }
      } else {
        return {
          status: 'partial_missing',
          rows: [],
          metadata: {
            reason: `Correlation is only supported between two numeric columns, or one numeric and one binary column. Column has ${uniqueCats.length} unique values.`
          }
        };
      }
    } else {
      return {
        status: 'partial_missing',
        rows: [],
        metadata: {
          reason: 'Correlation requires at least one numeric column.'
        }
      };
    }

    // ── Scatter overlay (downsampled for DOM safety) ─────────────────────
    // Statistics above used ALL cleanRows. Visual scatter is capped at
    // MAX_SCATTER_POINTS via reservoir sampling to preserve uniform coverage.
    let points: { x: number; y: number }[];
    if (cleanRows.length <= MAX_SCATTER_POINTS) {
      points = cleanRows.map(r => projectPoint(r, metric, target, method, binaryMapping, isMetricNumeric, isTargetNumeric));
    } else {
      // Reservoir sampling: first N, then probabilistic replacement
      const reservoir = cleanRows.slice(0, MAX_SCATTER_POINTS);
      for (let i = MAX_SCATTER_POINTS; i < cleanRows.length; i++) {
        const j = Math.floor(Math.random() * (i + 1));
        if (j < MAX_SCATTER_POINTS) reservoir[j] = cleanRows[i];
      }
      points = reservoir.map(r => projectPoint(r, metric, target, method, binaryMapping, isMetricNumeric, isTargetNumeric));
    }

    return {
      status: cleanRows.length < 5 ? 'partial_small_n' : 'success',
      rows: [{
        r: rVal,
        pValue: pVal,
        method,
        sampleSize: cleanRows.length,
        points,
      }],
      metadata: {
        metric,
        target,
        warnings,
      }
    };
  }
};
