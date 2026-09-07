// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/correlation.ts
// S8d CORRELATION EXECUTOR — Pure function for statistical correlation.
//
// Stage 2.5 migration: data access now goes through the ComputeEngine as
// three single-pass operations (profilePair → moments → samplePoints)
// instead of materializing five ~N-length arrays (filter + 2 value maps +
// 2 Number maps) and walking them ~8 times.
//
// The split of responsibility is deliberate:
//   ComputeEngine  — supplies counts, sufficient statistics, sample points.
//                    Knows nothing about correlation.
//   This executor  — chooses the method, applies the zero-variance guard,
//                    and calls the statistics layer for the actual formula.
//   Statistics     — pearsonFromMoments / testCorrelationSignificance /
//                    resolveBinaryMapping. Written and tested once, shared
//                    by every engine implementation.
//
// Spearman deliberately still materializes arrays: rank transformation
// requires sorting every value, which cannot be expressed as running sums,
// so there are no sufficient statistics for the engine to return. It is the
// one path where the array boundary is intrinsic rather than incidental.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';
import { computeEngine } from '../../compute';
import { BinaryEncoding, MomentsRequest } from '../../compute/ComputeEngine';
import {
  getSpearmanCorrelation,
  resolveBinaryMapping,
  testCorrelationSignificance,
  pearsonFromMoments
} from '../../safeCompute/relationshipRanker';

// Maximum scatter overlay points for visualization. Statistics (r, p-value)
// are always computed on 100% of rows — only the SVG scatter gets capped.
const MAX_SCATTER_POINTS = 2_000;

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

    // One pass: how many complete pairs exist, are the columns numeric, and
    // (bounded) what distinct values do they hold.
    const profile = computeEngine.profilePair(rows, metric, target);

    if (profile.count < 3) {
      return { status: 'partial_missing', rows: [], metadata: { reason: 'At least 3 complete records are required.' } };
    }

    const isMetricNumeric = profile.xAllNumeric;
    const isTargetNumeric = profile.yAllNumeric;

    let rVal = 0;
    let method = 'Pearson';
    let pVal = 1.0;
    const warnings: string[] = [];

    // Encodings for the eventual moments/samplePoints requests. Left
    // undefined for numeric columns; set only for the categorical side of a
    // Point-Biserial pair, from the deterministically resolved mapping.
    let statsRequest: MomentsRequest = { xColumn: metric, yColumn: target };
    let pointsRequest: MomentsRequest = { xColumn: metric, yColumn: target };

    if (isMetricNumeric && isTargetNumeric) {
      // Check the original question text for Spearman request (planId is auto-generated and never contains 'spearman')
      const originalQ = ((plan as any)._originalQuestion || '').toLowerCase();
      const useSpearman = originalQ.includes('spearman') || (plan as any).source === 'spearman';

      if (useSpearman) {
        // Rank-based: intrinsically needs materialized, sortable arrays.
        const xs: number[] = [];
        const ys: number[] = [];
        for (const r of rows) {
          const xRaw = r[metric];
          const yRaw = r[target];
          if (xRaw === null || xRaw === undefined || xRaw === '') continue;
          if (yRaw === null || yRaw === undefined || yRaw === '') continue;
          xs.push(Number(xRaw));
          ys.push(Number(yRaw));
        }

        // Zero variance makes correlation mathematically undefined — report
        // that plainly instead of a misleading r=0 ("no correlation") that a
        // user cannot tell apart from a genuinely weak relationship.
        const xConstant = xs.every(v => v === xs[0]);
        const yConstant = ys.every(v => v === ys[0]);
        if (xConstant || yConstant) {
          return zeroVarianceResult(xConstant ? metric : target, 'correlation');
        }

        rVal = getSpearmanCorrelation(xs, ys);
        method = 'Spearman';
      } else {
        const m = computeEngine.moments(rows, statsRequest);
        if (m.xAllIdentical || m.yAllIdentical) {
          return zeroVarianceResult(m.xAllIdentical ? metric : target, 'correlation');
        }
        rVal = pearsonFromMoments(m);
        method = 'Pearson';
      }

      const sig = testCorrelationSignificance(rVal, profile.count);
      pVal = sig.p;
    } else if (isMetricNumeric || isTargetNumeric) {
      // One numeric, one categorical. Point-Biserial requires the
      // categorical side to be binary.
      const catDistinct = isMetricNumeric ? profile.yDistinct : profile.xDistinct;
      const catTruncated = isMetricNumeric ? profile.yDistinctTruncated : profile.xDistinctTruncated;

      if (catDistinct.length !== 2 || catTruncated) {
        return {
          status: 'partial_missing',
          rows: [],
          metadata: {
            reason: `Correlation is only supported between two numeric columns, or one numeric and one binary column. Column has ${catTruncated ? 'more than 2' : catDistinct.length} unique values.`
          }
        };
      }

      // The resolved mapping is the single source of truth for which value
      // means 1 — the engine never guesses how to turn a category into a
      // number, it is told explicitly.
      const binaryMapping = resolveBinaryMapping(catDistinct);
      const strictEncoding: BinaryEncoding = { positiveValue: binaryMapping.posValue, matchMode: 'strict' };
      const looseEncoding: BinaryEncoding = { positiveValue: binaryMapping.posValue, matchMode: 'loose' };

      if (isMetricNumeric) {
        statsRequest = { xColumn: metric, yColumn: target, yEncoding: strictEncoding };
        pointsRequest = { xColumn: metric, yColumn: target, yEncoding: looseEncoding };
      } else {
        statsRequest = { xColumn: metric, yColumn: target, xEncoding: strictEncoding };
        pointsRequest = { xColumn: metric, yColumn: target, xEncoding: looseEncoding };
      }

      const m = computeEngine.moments(rows, statsRequest);

      // Only the numeric side needs the guard: the categorical side is
      // already known to hold exactly 2 distinct values.
      const numericSideConstant = isMetricNumeric ? m.xAllIdentical : m.yAllIdentical;
      if (numericSideConstant) {
        return zeroVarianceResult(isMetricNumeric ? metric : target, 'Point-Biserial correlation');
      }

      rVal = pearsonFromMoments(m);
      method = 'Point-Biserial';

      const sig = testCorrelationSignificance(rVal, profile.count);
      pVal = sig.p;

      if (binaryMapping.isAmbiguous) {
        warnings.push(binaryMapping.mappingNote || 'Point-biserial mapping is ambiguous.');
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
    // Statistics above used ALL complete pairs. The visual scatter is capped
    // at MAX_SCATTER_POINTS via reservoir sampling, so a rendering limit can
    // never degrade statistical correctness.
    const points = computeEngine.samplePoints(rows, pointsRequest, MAX_SCATTER_POINTS);

    return {
      status: profile.count < 5 ? 'partial_small_n' : 'success',
      rows: [{
        r: rVal,
        pValue: pVal,
        method,
        sampleSize: profile.count,
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

function zeroVarianceResult(column: string, methodLabel: string): ExecutorResult {
  return {
    status: 'partial_missing',
    rows: [],
    metadata: {
      reason: methodLabel === 'Point-Biserial correlation'
        ? `"${column}" has zero variance in the current data (every value is identical) — Point-Biserial correlation is mathematically undefined here, not zero.`
        : `"${column}" has zero variance in the current data (every value is identical) — correlation is mathematically undefined here, not zero. This can happen if active filters have narrowed the dataset to a single value.`
    }
  };
}
