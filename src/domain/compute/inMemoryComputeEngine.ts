// ─────────────────────────────────────────────────────────────────────────────
// src/domain/compute/inMemoryComputeEngine.ts
// IN-MEMORY COMPUTE ENGINE — Stage 2.1 implementation of ComputeEngine.
//
// This implementation uses a direct single-pass JS reduction, NOT an AlaSQL
// `GROUP BY`, and that choice is measured rather than assumed. Benchmarked at
// 800k rows:
//
//   pure single-pass JS loop ............... 30ms
//   pre-clean pass + AlaSQL GROUP BY ....... 177ms  (129ms clean + 48ms SQL)
//
// AlaSQL's own aggregation is genuinely fast (48ms). The problem is getting
// data *into* it: AlaSQL cannot aggregate the raw row array directly without
// replicating this codebase's null/non-numeric filtering semantics (verified:
// its AVG() passes non-numeric strings straight through instead of excluding
// them, and null group keys become their own group instead of being dropped).
// Pre-cleaning into a second array costs a full extra pass plus 800k object
// allocations — more than the entire original loop.
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

import { ComputeEngine, GroupedAggregateRow } from './ComputeEngine';

export const inMemoryComputeEngine: ComputeEngine = {
  groupedAggregate(rows: any[], metric: string, groupBy: string): GroupedAggregateRow[] {
    if (!rows || rows.length === 0) return [];

    const groups: Record<string, { sum: number; count: number }> = {};
    for (const r of rows) {
      const gVal = r[groupBy];
      const mVal = Number(r[metric]);
      if (gVal === null || gVal === undefined || isNaN(mVal)) continue;
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
  }
};
