// ─────────────────────────────────────────────────────────────────────────────
// src/domain/compute/duckdb/DuckDBComputeEngine.ts
// DuckDB-WASM ComputeEngine Implementation (Phase A - Shadow Foundation)
//
// Implements statistics-shaped queries with complete SQL pushdown:
//   - Grouped aggregate: Vectorized C++ group-by pushdown
//   - Moments: Shifted sums with condition number stabilization
//   - Sample points: Reservoir sampling pushdown (USING SAMPLE)
//
// Strictly conforms to the Arrow Materialization Boundary:
//   Only compact aggregated results (~20 rows or 1 moment row) cross into JS.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ComputeEngine,
  GroupedAggregateRow,
  PairProfile,
  PairMoments,
  MomentsRequest,
  BinaryEncoding,
  DistributionBin,
  DistributionResult
} from '../ComputeEngine';
import { inMemoryComputeEngine } from '../inMemoryComputeEngine';
import { pearsonFromMoments } from '../../safeCompute/relationshipRanker';
import { getDuckDBConnection, registerMemoryTable } from './duckdbWorker';

/**
 * Builds a SQL expression for a column, honoring binary encoding if present.
 */
function buildColumnExpr(column: string, encoding?: BinaryEncoding): string {
  if (!encoding) {
    return `TRY_CAST("${column}" AS DOUBLE)`;
  }
  const pos = typeof encoding.positiveValue === 'string'
    ? `'${encoding.positiveValue.replace(/'/g, "''")}'`
    : encoding.positiveValue;
  
  if (encoding.matchMode === 'loose') {
    return `CASE WHEN CAST("${column}" AS VARCHAR) = CAST(${pos} AS VARCHAR) THEN 1.0 ELSE 0.0 END`;
  }
  return `CASE WHEN "${column}" = ${pos} THEN 1.0 ELSE 0.0 END`;
}

export class DuckDBComputeEngine implements ComputeEngine {
  /**
   * Synchronous interface implementations fallback to inMemoryComputeEngine
   * when row arrays are passed in memory during the shadow migration.
   */
  groupedAggregate(rows: any[], metric: string, groupBy: string): GroupedAggregateRow[] {
    return inMemoryComputeEngine.groupedAggregate(rows, metric, groupBy);
  }

  profilePair(rows: any[], xColumn: string, yColumn: string, distinctCap: number = 20): PairProfile {
    return inMemoryComputeEngine.profilePair(rows, xColumn, yColumn, distinctCap);
  }

  moments(rows: any[], request: MomentsRequest): PairMoments {
    return inMemoryComputeEngine.moments(rows, request);
  }

  samplePoints(rows: any[], request: MomentsRequest, limit: number): { x: number; y: number }[] {
    return inMemoryComputeEngine.samplePoints(rows, request, limit);
  }

  distribution(rows: any[], column: string): DistributionResult {
    return inMemoryComputeEngine.distribution(rows, column);
  }

  // ── Asynchronous Vectorized Pushdown Methods (DuckDB Kernel) ─────────────────

  /**
   * Vectorized Grouped Aggregate pushdown.
   * Only the ~20 group rows are returned across the Web Worker boundary.
   */
  async queryGroupedAggregate(
    tableNameOrRows: string | any[],
    metric: string,
    groupBy: string
  ): Promise<GroupedAggregateRow[]> {
    const conn = await getDuckDBConnection();
    const isScratch = typeof tableNameOrRows !== 'string';
    const scratchName = isScratch ? `_scratch_grp_${Date.now()}_${Math.random().toString(36).slice(2)}` : '';
    const table = isScratch ? `"${scratchName}"` : `"${tableNameOrRows}"`;

    if (isScratch) {
      await registerMemoryTable(scratchName, tableNameOrRows);
    }

    try {
      const sql = `
        SELECT 
          CAST("${groupBy}" AS VARCHAR) AS category_label,
          AVG(TRY_CAST("${metric}" AS DOUBLE)) AS average_value,
          COUNT(*) AS count
        FROM ${table}
        WHERE "${groupBy}" IS NOT NULL AND "${groupBy}" != ''
          AND "${metric}" IS NOT NULL AND "${metric}" != ''
          AND TRY_CAST("${metric}" AS DOUBLE) IS NOT NULL
        GROUP BY "${groupBy}";
      `;

      const result = await conn.query(sql);
      const rows: GroupedAggregateRow[] = [];
      
      // Convert compact RecordBatch to plain JS objects (typically 5-50 items)
      for (let i = 0; i < result.numRows; i++) {
        rows.push({
          category_label: String(result.getChild('category_label')?.get(i) ?? ''),
          average_value: Number(result.getChild('average_value')?.get(i) ?? 0),
          count: Number(result.getChild('count')?.get(i) ?? 0)
        });
      }

      return rows;
    } finally {
      if (isScratch) {
        try { await conn.query(`DROP TABLE IF EXISTS "${scratchName}";`); } catch {}
      }
    }
  }

  /**
   * Single-pass Shifted Moments query pushdown.
   * Returns exactly 1 row (O(1) transfer) with condition-stabilized sums.
   */
  async queryMoments(
    tableNameOrRows: string | any[],
    request: MomentsRequest
  ): Promise<PairMoments> {
    const conn = await getDuckDBConnection();
    const isScratch = typeof tableNameOrRows !== 'string';
    const scratchName = isScratch ? `_scratch_moments_${Date.now()}_${Math.random().toString(36).slice(2)}` : '';
    const table = isScratch ? `"${scratchName}"` : `"${tableNameOrRows}"`;

    if (isScratch) {
      await registerMemoryTable(scratchName, tableNameOrRows);
    }

    try {
      const xExpr = buildColumnExpr(request.xColumn, request.xEncoding);
      const yExpr = buildColumnExpr(request.yColumn, request.yEncoding);

      // 1. Fetch first valid x and y to act as shifted origins
      const originSql = `
        SELECT ${xExpr} AS x0, ${yExpr} AS y0
        FROM ${table}
        WHERE "${request.xColumn}" IS NOT NULL AND "${request.xColumn}" != ''
          AND "${request.yColumn}" IS NOT NULL AND "${request.yColumn}" != ''
          AND ${xExpr} IS NOT NULL AND ${yExpr} IS NOT NULL
        LIMIT 1;
      `;
      const originRes = await conn.query(originSql);
      if (originRes.numRows === 0) {
        return {
          count: 0, shiftX: 0, shiftY: 0,
          sumX: 0, sumY: 0, sumXY: 0, sumX2: 0, sumY2: 0,
          xAllIdentical: true, yAllIdentical: true
        };
      }

      const shiftX = Number(originRes.getChild('x0')?.get(0) ?? 0);
      const shiftY = Number(originRes.getChild('y0')?.get(0) ?? 0);

      // 2. Compute shifted sums and zero-variance flags in a single SQL pass
      const momentsSql = `
        SELECT 
          COUNT(*) AS count,
          SUM(${xExpr} - ${shiftX}) AS sum_x,
          SUM(${yExpr} - ${shiftY}) AS sum_y,
          SUM((${xExpr} - ${shiftX}) * (${yExpr} - ${shiftY})) AS sum_xy,
          SUM((${xExpr} - ${shiftX}) * (${xExpr} - ${shiftX})) AS sum_x2,
          SUM((${yExpr} - ${shiftY}) * (${yExpr} - ${shiftY})) AS sum_y2,
          MIN(${xExpr}) = MAX(${xExpr}) AS x_identical,
          MIN(${yExpr}) = MAX(${yExpr}) AS y_identical
        FROM ${table}
        WHERE "${request.xColumn}" IS NOT NULL AND "${request.xColumn}" != ''
          AND "${request.yColumn}" IS NOT NULL AND "${request.yColumn}" != ''
          AND ${xExpr} IS NOT NULL AND ${yExpr} IS NOT NULL;
      `;

      const mRes = await conn.query(momentsSql);
      return {
        count: Number(mRes.getChild('count')?.get(0) ?? 0),
        shiftX,
        shiftY,
        sumX: Number(mRes.getChild('sum_x')?.get(0) ?? 0),
        sumY: Number(mRes.getChild('sum_y')?.get(0) ?? 0),
        sumXY: Number(mRes.getChild('sum_xy')?.get(0) ?? 0),
        sumX2: Number(mRes.getChild('sum_x2')?.get(0) ?? 0),
        sumY2: Number(mRes.getChild('sum_y2')?.get(0) ?? 0),
        xAllIdentical: Boolean(mRes.getChild('x_identical')?.get(0)),
        yAllIdentical: Boolean(mRes.getChild('y_identical')?.get(0))
      };
    } finally {
      if (isScratch) {
        try { await conn.query(`DROP TABLE IF EXISTS "${scratchName}";`); } catch {}
      }
    }
  }

  /**
   * Bounded sample points query pushdown.
   * Returns at most `limit` points for scatter rendering.
   */
  async querySamplePoints(
    tableNameOrRows: string | any[],
    request: MomentsRequest,
    limit: number = 2000
  ): Promise<{ x: number; y: number }[]> {
    const conn = await getDuckDBConnection();
    const isScratch = typeof tableNameOrRows !== 'string';
    const scratchName = isScratch ? `_scratch_samples_${Date.now()}_${Math.random().toString(36).slice(2)}` : '';
    const table = isScratch ? `"${scratchName}"` : `"${tableNameOrRows}"`;

    if (isScratch) {
      await registerMemoryTable(scratchName, tableNameOrRows);
    }

    try {
      const xExpr = buildColumnExpr(request.xColumn, request.xEncoding);
      const yExpr = buildColumnExpr(request.yColumn, request.yEncoding);

      const sql = `
        SELECT ${xExpr} AS x, ${yExpr} AS y
        FROM ${table}
        WHERE "${request.xColumn}" IS NOT NULL AND "${request.xColumn}" != ''
          AND "${request.yColumn}" IS NOT NULL AND "${request.yColumn}" != ''
          AND ${xExpr} IS NOT NULL AND ${yExpr} IS NOT NULL
        USING SAMPLE ${limit} (reservoir);
      `;

      const res = await conn.query(sql);
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < res.numRows; i++) {
        points.push({
          x: Number(res.getChild('x')?.get(i) ?? 0),
          y: Number(res.getChild('y')?.get(i) ?? 0)
        });
      }
      return points;
    } finally {
      if (isScratch) {
        try { await conn.query(`DROP TABLE IF EXISTS "${scratchName}";`); } catch {}
      }
    }
  }

  /**
   * Vectorized Distribution & Histogram pushdown.
   * Leverages Sturges' rule and SQL WIDTH_BUCKET with upper-bound clamping
   * to guarantee the maximum value falls into the last bucket (not bucket k + 1).
   * Materializes at most 20-50 aggregate rows across the Web Worker boundary.
   */
  async queryDistribution(
    tableNameOrRows: string | any[],
    column: string
  ): Promise<DistributionResult> {
    const conn = await getDuckDBConnection();
    const isScratch = typeof tableNameOrRows !== 'string';
    const scratchName = isScratch ? `_scratch_dist_${Date.now()}_${Math.random().toString(36).slice(2)}` : '';
    const table = isScratch ? `"${scratchName}"` : `"${tableNameOrRows}"`;

    if (isScratch) {
      await registerMemoryTable(scratchName, tableNameOrRows);
    }

    try {
      // 1. Gather column statistics to distinguish numeric vs categorical
      const statsSql = `
        SELECT 
          COUNT(*) AS total_count,
          COUNT(TRY_CAST("${column}" AS DOUBLE)) AS numeric_count,
          MIN(TRY_CAST("${column}" AS DOUBLE)) AS min_val,
          MAX(TRY_CAST("${column}" AS DOUBLE)) AS max_val,
          COUNT(DISTINCT "${column}") AS approx_distinct
        FROM ${table}
        WHERE "${column}" IS NOT NULL AND "${column}" != '';
      `;

      const statsRes = await conn.query(statsSql);
      const totalCount = Number(statsRes.getChild('total_count')?.get(0) ?? 0);
      const numericCount = Number(statsRes.getChild('numeric_count')?.get(0) ?? 0);
      const minVal = Number(statsRes.getChild('min_val')?.get(0) ?? 0);
      const maxVal = Number(statsRes.getChild('max_val')?.get(0) ?? 0);
      const distinctCount = Number(statsRes.getChild('approx_distinct')?.get(0) ?? 0);

      if (totalCount === 0) {
        return { isNumeric: false, rows: [], totalCount: 0 };
      }

      const hasNonInteger = !Number.isInteger(minVal) || !Number.isInteger(maxVal);
      const isNumeric = numericCount > 0 &&
                        (numericCount / totalCount) > 0.8 &&
                        (distinctCount > 10 || hasNonInteger);

      if (isNumeric) {
        const range = maxVal - minVal;
        if (range === 0) {
          return {
            isNumeric: true,
            totalCount: numericCount,
            rows: [{
              binRange: `${minVal}`,
              binLabel: `${minVal}`,
              count: numericCount,
              minVal,
              maxVal
            }]
          };
        }

        const binCount = Math.ceil(Math.log2(numericCount) + 1);
        const binWidth = range / binCount;

        // In DuckDB, values equal to maxVal fall into bucket binCount + 1 by default.
        // We clamp bucket index with LEAST / GREATEST / CASE so [minVal, maxVal]
        // strictly maps into buckets [1, binCount].
        const binSql = `
          SELECT 
            CASE 
              WHEN TRY_CAST("${column}" AS DOUBLE) <= ${minVal} THEN 1
              WHEN TRY_CAST("${column}" AS DOUBLE) >= ${maxVal} THEN ${binCount}
              ELSE LEAST(
                GREATEST(
                  WIDTH_BUCKET(TRY_CAST("${column}" AS DOUBLE), ${minVal}, ${maxVal}, ${binCount}),
                  1
                ),
                ${binCount}
              )
            END AS b_idx,
            COUNT(*) AS count
          FROM ${table}
          WHERE "${column}" IS NOT NULL AND "${column}" != ''
            AND TRY_CAST("${column}" AS DOUBLE) IS NOT NULL
          GROUP BY b_idx
          ORDER BY b_idx;
        `;

        const binRes = await conn.query(binSql);
        const bucketMap = new Map<number, number>();
        for (let i = 0; i < binRes.numRows; i++) {
          const bIdx = Number(binRes.getChild('b_idx')?.get(i) ?? 0);
          const cnt = Number(binRes.getChild('count')?.get(i) ?? 0);
          bucketMap.set(bIdx, cnt);
        }

        const rows: DistributionBin[] = [];
        for (let i = 0; i < binCount; i++) {
          const start = minVal + i * binWidth;
          const end = (i === binCount - 1) ? maxVal : start + binWidth;
          const label = `${start.toFixed(1)} - ${end.toFixed(1)}`;
          rows.push({
            binRange: label,
            binLabel: label,
            count: bucketMap.get(i + 1) || 0,
            minVal: start,
            maxVal: end
          });
        }

        return { isNumeric: true, rows, totalCount: numericCount };
      } else {
        // Categorical distribution pushdown (top 50 categories)
        const catSql = `
          SELECT 
            CAST("${column}" AS VARCHAR) AS cat_val,
            COUNT(*) AS count
          FROM ${table}
          WHERE "${column}" IS NOT NULL AND "${column}" != ''
          GROUP BY 1
          ORDER BY count DESC
          LIMIT 50;
        `;

        const catRes = await conn.query(catSql);
        const rows: DistributionBin[] = [];
        for (let i = 0; i < catRes.numRows; i++) {
          const catVal = String(catRes.getChild('cat_val')?.get(i) ?? '');
          const count = Number(catRes.getChild('count')?.get(i) ?? 0);
          rows.push({
            binRange: catVal,
            binLabel: catVal,
            category_label: catVal,
            count
          });
        }

        return { isNumeric: false, rows, totalCount };
      }
    } finally {
      if (isScratch) {
        try { await conn.query(`DROP TABLE IF EXISTS "${scratchName}";`); } catch {}
      }
    }
  }

  /**
   * Vectorized Spearman rank correlation pushdown.
   * Computes fractional tie-averaged ranks inside DuckDB and calculates
   * moments over ranks in a single pass without materializing row pairs in JS.
   */
  async querySpearman(
    tableNameOrRows: string | any[],
    xColumn: string,
    yColumn: string
  ): Promise<{ r: number; count: number; xAllIdentical: boolean; yAllIdentical: boolean }> {
    const conn = await getDuckDBConnection();
    const isScratch = typeof tableNameOrRows !== 'string';
    const scratchName = isScratch ? `_scratch_spearman_${Date.now()}_${Math.random().toString(36).slice(2)}` : '';
    const table = isScratch ? `"${scratchName}"` : `"${tableNameOrRows}"`;

    if (isScratch) {
      await registerMemoryTable(scratchName, tableNameOrRows);
    }

    try {
      const sql = `
        WITH base AS (
          SELECT 
            TRY_CAST("${xColumn}" AS DOUBLE) AS x,
            TRY_CAST("${yColumn}" AS DOUBLE) AS y
          FROM ${table}
          WHERE "${xColumn}" IS NOT NULL AND "${xColumn}" != ''
            AND "${yColumn}" IS NOT NULL AND "${yColumn}" != ''
            AND TRY_CAST("${xColumn}" AS DOUBLE) IS NOT NULL
            AND TRY_CAST("${yColumn}" AS DOUBLE) IS NOT NULL
        ),
        ranked AS (
          SELECT 
            (RANK() OVER (ORDER BY x) + (COUNT(*) OVER (PARTITION BY x) - 1.0) / 2.0) AS rx,
            (RANK() OVER (ORDER BY y) + (COUNT(*) OVER (PARTITION BY y) - 1.0) / 2.0) AS ry
          FROM base
        )
        SELECT 
          COUNT(*) AS count,
          MIN(rx) = MAX(rx) AS x_identical,
          MIN(ry) = MAX(ry) AS y_identical,
          SUM(rx) AS sum_rx,
          SUM(ry) AS sum_ry,
          SUM(rx * ry) AS sum_rxy,
          SUM(rx * rx) AS sum_rx2,
          SUM(ry * ry) AS sum_ry2
        FROM ranked;
      `;

      const res = await conn.query(sql);
      const count = Number(res.getChild('count')?.get(0) ?? 0);
      const xAllIdentical = Boolean(res.getChild('x_identical')?.get(0));
      const yAllIdentical = Boolean(res.getChild('y_identical')?.get(0));

      if (count < 2 || xAllIdentical || yAllIdentical) {
        return { r: 0, count, xAllIdentical, yAllIdentical };
      }

      const sumRx = Number(res.getChild('sum_rx')?.get(0) ?? 0);
      const sumRy = Number(res.getChild('sum_ry')?.get(0) ?? 0);
      const sumRxy = Number(res.getChild('sum_rxy')?.get(0) ?? 0);
      const sumRx2 = Number(res.getChild('sum_rx2')?.get(0) ?? 0);
      const sumRy2 = Number(res.getChild('sum_ry2')?.get(0) ?? 0);

      const r = pearsonFromMoments({
        count,
        sumX: sumRx,
        sumY: sumRy,
        sumXY: sumRxy,
        sumX2: sumRx2,
        sumY2: sumRy2
      });

      return { r, count, xAllIdentical, yAllIdentical };
    } finally {
      if (isScratch) {
        try { await conn.query(`DROP TABLE IF EXISTS "${scratchName}";`); } catch {}
      }
    }
  }
}

export const duckdbComputeEngine = new DuckDBComputeEngine();
