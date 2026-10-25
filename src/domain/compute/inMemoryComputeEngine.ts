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
  ComputeEngine,
  GroupedAggregateRow,
  PairProfile,
  PairMoments,
  MomentsRequest,
  BinaryEncoding,
  DistributionBin,
  DistributionResult
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

export const inMemoryComputeEngine: ComputeEngine = {
  groupedAggregate(rows: any[], metric: string, groupBy: string): GroupedAggregateRow[] {
    if (!rows || rows.length === 0) return [];

    const groups: Record<string, { sum: number; count: number }> = {};
    for (const r of rows) {
      const gVal = r[groupBy];
      const rawM = r[metric];
      if (gVal === null || gVal === undefined || gVal === '' || rawM === null || rawM === undefined || rawM === '') continue;
      const mVal = Number(rawM);
      if (isNaN(mVal)) continue;
      const key = String(gVal);
      if (!groups[key]) groups[key] = { sum: 0, count: 0 };
      groups[key].sum += mVal;
      groups[key].count++;
    }

    return Object.entries(groups).map(([groupVal, stats]) => ({
      category_label: groupVal,
      average_value: stats.sum / stats.count,
      count: stats.count
    }));
  },

  profilePair(rows: any[], xColumn: string, yColumn: string, distinctCap = 3): PairProfile {
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

  moments(rows: any[], request: MomentsRequest): PairMoments {
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

  samplePoints(rows: any[], request: MomentsRequest, limit: number): { x: number; y: number }[] {
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

  distribution(rows: any[], column: string): DistributionResult {
    if (!rows || rows.length === 0 || !column) {
      return { isNumeric: false, rows: [], totalCount: 0 };
    }

    const numericVals: number[] = [];
    const categoricalCounts: Record<string, number> = {};
    let presentCount = 0;
    let hasNonInteger = false;
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < rows.length; i++) {
      const v = rows[i][column];
      if (v === null || v === undefined || v === '') continue;
      presentCount++;

      const numV = Number(v);
      if (!isNaN(numV) && typeof v !== 'boolean') {
        numericVals.push(numV);
        if (numV < min) min = numV;
        if (numV > max) max = numV;
        if (!Number.isInteger(numV)) hasNonInteger = true;
      } else {
        const s = String(v);
        categoricalCounts[s] = (categoricalCounts[s] || 0) + 1;
      }
    }

    if (presentCount === 0) {
      return { isNumeric: false, rows: [], totalCount: 0 };
    }

    let uniqueNumericSize = 0;
    if (hasNonInteger) {
      uniqueNumericSize = 11;
    } else {
      const tempSet = new Set<number>();
      for (let i = 0; i < numericVals.length; i++) {
        tempSet.add(numericVals[i]);
        if (tempSet.size > 10) {
          uniqueNumericSize = 11;
          break;
        }
      }
      uniqueNumericSize = tempSet.size;
    }

    const isNumeric = numericVals.length > 0 &&
                      (numericVals.length / presentCount) > 0.8 &&
                      (uniqueNumericSize > 10 || hasNonInteger);

    const distributionRows: DistributionBin[] = [];

    if (isNumeric) {
      const range = max - min;
      if (range === 0) {
        distributionRows.push({
          binRange: `${min}`,
          binLabel: `${min}`,
          count: numericVals.length,
          minVal: min,
          maxVal: max,
        });
      } else {
        const binCount = Math.ceil(Math.log2(numericVals.length) + 1);
        const binWidth = range / binCount;
        const counts = new Array(binCount).fill(0);

        for (let i = 0; i < numericVals.length; i++) {
          const v = numericVals[i];
          let binIndex = Math.floor((v - min) / binWidth);
          if (binIndex >= binCount) binIndex = binCount - 1;
          if (binIndex < 0) binIndex = 0;
          counts[binIndex]++;
        }

        for (let i = 0; i < binCount; i++) {
          const start = min + i * binWidth;
          const end = (i === binCount - 1) ? max : start + binWidth;
          const label = `${start.toFixed(1)} - ${end.toFixed(1)}`;
          distributionRows.push({
            binRange: label,
            binLabel: label,
            count: counts[i],
            minVal: start,
            maxVal: end,
          });
        }
      }
    } else {
      // Add numeric values as strings if non-numeric classification
      for (let i = 0; i < numericVals.length; i++) {
        const s = String(numericVals[i]);
        categoricalCounts[s] = (categoricalCounts[s] || 0) + 1;
      }

      for (const [key, count] of Object.entries(categoricalCounts)) {
        distributionRows.push({
          binRange: key,
          binLabel: key,
          category_label: key,
          count,
        });
      }
      distributionRows.sort((a, b) => b.count - a.count);
    }

    return {
      isNumeric,
      rows: distributionRows,
      totalCount: presentCount
    };
  }
};
