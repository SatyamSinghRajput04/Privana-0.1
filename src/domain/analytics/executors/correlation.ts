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

    if (isMetricNumeric && isTargetNumeric) {
      // Both numeric -> Pearson/Spearman
      const xs = metricVals.map(Number);
      const ys = targetVals.map(Number);
      
      const q = plan.planId.toLowerCase();
      const useSpearman = q.includes('spearman');
      
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
        // Binary vs Numeric -> Point-Biserial
        const mapping = resolveBinaryMapping(uniqueCats);
        const pb = computePointBiserial(numVals, catVals, mapping);
        rVal = pb.correlation;
        method = 'Point-Biserial';
        
        const sig = testCorrelationSignificance(rVal, cleanRows.length);
        pVal = sig.p;

        if (mapping.isAmbiguous) {
          warnings.push(mapping.mappingNote || 'Point-biserial mapping is ambiguous.');
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

    const points = cleanRows.map(r => ({
      x: Number(r[metric]),
      y: Number(r[target])
    }));

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
