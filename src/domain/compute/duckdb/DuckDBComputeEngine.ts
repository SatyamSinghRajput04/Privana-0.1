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
  BinaryEncoding
} from '../ComputeEngine';
import { inMemoryComputeEngine } from '../inMemoryComputeEngine';
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
    const table = typeof tableNameOrRows === 'string'
      ? `"${tableNameOrRows}"`
      : '"_shadow_grouped"';

    if (typeof tableNameOrRows !== 'string') {
      await registerMemoryTable('_shadow_grouped', tableNameOrRows);
    }

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
    const table = typeof tableNameOrRows === 'string'
      ? `"${tableNameOrRows}"`
      : '"_shadow_moments"';

    if (typeof tableNameOrRows !== 'string') {
      await registerMemoryTable('_shadow_moments', tableNameOrRows);
    }

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
    const table = typeof tableNameOrRows === 'string'
      ? `"${tableNameOrRows}"`
      : '"_shadow_samples"';

    if (typeof tableNameOrRows !== 'string') {
      await registerMemoryTable('_shadow_samples', tableNameOrRows);
    }

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
  }
}

export const duckdbComputeEngine = new DuckDBComputeEngine();
