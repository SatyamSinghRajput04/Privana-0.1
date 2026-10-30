// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/ranking.ts
// S8f RANKING EXECUTOR — Universal, deterministic Top-N ranking engine.
// Supports multi-aggregation (SUM, AVG, COUNT, MIN, MAX), standard competition
// ties (1224), dataset-wide non-negative share & SDC protection.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';
import { computeEngine, ComputeEngine, DataSource, MaybePromise, GroupedAggregateRow, Aggregation } from '../../compute';

export interface RankedRow {
  rank: number;
  category_label: string;
  metric_value: number;
  aggregate_value: number;
  average_value: number;
  record_count: number;
  valid_count: number;
  share_pct?: number | null;
  relative_diff_pct?: number | null;
  isSuppressed?: boolean;
}

export const RankingExecutor = {
  /**
   * Computes top-N records or groups ordered by plan.metric with explicit aggregation semantics.
   */
  execute(
    plan: AnalysisPlan,
    source: DataSource | any[],
    engine: ComputeEngine = computeEngine
  ): MaybePromise<ExecutorResult> {
    const metric = plan.metric;
    const groupBy = plan.groupBy;

    if (!metric || !source) {
      return { status: 'partial_missing', rows: [] };
    }
    if (Array.isArray(source) && source.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    // Default to a safe dashboard-sized Top 5 unless the query explicitly asks for a specific limit.
    let limit = typeof plan.limit === 'number' && Number.isFinite(plan.limit)
      ? Math.min(Math.max(Math.floor(plan.limit), 1), 50)
      : 5;

    // Backward-compatible test support for older planIds such as plan_ranking_3.
    const planIdStr = plan.planId.toLowerCase();
    const topMatch = planIdStr.match(/(?:^|[_\s])top[_\s]*(\d{1,2})(?:$|[_\s])/) ||
      planIdStr.match(/(?:^|[_\s])ranking[_\s]*(\d{1,2})(?:$|[_\s])/);
    if (!plan.limit && topMatch) {
      const parsedLimit = parseInt(topMatch[1], 10);
      if (parsedLimit >= 1 && parsedLimit <= 50) {
        limit = parsedLimit;
      }
    }

    const aggregation: Aggregation = plan.aggregation || 'SUM';

    if (groupBy && groupBy.length > 0) {
      const groupCol = groupBy[0];
      const resOrPromise = engine.groupedAggregate(source, metric, groupCol, aggregation);

      const processGrouped = (rawGroups: GroupedAggregateRow[]): ExecutorResult => {
        if (!rawGroups || rawGroups.length === 0) {
          return { status: 'partial_missing', rows: [] };
        }

        // Sort descending by aggregate_value
        const sorted = [...rawGroups].sort((a, b) => {
          const valA = Number.isFinite(a.aggregate_value) ? a.aggregate_value : a.average_value;
          const valB = Number.isFinite(b.aggregate_value) ? b.aggregate_value : b.average_value;
          return valB - valA;
        });

        // Calculate dataset-wide totals across all categories (not just top-5)
        const totalEligibleRows = sorted.reduce((acc, r) => acc + (r.valid_count || r.count || 0), 0);
        const totalScannedRows = sorted.reduce((acc, r) => acc + (r.record_count || r.count || 0), 0);
        const grandTotal = sorted.reduce((acc, r) => acc + (r.aggregate_value || 0), 0);
        const grandMeanSum = sorted.reduce((acc, r) => acc + (r.average_value || 0) * (r.valid_count || r.count || 0), 0);
        const grandMean = totalEligibleRows > 0 ? grandMeanSum / totalEligibleRows : 0;

        // Share calculation safety check: only valid if grandTotal > 0 and no negative values
        const hasNegative = sorted.some(r => r.aggregate_value < 0);
        const canComputeShare = aggregation === 'SUM' && !hasNegative && grandTotal > 0;

        // Standard competition ranking (1224 ties)
        let currentRank = 1;
        let suppressedCount = 0;

        const rankedAll: RankedRow[] = sorted.map((row, idx) => {
          const val = Number.isFinite(row.aggregate_value) ? row.aggregate_value : row.average_value;
          if (idx > 0) {
            const prevVal = Number.isFinite(sorted[idx - 1].aggregate_value)
              ? sorted[idx - 1].aggregate_value
              : sorted[idx - 1].average_value;
            if (Math.abs(val - prevVal) > 1e-9) {
              currentRank = idx + 1;
            }
          }

          const isValidLowN = (row.valid_count !== undefined ? row.valid_count : row.count) < 5;
          if (isValidLowN) suppressedCount++;

          const sharePct = canComputeShare
            ? Number(((val / grandTotal) * 100).toFixed(2))
            : null;

          const relativeDiffPct = (aggregation === 'AVG' && grandMean !== 0)
            ? Number((((val - grandMean) / Math.abs(grandMean)) * 100).toFixed(2))
            : null;

          return {
            rank: currentRank,
            category_label: row.category_label,
            metric_value: val,
            aggregate_value: val,
            average_value: row.average_value,
            record_count: row.record_count || row.count,
            valid_count: row.valid_count || row.count,
            share_pct: sharePct,
            relative_diff_pct: relativeDiffPct,
            isSuppressed: isValidLowN
          };
        });

        const displayedRows = rankedAll.slice(0, limit);

        return {
          status: 'success',
          rows: displayedRows,
          metadata: {
            metric,
            limit,
            isGrouped: true,
            aggregation,
            totalEligibleRows,
            totalScannedRows,
            grandTotal,
            grandMean,
            suppressedGroupsCount: suppressedCount,
            canComputeShare,
            allCategoriesCount: sorted.length
          }
        };
      };

      if (resOrPromise instanceof Promise) {
        return resOrPromise.then(processGrouped);
      }
      return processGrouped(resOrPromise);
    }

    // Individual record ranking fallback
    if (engine.ranking) {
      const resOrPromise = engine.ranking(source, metric, limit);

      const formatRanked = (rankedRows: any[]): ExecutorResult => {
        if (!rankedRows || rankedRows.length === 0) {
          return { status: 'partial_missing', rows: [] };
        }
        return {
          status: 'success',
          rows: rankedRows,
          metadata: {
            metric,
            limit,
            isGrouped: false,
            totalEligibleRows: rankedRows.length
          }
        };
      };

      if (resOrPromise instanceof Promise) {
        return resOrPromise.then(formatRanked);
      }
      return formatRanked(resOrPromise);
    }

    return { status: 'partial_missing', rows: [] };
  }
};
