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

import { DataSource, ComputeEngine,
  GroupedAggregateRow,
  PairProfile,
  PairMoments,
  MomentsRequest,
  BinaryEncoding,
  DistributionBin,
  DistributionResult,
  Aggregation,
  MaybePromise } from '../ComputeEngine';
import { inMemoryComputeEngine } from '../inMemoryComputeEngine';
import { pearsonFromMoments } from '../../safeCompute/relationshipRanker';
import { DUCKDB_TABLES } from '../../../lib/sqlEngine';
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


/**
 * Safely normalizes DataSource input into table or row targeting.
 */
function resolveSource(source: DataSource | any[]): { isTable: boolean; tableName: string; rows: any[] } {
  if (Array.isArray(source)) {
    return { isTable: false, tableName: '', rows: source };
  }
  if (source && source.kind === 'duckdb-table') {
    return { isTable: true, tableName: source.tableName, rows: [] };
  }
  if (source && source.kind === 'in-memory-rows') {
    return { isTable: false, tableName: '', rows: source.rows };
  }
  if (typeof source === 'string') {
    return { isTable: true, tableName: source, rows: [] };
  }
  return { isTable: false, tableName: '', rows: [] };
}

export class DuckDBComputeEngine implements ComputeEngine {
  groupedAggregate(
    source: DataSource | any[],
    metric: string,
    groupBy: string,
    aggregation?: Aggregation
  ): any {
    const res = resolveSource(source);
    if (res.isTable) {
      return this.queryGroupedAggregate(res.tableName, metric, groupBy, aggregation);
    }
    return inMemoryComputeEngine.groupedAggregate(res.rows, metric, groupBy, aggregation);
  }

  profilePair(
    source: DataSource | any[],
    xColumn: string,
    yColumn: string,
    distinctCap: number = 20
  ): MaybePromise<PairProfile> {
    const res = resolveSource(source);
    if (res.isTable) {
      return this.queryProfilePair(res.tableName, xColumn, yColumn, distinctCap);
    }
    return inMemoryComputeEngine.profilePair(res.rows, xColumn, yColumn, distinctCap);
  }

  spearman(
    source: DataSource | any[],
    xColumn: string,
    yColumn: string
  ): MaybePromise<{ r: number; count: number; xAllIdentical?: boolean; yAllIdentical?: boolean }> {
    const res = resolveSource(source);
    if (res.isTable) {
      return this.querySpearman(res.tableName, xColumn, yColumn);
    }
    return this.querySpearman(res.rows, xColumn, yColumn);
  }

  moments(
    source: DataSource | any[],
    request: MomentsRequest
  ): any {
    const res = resolveSource(source);
    if (res.isTable) {
      return this.queryMoments(res.tableName, request);
    }
    return inMemoryComputeEngine.moments(res.rows, request);
  }

  samplePoints(
    source: DataSource | any[],
    request: MomentsRequest,
    limit: number
  ): any {
    const res = resolveSource(source);
    if (res.isTable) {
      return this.querySamplePoints(res.tableName, request, limit);
    }
    return inMemoryComputeEngine.samplePoints(res.rows, request, limit);
  }

  distribution(
    source: DataSource | any[],
    column: string
  ): any {
    const res = resolveSource(source);
    if (res.isTable) {
      return this.queryDistribution(res.tableName, column);
    }
    return inMemoryComputeEngine.distribution(res.rows, column);
  }


  async queryRanking(tableName: string, metric: string, limit: number): Promise<any[]> {
    const conn = await getDuckDBConnection();
    const sql = `
      SELECT *
      FROM "${tableName}"
      WHERE "${metric}" IS NOT NULL AND TRY_CAST("${metric}" AS DOUBLE) IS NOT NULL
      ORDER BY TRY_CAST("${metric}" AS DOUBLE) DESC
      LIMIT ${limit};
    `;
    const res = await conn.query(sql);
    const rows: any[] = [];
    for (let i = 0; i < res.numRows; i++) {
      const obj: any = {};
      for (const field of res.schema.fields) {
        obj[field.name] = res.getChild(field.name)?.get(i);
      }
      rows.push(obj);
    }
    return rows;
  }

  async ranking(
    source: DataSource | any[],
    metric: string,
    limit: number,
    groupBy?: string
  ): Promise<any[]> {
    const res = resolveSource(source);
    if (res.isTable) {
      if (groupBy) {
        const groups = await this.queryGroupedAggregate(res.tableName, metric, groupBy);
        groups.sort((a, b) => b.average_value - a.average_value);
        return groups.slice(0, limit);
      }
      return this.queryRanking(res.tableName, metric, limit);
    }
    if (inMemoryComputeEngine.ranking) {
      return inMemoryComputeEngine.ranking(res.rows, metric, limit, groupBy);
    }
    return [];
  }

  // ── Asynchronous Vectorized Pushdown Methods (DuckDB Kernel) ─────────────────

  /**
   * Vectorized Grouped Aggregate pushdown.
   * Only the ~20 group rows are returned across the Web Worker boundary.
   */
  async queryGroupedAggregate(
    tableNameOrRows: string | any[],
    metric: string,
    groupBy: string,
    aggregation?: Aggregation
  ): Promise<GroupedAggregateRow[]> {
    const conn = await getDuckDBConnection();
    const isScratch = typeof tableNameOrRows !== 'string';
    const scratchName = isScratch ? `_scratch_grp_${Date.now()}_${Math.random().toString(36).slice(2)}` : '';
    const table = isScratch ? `"${scratchName}"` : `"${tableNameOrRows}"`;

    if (isScratch) {
      await registerMemoryTable(scratchName, tableNameOrRows);
    }

    try {
      const aggExpr = aggregation === 'SUM' ? `COALESCE(SUM(TRY_CAST("${metric}" AS DOUBLE)), 0)`
        : aggregation === 'COUNT' ? `COUNT(CASE WHEN TRY_CAST("${metric}" AS DOUBLE) IS NOT NULL AND isfinite(TRY_CAST("${metric}" AS DOUBLE)) THEN 1 END)`
        : aggregation === 'MIN' ? `COALESCE(MIN(TRY_CAST("${metric}" AS DOUBLE)), 0)`
        : aggregation === 'MAX' ? `COALESCE(MAX(TRY_CAST("${metric}" AS DOUBLE)), 0)`
        : `COALESCE(AVG(TRY_CAST("${metric}" AS DOUBLE)), 0)`;

      const sql = `
        SELECT 
          CAST("${groupBy}" AS VARCHAR) AS category_label,
          ${aggExpr} AS aggregate_value,
          COALESCE(AVG(TRY_CAST("${metric}" AS DOUBLE)), 0) AS average_value,
          COUNT(*)::BIGINT AS record_count,
          COUNT(CASE WHEN TRY_CAST("${metric}" AS DOUBLE) IS NOT NULL AND isfinite(TRY_CAST("${metric}" AS DOUBLE)) THEN 1 END)::BIGINT AS valid_count
        FROM ${table}
        WHERE "${groupBy}" IS NOT NULL AND CAST("${groupBy}" AS VARCHAR) != ''
        GROUP BY "${groupBy}";
      `;

      const result = await conn.query(sql);
      const rows: GroupedAggregateRow[] = [];
      
      for (let i = 0; i < result.numRows; i++) {
        const cat = String(result.getChild('category_label')?.get(i) ?? '');
        const aggVal = Number(result.getChild('aggregate_value')?.get(i) ?? 0);
        const avgVal = Number(result.getChild('average_value')?.get(i) ?? 0);
        const recCount = Number(result.getChild('record_count')?.get(i) ?? 0);
        const valCount = Number(result.getChild('valid_count')?.get(i) ?? 0);
        rows.push({
          category_label: cat,
          aggregate_value: aggVal,
          average_value: avgVal,
          record_count: recCount,
          valid_count: valCount,
          count: valCount
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
  /**
   * Vectorized pairwise profile pushdown.
   * Reports total rows, non-null counts, valid numeric pair counts, distinct counts
   * and extracts distinct category values for binary mapping without materializing rows.
   */
  async queryProfilePair(
    tableNameOrRows: string | any[],
    xColumn: string,
    yColumn: string,
    distinctCap: number = 20
  ): Promise<PairProfile> {
    const conn = await getDuckDBConnection();
    const isScratch = typeof tableNameOrRows !== 'string';
    const scratchName = isScratch ? `_scratch_prof_${Date.now()}_${Math.random().toString(36).slice(2)}` : '';
    const table = isScratch ? `"${scratchName}"` : `"${tableNameOrRows}"`;

    if (isScratch) {
      await registerMemoryTable(scratchName, tableNameOrRows);
    }

    try {
      const sql = `
        SELECT 
          COUNT(*)::BIGINT AS total_rows,
          COUNT("${xColumn}")::BIGINT AS x_non_null,
          COUNT("${yColumn}")::BIGINT AS y_non_null,
          COUNT(CASE WHEN TRY_CAST("${xColumn}" AS DOUBLE) IS NOT NULL AND isfinite(TRY_CAST("${xColumn}" AS DOUBLE)) THEN 1 END)::BIGINT AS x_valid_num,
          COUNT(CASE WHEN TRY_CAST("${yColumn}" AS DOUBLE) IS NOT NULL AND isfinite(TRY_CAST("${yColumn}" AS DOUBLE)) THEN 1 END)::BIGINT AS y_valid_num,
          COUNT(CASE 
            WHEN TRY_CAST("${xColumn}" AS DOUBLE) IS NOT NULL AND isfinite(TRY_CAST("${xColumn}" AS DOUBLE))
             AND TRY_CAST("${yColumn}" AS DOUBLE) IS NOT NULL
            AND isfinite(TRY_CAST("${xColumn}" AS DOUBLE))
            AND isfinite(TRY_CAST("${yColumn}" AS DOUBLE)) AND isfinite(TRY_CAST("${yColumn}" AS DOUBLE))
            THEN 1 END)::BIGINT AS pair_valid_count,
          COUNT(DISTINCT "${xColumn}")::BIGINT AS x_distinct,
          COUNT(DISTINCT "${yColumn}")::BIGINT AS y_distinct
        FROM ${table};
      `;

      const res = await conn.query(sql);
      const totalRows = Number(res.getChild('total_rows')?.get(0) ?? 0);
      const xNonNull = Number(res.getChild('x_non_null')?.get(0) ?? 0);
      const yNonNull = Number(res.getChild('y_non_null')?.get(0) ?? 0);
      const xValidNum = Number(res.getChild('x_valid_num')?.get(0) ?? 0);
      const yValidNum = Number(res.getChild('y_valid_num')?.get(0) ?? 0);
      const pairValid = Number(res.getChild('pair_valid_count')?.get(0) ?? 0);
      const xDistinct = Number(res.getChild('x_distinct')?.get(0) ?? 0);
      const yDistinct = Number(res.getChild('y_distinct')?.get(0) ?? 0);

      const xVals: any[] = [];
      const yVals: any[] = [];
      if (xDistinct <= distinctCap && xDistinct > 0) {
        const xDistRes = await conn.query(`SELECT DISTINCT "${xColumn}" AS val FROM ${table} WHERE "${xColumn}" IS NOT NULL LIMIT ${distinctCap};`);
        for (let i = 0; i < xDistRes.numRows; i++) xVals.push(xDistRes.getChild('val')?.get(i));
      }
      if (yDistinct <= distinctCap && yDistinct > 0) {
        const yDistRes = await conn.query(`SELECT DISTINCT "${yColumn}" AS val FROM ${table} WHERE "${yColumn}" IS NOT NULL LIMIT ${distinctCap};`);
        for (let i = 0; i < yDistRes.numRows; i++) yVals.push(yDistRes.getChild('val')?.get(i));
      }

      return {
        count: pairValid,
        totalRows,
        xNonNullCount: xNonNull,
        yNonNullCount: yNonNull,
        pairValidCount: pairValid,
        xAllNumeric: xNonNull > 0 && xValidNum === xNonNull,
        yAllNumeric: yNonNull > 0 && yValidNum === yNonNull,
        xDistinct: xVals,
        yDistinct: yVals,
        xDistinctCount: xDistinct,
        yDistinctCount: yDistinct,
        xDistinctTruncated: xDistinct > distinctCap,
        yDistinctTruncated: yDistinct > distinctCap
      };
    } finally {
      if (isScratch) {
        try { await conn.query(`DROP TABLE IF EXISTS "${scratchName}";`); } catch {}
      }
    }
  }

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
        WHERE ${xExpr} IS NOT NULL AND ${yExpr} IS NOT NULL AND isfinite(${xExpr}) AND isfinite(${yExpr})
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
        WHERE ${xExpr} IS NOT NULL AND ${yExpr} IS NOT NULL AND isfinite(${xExpr}) AND isfinite(${yExpr});
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
        WHERE ${xExpr} IS NOT NULL AND ${yExpr} IS NOT NULL AND isfinite(${xExpr}) AND isfinite(${yExpr})
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
      const statsSql = `
        SELECT 
          COUNT(*)::BIGINT AS total_count,
          COUNT(CASE WHEN TRY_CAST("${column}" AS DOUBLE) IS NOT NULL AND isfinite(TRY_CAST("${column}" AS DOUBLE)) THEN 1 END)::BIGINT AS numeric_count,
          MIN(TRY_CAST("${column}" AS DOUBLE)) AS min_val,
          MAX(TRY_CAST("${column}" AS DOUBLE)) AS max_val,
          COUNT(DISTINCT "${column}")::BIGINT AS approx_distinct
        FROM ${table}
        WHERE "${column}" IS NOT NULL AND CAST("${column}" AS VARCHAR) != '';
      `;

      const statsRes = await conn.query(statsSql);
      const totalCount = Number(statsRes.getChild('total_count')?.get(0) ?? 0);
      const numericCount = Number(statsRes.getChild('numeric_count')?.get(0) ?? 0);
      const minVal = Number(statsRes.getChild('min_val')?.get(0) ?? 0);
      const maxVal = Number(statsRes.getChild('max_val')?.get(0) ?? 0);
      const distinctCount = Number(statsRes.getChild('approx_distinct')?.get(0) ?? 0);
      const excludedCount = totalCount - numericCount;

      if (totalCount === 0) {
        return { isNumeric: false, rows: [], totalCount: 0, excludedCount: 0 };
      }

      const isNumeric = numericCount > 0 && (numericCount / totalCount) > 0.8;

      if (isNumeric) {
        // Discrete frequency branch: D <= 5 (one bucket per distinct value with exact labels)
        if (distinctCount <= 5 && distinctCount > 0) {
          const discreteSql = `
            SELECT 
              TRY_CAST("${column}" AS DOUBLE) AS val,
              COUNT(*)::BIGINT AS count
            FROM ${table}
            WHERE TRY_CAST("${column}" AS DOUBLE) IS NOT NULL 
              AND isfinite(TRY_CAST("${column}" AS DOUBLE))
            GROUP BY 1
            ORDER BY 1 ASC;
          `;
          const discRes = await conn.query(discreteSql);
          const rows: DistributionBin[] = [];
          for (let i = 0; i < discRes.numRows; i++) {
            const v = Number(discRes.getChild('val')?.get(i) ?? 0);
            const cnt = Number(discRes.getChild('count')?.get(i) ?? 0);
            const label = Number.isInteger(v) ? String(v) : v.toFixed(2);
            rows.push({
              binRange: label,
              binLabel: label,
              category_label: label,
              count: cnt,
              minVal: v,
              maxVal: v
            });
          }
          return { isNumeric: true, type: 'discrete', rows, totalCount: numericCount, excludedCount };
        }

        // Constant values: 1 constant-value bin; never divide by zero
        if (minVal === maxVal || numericCount <= 1) {
          const label = Number.isInteger(minVal) ? String(minVal) : minVal.toFixed(2);
          return {
            isNumeric: true,
            type: 'continuous',
            totalCount: numericCount,
            excludedCount,
            rows: [{
              binRange: label,
              binLabel: label,
              count: numericCount,
              minVal,
              maxVal
            }]
          };
        }

        // Adaptive bin count: B = min(20, max(1, min(N, min(D, ceil(log2(N) + 1)))))
        const sturges = Math.ceil(Math.log2(numericCount) + 1);
        const binCount = Math.min(20, Math.max(1, Math.min(numericCount, Math.min(distinctCount, sturges))));
        const binWidth = (maxVal - minVal) / binCount;

        // Zero-based bin indexing SQL: LEAST(B-1, GREATEST(0, FLOOR((x - min) / w)))
        const binSql = `
          SELECT 
            LEAST(
              ${binCount - 1}, 
              GREATEST(0, FLOOR((TRY_CAST("${column}" AS DOUBLE) - ${minVal}) / ${binWidth})::BIGINT)
            ) AS b_idx,
            COUNT(*)::BIGINT AS count
          FROM ${table}
          WHERE TRY_CAST("${column}" AS DOUBLE) IS NOT NULL 
            AND isfinite(TRY_CAST("${column}" AS DOUBLE))
          GROUP BY 1
          ORDER BY 1;
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
            count: bucketMap.get(i) || 0,
            minVal: start,
            maxVal: end
          });
        }

        return { isNumeric: true, type: 'continuous', rows, totalCount: numericCount, excludedCount };
      } else {
        // Categorical distribution pushdown (top 50 categories)
        const catSql = `
          SELECT 
            CAST("${column}" AS VARCHAR) AS cat_val,
            COUNT(*)::BIGINT AS count
          FROM ${table}
          WHERE "${column}" IS NOT NULL AND CAST("${column}" AS VARCHAR) != ''
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

        return { isNumeric: false, type: 'discrete', rows, totalCount, excludedCount: 0 };
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
          WHERE TRY_CAST("${xColumn}" AS DOUBLE) IS NOT NULL
            AND TRY_CAST("${yColumn}" AS DOUBLE) IS NOT NULL
            AND isfinite(TRY_CAST("${xColumn}" AS DOUBLE))
            AND isfinite(TRY_CAST("${yColumn}" AS DOUBLE))
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
