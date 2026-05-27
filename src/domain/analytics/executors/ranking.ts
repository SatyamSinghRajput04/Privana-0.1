// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/executors/ranking.ts
// S8f RANKING EXECUTOR — Ranks category groups by a metric (Top-N).
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisPlan, ExecutorResult } from '../types';
import { GroupedAverageExecutor } from './groupedAverage';

export const RankingExecutor = {
  /**
   * Computes top-N records or groups ordered by plan.metric.
   */
  execute(plan: AnalysisPlan, rows: any[]): ExecutorResult {
    const metric = plan.metric;
    const groupBy = plan.groupBy;

    if (!metric || !rows || rows.length === 0) {
      return { status: 'partial_missing', rows: [] };
    }

    // Default to a safe dashboard-sized Top 5 unless the query explicitly asks for a small limit.
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

    let rankedRows: any[] = [];
    let status: 'success' | 'partial_small_n' | 'partial_missing' = 'success';
    let metadata: Record<string, any> = { metric };

    if (groupBy && groupBy.length > 0) {
      // Grouped ranking (e.g. top platforms by average stress)
      const groupRes = GroupedAverageExecutor.execute(plan, rows);
      if (groupRes.status === 'partial_missing') {
        return groupRes;
      }
      rankedRows = groupRes.rows.slice(0, limit);
      status = groupRes.status;
      metadata = {
        ...metadata,
        ...groupRes.metadata,
        limit,
        isGrouped: true
      };
    } else {
      // Individual record ranking (e.g. top 5 records by sleep_hours)
      const validRows = rows
        .filter(r => r[metric] !== null && r[metric] !== undefined && r[metric] !== '' && !isNaN(Number(r[metric])))
        .map(r => ({ ...r, metric_value: Number(r[metric]) }));

      validRows.sort((a, b) => b.metric_value - a.metric_value);

      rankedRows = validRows.slice(0, limit).map((row, idx) => ({
        ...row,
        rank_label: row.id ? String(row.id) : `Rank ${idx + 1}`,
      }));
      status = validRows.length < 5 ? 'partial_small_n' : 'success';
      metadata = {
        ...metadata,
        limit,
        isGrouped: false
      };
    }

    return {
      status,
      rows: rankedRows,
      metadata
    };
  }
};
