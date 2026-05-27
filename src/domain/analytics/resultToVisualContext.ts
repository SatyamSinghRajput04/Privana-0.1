// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/resultToVisualContext.ts
// S10 RESULT-TO-VISUAL MAPPING — Maps AnalyticsResult to Chart/Visual metadata.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalyticsResult } from './types';

export interface VisualLayout {
  chartType: 'bar' | 'scatter' | 'line' | 'pie' | 'histogram' | 'none';
  xAxisKey?: string;
  yAxisKey?: string;
  seriesKeys?: string[];
  data: any[];
  title?: string;
  kpis: Array<{ label: string; value: string | number; subText?: string; color?: string }>;
}

export const ResultToVisualContext = {
  /**
   * Maps a computed analytics result to visual layout configuration/chart spec.
   */
  map(result: AnalyticsResult): VisualLayout {
    if (result.status !== 'computed' && result.status !== 'partial') {
      return { chartType: 'none', data: [], kpis: [] };
    }

    const { data, chart, plan } = result;
    const chartType = chart?.chartType || 'none';
    const rawRows = data?.rows || [];

    // Clean rows and format for Recharts
    const chartData = rawRows.map((r, idx) => {
      return {
        ...r,
        key: r.id || r.category_label || r.feature || r.group_label || `row_${idx}`,
      };
    });

    const kpis: Array<{ label: string; value: string | number; subText?: string; color?: string }> = [];

    // Add general KPIs based on Intent
    if (plan.intent === 'distribution') {
      const total = rawRows.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
      kpis.push({
        label: 'Metric Analyzed',
        value: plan.metric || '',
        subText: 'Distribution target',
        color: '#a855f7',
      });
      kpis.push({
        label: 'Total Sample Size',
        value: total.toLocaleString(),
        subText: 'Total records scanned',
        color: '#3b82f6',
      });
    } else if (plan.intent === 'grouped_average') {
      const topGroup = rawRows[0];
      kpis.push({
        label: 'Grouped By',
        value: plan.groupBy?.[0] || '',
        subText: `Target average: ${plan.metric}`,
        color: '#f59e0b',
      });
      if (topGroup) {
        kpis.push({
          label: 'Highest Avg Group',
          value: topGroup.category_label || '',
          subText: `Average: ${Number(topGroup.average_value).toFixed(2)} (n=${topGroup.count})`,
          color: '#10b981',
        });
      }
    } else if (plan.intent === 'correlation') {
      const stats = rawRows[0];
      if (stats) {
        kpis.push({
          label: 'Correlation (r)',
          value: stats.r.toFixed(3),
          subText: `${stats.method} method`,
          color: Math.abs(stats.r) > 0.4 ? '#10b981' : '#f59e0b',
        });
        kpis.push({
          label: 'Significance (p)',
          value: stats.pValue.toFixed(4),
          subText: stats.pValue < 0.05 ? 'Statistically significant' : 'Not significant',
          color: stats.pValue < 0.05 ? '#10b981' : '#ef4444',
        });
      }
    } else if (plan.intent === 'feature_importance') {
      const topPred = rawRows[0];
      kpis.push({
        label: 'Target Outcome',
        value: plan.target || '',
        subText: 'Prediction outcome',
        color: '#3b82f6',
      });
      if (topPred) {
        kpis.push({
          label: 'Top Predictor',
          value: topPred.feature || '',
          subText: `Strength: ${Number(topPred.association).toFixed(3)} (${topPred.method})`,
          color: '#10b981',
        });
      }
    } else if (plan.intent === 'comparison') {
      const sorted = [...rawRows].sort((a: any, b: any) => b.mean - a.mean);
      kpis.push({
        label: 'Groups Compared',
        value: rawRows.length,
        subText: `Compared across ${plan.groupBy?.[0]}`,
        color: '#8b5cf6',
      });
      if (sorted.length >= 2) {
        const diff = sorted[0].mean - sorted[sorted.length - 1].mean;
        kpis.push({
          label: 'Max Difference',
          value: diff.toFixed(2),
          subText: `${sorted[0].group_label} vs ${sorted[sorted.length - 1].group_label}`,
          color: '#ec4899',
        });
      }
    } else if (plan.intent === 'filter') {
      kpis.push({
        label: 'Matches Found',
        value: rawRows.length.toLocaleString(),
        subText: 'Matching filter criteria',
        color: '#10b981',
      });
    }

    return {
      chartType,
      xAxisKey: chart?.xAxisKey,
      yAxisKey: chart?.yAxisKey,
      seriesKeys: chart?.seriesKeys,
      data: chartData,
      title: chart?.title || 'Analysis Visualization',
      kpis,
    };
  }
};
