// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/resultToVisualContext.ts
// S10 RESULT-TO-VISUAL MAPPING — Maps AnalyticsResult to discriminated VisualContracts.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalyticsResult, VisualContract, AxisSpec, SeriesSpec } from './types';
import { resolveColumns, formatFieldName } from './schemaLookup';
import { verifyContract } from './verifyContract';

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
          value: typeof stats.r === 'number' ? stats.r.toFixed(3) : '0.000',
          subText: `${stats.method || 'Pearson'} method`,
          color: Math.abs(stats.r || 0) > 0.4 ? '#10b981' : '#f59e0b',
        });
        kpis.push({
          label: 'Significance (p)',
          value: typeof stats.pValue === 'number' ? stats.pValue.toFixed(4) : '1.0000',
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
      const sorted = [...rawRows].sort((a: any, b: any) => (b.mean || 0) - (a.mean || 0));
      kpis.push({
        label: 'Groups Compared',
        value: rawRows.length,
        subText: `Compared across ${plan.groupBy?.[0]}`,
        color: '#8b5cf6',
      });
      if (sorted.length >= 2) {
        const diff = (sorted[0].mean || 0) - (sorted[sorted.length - 1].mean || 0);
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

/**
 * SPEC V1.1 DISCRIMINATED VISUAL CONTRACT ADAPTER §1.2
 * Maps AnalyticsResult to immutable, verified VisualContract.
 */
export function mapToVisualContract(result: AnalyticsResult): VisualContract {
  if (result.status !== 'computed' && result.status !== 'partial') {
    return verifyContract({
      kind: 'empty',
      schemaVersion: 1,
      reason: result.status === 'blocked' ? (result as any).reason || 'Query execution blocked by policy.'
            : result.status === 'refused' ? (result as any).message || 'Query refused due to schema mismatch.'
            : 'Result not computed.'
    });
  }

  const { data, plan, provenance } = result;
  const rawRows = data?.rows || [];

  if (!rawRows || rawRows.length === 0) {
    return verifyContract({
      kind: 'empty',
      schemaVersion: 1,
      reason: 'No rows returned for this query.'
    });
  }

  const xAxisLabel = plan.groupBy?.[0] || plan.metric || 'Category';
  const yAxisLabel = plan.metric ? `Average ${formatFieldName(plan.metric)}` : 'Value';

  const xAxis: AxisSpec = { key: 'category', label: formatFieldName(xAxisLabel), vizType: 'category' };
  const yAxis: AxisSpec = { key: 'value', label: formatFieldName(yAxisLabel), vizType: 'numeric' };
  const series: SeriesSpec[] = [{ key: 'value', label: formatFieldName(yAxisLabel) }];

  switch (plan.intent) {
    case 'grouped_average': {
      const payload = rawRows.map(r => ({
        category: String(r.category_label || Object.values(r)[0] || ''),
        value: Number(r.average_value ?? r.avg ?? Object.values(r)[1] ?? 0)
      }));
      return verifyContract({
        kind: 'groupedAverages',
        schemaVersion: 1,
        data: payload,
        xAxis,
        yAxis,
        series,
        xAxisLabel: xAxis.label,
        yAxisLabel: yAxis.label
      });
    }

    case 'comparison': {
      const payload = rawRows.map(r => ({
        category: String(r.group_label || r.category_label || Object.values(r)[0] || ''),
        value: Number(r.mean ?? r.average_value ?? Object.values(r)[1] ?? 0)
      }));
      return verifyContract({
        kind: 'comparisonSummary',
        schemaVersion: 1,
        data: payload,
        xAxis: { ...xAxis, label: formatFieldName(plan.groupBy?.[0] || 'Group') },
        yAxis: { ...yAxis, label: formatFieldName(`Mean ${plan.metric || 'Value'}`) },
        series: [{ key: 'value', label: formatFieldName(`Mean ${plan.metric || 'Value'}`) }],
        xAxisLabel: plan.groupBy?.[0] || 'Group',
        yAxisLabel: `Mean ${plan.metric || 'Value'}`
      });
    }

    case 'ranking': {
      const payload = rawRows.map(r => ({
        category: String(r.rank_label || r.category_label || Object.values(r)[0] || ''),
        value: Number(r.metric_value ?? r.average_value ?? Object.values(r)[1] ?? 0)
      }));
      return verifyContract({
        kind: 'rankingSummary',
        schemaVersion: 1,
        data: payload,
        xAxis: { ...xAxis, label: formatFieldName(plan.groupBy?.[0] || 'Category') },
        yAxis: { ...yAxis, label: formatFieldName(`Ranked by ${plan.metric || 'Value'}`) },
        series: [{ key: 'value', label: formatFieldName(`Ranked by ${plan.metric || 'Value'}`) }],
        xAxisLabel: plan.groupBy?.[0] || 'Category',
        yAxisLabel: `Ranked by ${plan.metric || 'Value'}`
      });
    }

    case 'feature_importance': {
      const payload = rawRows.map(r => ({
        feature: String(r.feature || Object.values(r)[0] || ''),
        association: Number(r.association ?? Object.values(r)[1] ?? 0),
        method: String(r.method || '')
      }));
      return verifyContract({
        kind: 'featureImportance',
        schemaVersion: 1,
        data: payload,
        xAxis: { key: 'feature', label: 'Feature', vizType: 'category' },
        yAxis: { key: 'association', label: 'Association Strength', vizType: 'numeric' },
        series: [{ key: 'association', label: 'Association Strength' }],
        xAxisLabel: 'Feature',
        yAxisLabel: 'Association Strength'
      });
    }

    case 'correlation': {
      const stats = rawRows[0] || {};
      const points = stats.points || [];
      const payload = points.map((p: any) => ({
        x: Number(p.x || 0),
        y: Number(p.y || 0)
      }));

      const pVal = typeof stats.pValue === 'number' ? stats.pValue : 1.0;
      const rVal = typeof stats.r === 'number' ? stats.r : 0.0;
      const slope = typeof stats.slope === 'number' ? stats.slope : 0.0;
      const sampleSize = typeof stats.sampleSize === 'number' ? stats.sampleSize : payload.length;
      const method = typeof stats.method === 'string' ? stats.method : 'Pearson';

      return verifyContract({
        kind: 'correlationSummary',
        schemaVersion: 1,
        data: payload,
        rValue: rVal,
        pValue: pVal,
        trendSlope: slope,
        sampleSize,
        method,
        xAxis: { key: 'x', label: formatFieldName(plan.metric || 'Variable X'), vizType: 'numeric' },
        yAxis: { key: 'y', label: formatFieldName(plan.target || 'Variable Y'), vizType: 'numeric' },
        xAxisLabel: plan.metric || 'Variable X',
        yAxisLabel: plan.target || 'Variable Y'
      });
    }

    case 'distribution': {
      const payload = rawRows.map(r => ({
        binRange: String(r.binRange || r.bin_label || Object.values(r)[0] || ''),
        count: Number(r.count || Object.values(r)[1] || 0)
      }));
      return verifyContract({
        kind: 'distributionBins',
        schemaVersion: 1,
        data: payload,
        metricName: plan.metric || 'Metric',
        xAxis: { key: 'binRange', label: formatFieldName(plan.metric || 'Range'), vizType: 'category' },
        yAxis: { key: 'count', label: 'Count', vizType: 'numeric' },
        series: [{ key: 'count', label: 'Count' }],
        xAxisLabel: plan.metric || 'Range',
        yAxisLabel: 'Count'
      });
    }

    case 'filter':
    case 'summary':
    default: {
      const cols = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
      const rowCount = typeof data?.metadata?.rowCount === 'number' ? data.metadata.rowCount : rawRows.length;
      return verifyContract({
        kind: 'tableRows',
        schemaVersion: 1,
        data: rawRows,
        columns: cols,
        rowCount
      });
    }
  }
}
