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
  testCorrelationSignificance 
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

    const metricVals: any[] = [];
    const targetVals: any[] = [];
    let isMetricNumeric = true;
    let isTargetNumeric = true;

    for (let i = 0; i < rows.length; i++) {
      const rm = rows[i][metric];
      const rt = rows[i][target];
      if (rm !== null && rm !== undefined && rm !== '' &&
          rt !== null && rt !== undefined && rt !== '') {
        metricVals.push(rm);
        targetVals.push(rt);
        if (isMetricNumeric && isNaN(Number(rm))) isMetricNumeric = false;
        if (isTargetNumeric && isNaN(Number(rt))) isTargetNumeric = false;
      }
    }

    const cleanRowCount = metricVals.length;
    if (cleanRowCount < 3) {
      return { status: 'partial_missing', rows: [], metadata: { reason: 'At least 3 complete records are required.' } };
    }

    let rVal = 0;
    let method = 'Pearson';
    let pVal = 1.0;
    const warnings: string[] = [];

    let binaryMapping: any = null;

    if (isMetricNumeric && isTargetNumeric) {
      // Both numeric -> Pearson/Spearman
      const xs = metricVals.map(Number);
      const ys = targetVals.map(Number);
      
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

      const sig = testCorrelationSignificance(rVal, cleanRowCount);
      pVal = sig.p;
    } else if (isMetricNumeric || isTargetNumeric) {
      // One numeric, one categorical. Check if categorical is binary
      const numVals = isMetricNumeric ? metricVals.map(Number) : targetVals.map(Number);
      const catVals = isMetricNumeric ? targetVals : metricVals;

      const uniqueCats = Array.from(new Set(catVals));
      if (uniqueCats.length === 2) {
        // Binary vs Numeric -> Point-Biserial
        binaryMapping = resolveBinaryMapping(uniqueCats);
        const pb = computePointBiserial(numVals, catVals, binaryMapping);
        rVal = pb.correlation;
        method = 'Point-Biserial';
        
        const sig = testCorrelationSignificance(rVal, cleanRowCount);
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
    // Statistics above used ALL valid points. Visual scatter is capped at
    // MAX_SCATTER_POINTS via reservoir sampling to preserve uniform coverage.
    let points: { x: number; y: number }[] = [];
    
    const projectArrays = (i: number): { x: number; y: number } => {
       let x = Number(metricVals[i]);
       let y = Number(targetVals[i]);
       if (method === 'Point-Biserial' && binaryMapping) {
         if (!isMetricNumeric) {
           x = (metricVals[i] === binaryMapping.posValue || String(metricVals[i]) === String(binaryMapping.posValue)) ? 1 : 0;
         }
         if (!isTargetNumeric) {
           y = (targetVals[i] === binaryMapping.posValue || String(targetVals[i]) === String(binaryMapping.posValue)) ? 1 : 0;
         }
       }
       return { x, y };
    };

    if (cleanRowCount <= MAX_SCATTER_POINTS) {
      for (let i = 0; i < cleanRowCount; i++) {
        points.push(projectArrays(i));
      }
    } else {
      // Reservoir sampling: first N, then probabilistic replacement
      const reservoirIndices = new Array(MAX_SCATTER_POINTS);
      for (let i = 0; i < MAX_SCATTER_POINTS; i++) reservoirIndices[i] = i;
      for (let i = MAX_SCATTER_POINTS; i < cleanRowCount; i++) {
        const j = Math.floor(Math.random() * (i + 1));
        if (j < MAX_SCATTER_POINTS) reservoirIndices[j] = i;
      }
      for (let j = 0; j < MAX_SCATTER_POINTS; j++) {
        points.push(projectArrays(reservoirIndices[j]));
      }
    }

    return {
      status: cleanRowCount < 5 ? 'partial_small_n' : 'success',
      rows: [{
        r: rVal,
        pValue: pVal,
        method,
        sampleSize: cleanRowCount,
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
