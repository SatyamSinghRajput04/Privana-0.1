// ─────────────────────────────────────────────────────────────────────────────
// src/domain/compute/inMemoryComputeEngine.ts
// IN-MEMORY COMPUTE ENGINE — current implementation of ComputeEngine.
//
// Every method is a direct single-pass loop over the row array, NOT an
// AlaSQL query, and that choice is measured rather than assumed. Benchmarked
// at 800k rows for groupedAggregate:
//
//   pure single-pass JS loop ............... 30ms
//   pre-clean pass + AlaSQL GROUP BY ....... 177ms  (129ms clean + 48ms SQL)
//
// AlaSQL's own aggregation is genuinely fast (48ms). The problem is getting
// data *into* it: AlaSQL cannot aggregate the raw row array directly without
// replicating this codebase's null/non-numeric filtering semantics (verified:
// its AVG() passes non-numeric strings straight through instead of excluding
// them, and null group keys become their own group instead of being dropped).
// Pre-cleaning into a second array costs a full extra pass plus one object
// allocation per row — more than the entire original loop.
//
// The general lesson, which matters for the planned DuckDB-Wasm work: while
// the engine's input is a JS array, *something* must walk that array, and for
// a single-pass aggregate the hand-rolled loop is already optimal. Pushing
// aggregation "into SQL" only pays off once the engine owns the data in its
// own columnar storage and never materializes rows in JS at all. So the value
// of this interface right now is the SEAM (one aggregation implementation
// instead of one per executor, and a swap point for a future engine), not
// speed — and the honest fastest implementation of that seam today is the
// loop itself.
// ─────────────────────────────────────────────────────────────────────────────

import {
  DataSource,
  ComputeEngine,
  GroupedAggregateRow,
  PairProfile,
  PairMoments,
  MomentsRequest,
  BinaryEncoding,
  DistributionBin,
  DistributionResult,
  Aggregation
} from './ComputeEngine';

/** Shared data-validity rule: a pair row counts only if BOTH sides are present. */
function isPresent(v: any): boolean {
  return v !== null && v !== undefined && v !== '';
}

/** Declarative binary encoding. See BinaryEncoding.matchMode for why both modes exist. */
function encodeBinary(raw: any, encoding: BinaryEncoding): number {
  if (raw === encoding.positiveValue) return 1;
  if (encoding.matchMode === 'loose' && String(raw) === String(encoding.positiveValue)) return 1;
  return 0;
}

function readValue(raw: any, encoding?: BinaryEncoding): number {
  return encoding ? encodeBinary(raw, encoding) : Number(raw);
}

/**
 * Resolves raw rows from a DataSource or array.
 * CRITICAL INVARIANT: Prohibits silent fallback when a DuckDB table is targeted.
 */
function extractRows(source: DataSource | any[]): any[] {
  if (Array.isArray(source)) return source;
  if (source && source.kind === 'in-memory-rows') return source.rows;
  if (source && source.kind === 'duckdb-table') {
    throw new Error(
      `[InMemoryComputeEngine Invariant Violation] Cannot calculate full-dataset statistics on DuckDB table "${source.tableName}". ` +
      `Only a partial preview sample is in JavaScript memory. To protect analytical integrity, silent fallback is prohibited. ` +
      `Full-dataset queries must execute via DuckDBComputeEngine.`
    );
  }
  return [];
}

export const inMemoryComputeEngine: ComputeEngine = {
  groupedAggregate(source: DataSource | any[], metric: string, groupBy: string, aggregation?: Aggregation): GroupedAggregateRow[] {
    const rows = extractRows(source);
    if (!rows || rows.length === 0) return [];

    const groups: Record<string, { sum: number; count: number; validCount: number; min: number; max: number }> = {};
    for (const r of rows) {
      const gVal = r[groupBy];
      if (gVal === null || gVal === undefined || gVal === '') continue;
      const key = String(gVal);
      if (!groups[key]) groups[key] = { sum: 0, count: 0, validCount: 0, min: Infinity, max: -Infinity };
      groups[key].count++;

      const rawM = r[metric];
      if (rawM === null || rawM === undefined || rawM === '') continue;
      const mVal = Number(rawM);
      if (isNaN(mVal) || !isFinite(mVal)) continue;

      groups[key].validCount++;
      groups[key].sum += mVal;
      if (mVal < groups[key].min) groups[key].min = mVal;
      if (mVal > groups[key].max) groups[key].max = mVal;
    }

    return Object.entries(groups).map(([groupVal, stats]) => {
      const valid = stats.validCount;
      const avg = valid > 0 ? stats.sum / valid : 0;
      let agg = avg;
      if (aggregation === 'SUM') agg = stats.sum;
      else if (aggregation === 'COUNT') agg = valid;
      else if (aggregation === 'MIN') agg = valid > 0 ? stats.min : 0;
      else if (aggregation === 'MAX') agg = valid > 0 ? stats.max : 0;

      return {
        category_label: groupVal,
        aggregate_value: agg,
        average_value: avg,
        record_count: stats.count,
        valid_count: valid,
        count: valid
      };
    });
  },

  profilePair(source: DataSource | any[], xColumn: string, yColumn: string, distinctCap = 3): PairProfile {
    const rows = extractRows(source);
    const profile: PairProfile = {
      count: 0,
      xAllNumeric: true,
      yAllNumeric: true,
      xDistinct: [],
      yDistinct: [],
      xDistinctTruncated: false,
      yDistinctTruncated: false
    };
    if (!rows || rows.length === 0) return profile;

    // Sets mirror the distinct arrays purely for O(1) membership testing;
    // the arrays preserve first-seen order, which binary-mapping resolution
    // depends on.
    const xSeen = new Set<any>();
    const ySeen = new Set<any>();

    for (const r of rows) {
      const xRaw = r[xColumn];
      const yRaw = r[yColumn];
      if (!isPresent(xRaw) || !isPresent(yRaw)) continue;

      profile.count++;

      if (profile.xAllNumeric && isNaN(Number(xRaw))) profile.xAllNumeric = false;
      if (profile.yAllNumeric && isNaN(Number(yRaw))) profile.yAllNumeric = false;

      if (!xSeen.has(xRaw)) {
        if (profile.xDistinct.length < distinctCap) {
          xSeen.add(xRaw);
          profile.xDistinct.push(xRaw);
        } else {
          profile.xDistinctTruncated = true;
        }
      }
      if (!ySeen.has(yRaw)) {
        if (profile.yDistinct.length < distinctCap) {
          ySeen.add(yRaw);
          profile.yDistinct.push(yRaw);
        } else {
          profile.yDistinctTruncated = true;
        }
      }
    }

    return profile;
  },

  moments(source: DataSource | any[], request: MomentsRequest): PairMoments {
    const rows = extractRows(source);
    const m: PairMoments = {
      count: 0,
      shiftX: 0,
      shiftY: 0,
      sumX: 0,
      sumY: 0,
      sumXY: 0,
      sumX2: 0,
      sumY2: 0,
      xAllIdentical: true,
      yAllIdentical: true
    };
    if (!rows || rows.length === 0) return m;

    const { xColumn, yColumn, xEncoding, yEncoding } = request;
    let haveShift = false;

    for (const r of rows) {
      const xRaw = r[xColumn];
      const yRaw = r[yColumn];
      if (!isPresent(xRaw) || !isPresent(yRaw)) continue;

      const xVal = readValue(xRaw, xEncoding);
      const yVal = readValue(yRaw, yEncoding);

      // The first complete pair sets the shift origin. Any constant works
      // (correlation is shift-invariant); the first observed value is used
      // because it needs no extra pass and is guaranteed to be on the same
      // scale as the data. See PairMoments for why shifting is required.
      if (!haveShift) {
        m.shiftX = xVal;
        m.shiftY = yVal;
        haveShift = true;
      }

      const x = xVal - m.shiftX;
      const y = yVal - m.shiftY;

      // Identity flags compare shifted values, which is equivalent to
      // comparing raw ones since the shift is a single constant per column.
      if (m.count > 0) {
        if (m.xAllIdentical && x !== 0) m.xAllIdentical = false;
        if (m.yAllIdentical && y !== 0) m.yAllIdentical = false;
      }

      m.count++;
      m.sumX += x;
      m.sumY += y;
      m.sumXY += x * y;
      m.sumX2 += x * x;
      m.sumY2 += y * y;
    }

    return m;
  },

  samplePoints(source: DataSource | any[], request: MomentsRequest, limit: number): { x: number; y: number }[] {
    const rows = extractRows(source);
    if (!rows || rows.length === 0 || limit <= 0) return [];

    const { xColumn, yColumn, xEncoding, yEncoding } = request;
    const reservoir: { x: number; y: number }[] = [];
    let seen = 0;

    for (const r of rows) {
      const xRaw = r[xColumn];
      const yRaw = r[yColumn];
      if (!isPresent(xRaw) || !isPresent(yRaw)) continue;

      const point = { x: readValue(xRaw, xEncoding), y: readValue(yRaw, yEncoding) };

      if (reservoir.length < limit) {
        reservoir.push(point);
      } else {
        // Reservoir sampling keeps coverage uniform across the whole dataset
        // rather than favouring the first `limit` rows.
        const j = Math.floor(Math.random() * (seen + 1));
        if (j < limit) reservoir[j] = point;
      }
      seen++;
    }

    return reservoir;
  },

  distribution(source: DataSource | any[], column: string): DistributionResult {
    const rows = extractRows(source);
    if (!rows || rows.length === 0 || !column) {
      return { isNumeric: false, rows: [], totalCount: 0, excludedCount: 0 };
    }

    const numericVals: number[] = [];
    const categoricalCounts: Record<string, number> = {};
    const distinctSet = new Set<any>();
    let presentCount = 0;
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < rows.length; i++) {
      const v = rows[i][column];
      if (v === null || v === undefined || v === '') continue;
      presentCount++;
      distinctSet.add(v);

      const numV = Number(v);
      if (!isNaN(numV) && isFinite(numV) && typeof v !== 'boolean') {
        numericVals.push(numV);
        if (numV < min) min = numV;
        if (numV > max) max = numV;
      } else {
        const s = String(v);
        categoricalCounts[s] = (categoricalCounts[s] || 0) + 1;
      }
    }

    if (presentCount === 0) {
      return { isNumeric: false, rows: [], totalCount: 0, excludedCount: 0 };
    }

    const excludedCount = presentCount - numericVals.length;
    const isNumeric = numericVals.length > 0 && (numericVals.length / presentCount) > 0.8;
    const distinctCount = distinctSet.size;

    if (isNumeric) {
      // Discrete frequency branch: D <= 5 (one bucket per distinct value with exact labels)
      if (distinctCount <= 5 && distinctCount > 0) {
        const valueCounts = new Map<number, number>();
        for (const num of numericVals) {
          valueCounts.set(num, (valueCounts.get(num) || 0) + 1);
        }
        const sortedVals = Array.from(valueCounts.keys()).sort((a, b) => a - b);
        const rows: DistributionBin[] = sortedVals.map(val => {
          const label = Number.isInteger(val) ? String(val) : val.toFixed(2);
          return {
            binRange: label,
            binLabel: label,
            category_label: label,
            count: valueCounts.get(val) || 0,
            minVal: val,
            maxVal: val
          };
        });
        return { isNumeric: true, type: 'discrete', rows, totalCount: numericVals.length, excludedCount };
      }

      // Constant values: 1 constant-value bin; never divide by zero
      if (min === max || numericVals.length <= 1) {
        const label = Number.isInteger(min) ? String(min) : min.toFixed(2);
        return {
          isNumeric: true,
          type: 'continuous',
          totalCount: numericVals.length,
          excludedCount,
          rows: [{
            binRange: label,
            binLabel: label,
            count: numericVals.length,
            minVal: min,
            maxVal: max
          }]
        };
      }

      // Adaptive bin count: B = min(20, max(1, min(N, min(D, ceil(log2(N) + 1)))))
      const sturges = Math.ceil(Math.log2(numericVals.length) + 1);
      const binCount = Math.min(20, Math.max(1, Math.min(numericVals.length, Math.min(distinctCount, sturges))));
      const binWidth = (max - min) / binCount;
      const counts = new Array(binCount).fill(0);

      for (let i = 0; i < numericVals.length; i++) {
        const v = numericVals[i];
        const binIndex = Math.min(binCount - 1, Math.max(0, Math.floor((v - min) / binWidth)));
        counts[binIndex]++;
      }

      const rows: DistributionBin[] = [];
      for (let i = 0; i < binCount; i++) {
        const start = min + i * binWidth;
        const end = (i === binCount - 1) ? max : start + binWidth;
        const label = `${start.toFixed(1)} - ${end.toFixed(1)}`;
        rows.push({
          binRange: label,
          binLabel: label,
          count: counts[i],
          minVal: start,
          maxVal: end
        });
      }

      return { isNumeric: true, type: 'continuous', rows, totalCount: numericVals.length, excludedCount };
    } else {
      for (let i = 0; i < numericVals.length; i++) {
        const s = String(numericVals[i]);
        categoricalCounts[s] = (categoricalCounts[s] || 0) + 1;
      }
      const rows: DistributionBin[] = Object.entries(categoricalCounts)
        .map(([key, count]) => ({
          binRange: key,
          binLabel: key,
          category_label: key,
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);

      return { isNumeric: false, type: 'discrete', rows, totalCount: presentCount, excludedCount: 0 };
    }
  },

    ranking(source: DataSource | any[], metric: string, limit: number, groupBy?: string): any[] {
    const rows = extractRows(source);
    if (groupBy) {
      const groups = (this.groupedAggregate(rows, metric, groupBy) as GroupedAggregateRow[]);
      groups.sort((a: any, b: any) => b.average_value - a.average_value);
      return groups.slice(0, limit);
    }
    const valid = rows.filter(r => r[metric] !== null && r[metric] !== undefined && !isNaN(Number(r[metric])));
    valid.sort((a, b) => Number(b[metric]) - Number(a[metric]));
    return valid.slice(0, limit);
  }
};
