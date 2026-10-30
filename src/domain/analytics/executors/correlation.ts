// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/correlation.ts
// S8d CORRELATION EXECUTOR — Pure function for statistical correlation.
//
// Dual-engine supported: runs synchronously for in-memory row arrays and
// asynchronously (vectorized pushdown) for DuckDB tables.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';
import { computeEngine } from '../../compute';
import { BinaryEncoding, MomentsRequest, DataSource, ComputeEngine, PairProfile, PairMoments, MaybePromise } from '../../compute/ComputeEngine';
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
  execute(plan: AnalysisPlan, source: DataSource | any[], engine: ComputeEngine = computeEngine): MaybePromise<ExecutorResult> {
    const metric = plan.metric;
    const target = plan.target;

    if (!metric || !target || !source) {
      return { status: 'partial_missing', rows: [] };
    }
    if (Array.isArray(source) && source.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    const profOrPromise = engine.profilePair(source, metric, target);

    const evaluateWithProfile = (profile: PairProfile): MaybePromise<ExecutorResult> => {
      if (!profile || profile.count < 3) {
        return { status: 'partial_missing', rows: [], metadata: { reason: 'At least 3 complete records are required.' } };
      }

      if ((profile.xDistinctCount !== undefined && profile.xDistinctCount <= 1) ||
          (profile.yDistinctCount !== undefined && profile.yDistinctCount <= 1)) {
        return zeroVarianceResult((profile.xDistinctCount ?? 0) <= 1 ? metric : target, 'correlation');
      }

      const isMetricNumeric = profile.xAllNumeric;
      const isTargetNumeric = profile.yAllNumeric;

      let rVal = 0;
      let method = 'Pearson';
      let pVal = 1.0;
      const warnings: string[] = [];

      let statsRequest: MomentsRequest = { xColumn: metric, yColumn: target };
      let pointsRequest: MomentsRequest = { xColumn: metric, yColumn: target };

      if (isMetricNumeric && isTargetNumeric) {
        const originalQ = ((plan as any)._originalQuestion || '').toLowerCase();
        const useSpearman = originalQ.includes('spearman') || (plan as any).source === 'spearman';

        if (useSpearman) {
          if (engine.spearman) {
            const spOrPromise = engine.spearman(source, metric, target);
            const processSpearman = (sp: { r: number; count: number; xAllIdentical?: boolean; yAllIdentical?: boolean }): ExecutorResult => {
              if (sp.xAllIdentical || sp.yAllIdentical) {
                return zeroVarianceResult(sp.xAllIdentical ? metric : target, 'correlation');
              }
              const sig = testCorrelationSignificance(sp.r, profile.count);
              return {
                status: profile.count < 5 ? 'partial_small_n' : 'success',
                rows: [{ r: sp.r, pValue: sig.p, method: 'Spearman', sampleSize: profile.count, points: [] }],
                metadata: { metric, target, warnings }
              };
            };
            return spOrPromise instanceof Promise ? spOrPromise.then(processSpearman) : processSpearman(spOrPromise);
          } else {
            const rows = Array.isArray(source) ? source : (source && source.kind === 'in-memory-rows' ? source.rows : []);
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
            const xConstant = xs.every(v => v === xs[0]);
            const yConstant = ys.every(v => v === ys[0]);
            if (xConstant || yConstant) {
              return zeroVarianceResult(xConstant ? metric : target, 'correlation');
            }
            rVal = getSpearmanCorrelation(xs, ys);
            method = 'Spearman';
            const sig = testCorrelationSignificance(rVal, profile.count);
            pVal = sig.p;
          }
        }
      } else if (isMetricNumeric || isTargetNumeric) {
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
        method = 'Point-Biserial';
        if (binaryMapping.isAmbiguous) {
          warnings.push(binaryMapping.mappingNote || 'Point-biserial mapping is ambiguous.');
        }
      } else {
        return {
          status: 'partial_missing',
          rows: [],
          metadata: { reason: 'Correlation requires at least one numeric column.' }
        };
      }

      // Compute moments & sample points (sync or async)
      const momentsOrPromise = engine.moments(source, statsRequest);
      const pointsOrPromise = engine.samplePoints(source, pointsRequest, MAX_SCATTER_POINTS);

      const assembleFinalResult = (m: PairMoments, points: any[]): ExecutorResult => {
        if (method !== 'Spearman') {
          const isConstant = method === 'Point-Biserial'
            ? (isMetricNumeric ? m.xAllIdentical : m.yAllIdentical)
            : (m.xAllIdentical || m.yAllIdentical);

          if (isConstant) {
            const constCol = (isMetricNumeric && method === 'Point-Biserial') ? metric : (m.xAllIdentical ? metric : target);
            return zeroVarianceResult(constCol, method === 'Point-Biserial' ? 'Point-Biserial correlation' : 'correlation');
          }

          rVal = pearsonFromMoments(m);
          const sig = testCorrelationSignificance(rVal, profile.count);
          pVal = sig.p;
        }

        return {
          status: profile.count < 5 ? 'partial_small_n' : 'success',
          rows: [{
            r: rVal,
            pValue: pVal,
            method,
            sampleSize: profile.count,
            points: points || [],
          }],
          metadata: {
            metric,
            target,
            warnings,
            pairValidCount: profile.count,
            totalRows: profile.totalRows
          }
        };
      };

      if (momentsOrPromise instanceof Promise || pointsOrPromise instanceof Promise) {
        return Promise.all([
          Promise.resolve(momentsOrPromise),
          Promise.resolve(pointsOrPromise)
        ]).then(([m, pts]) => assembleFinalResult(m, pts));
      }

      return assembleFinalResult(momentsOrPromise as PairMoments, pointsOrPromise as any[]);
    };

    if (profOrPromise instanceof Promise) {
      return profOrPromise.then(evaluateWithProfile);
    }
    return evaluateWithProfile(profOrPromise);
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
