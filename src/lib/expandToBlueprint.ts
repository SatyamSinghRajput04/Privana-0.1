import { 
  WorkspaceBlueprint, 
  VisualContract, 
  CardDefinition, 
  AnalyticsResult, 
  AnalysisPlan, 
  AnalysisIntent 
} from '../domain/analytics/types';

// Helper to determine chart type based on intent
function chartTypeForIntent(intent: AnalysisIntent): 'bar' | 'line' | 'scatter' | 'table' | 'kpi' {
  const map: Record<AnalysisIntent, 'bar' | 'line' | 'scatter' | 'table' | 'kpi'> = {
    grouped_average:    'bar',
    comparison:         'bar',
    ranking:            'bar',
    distribution:       'bar',
    correlation:        'scatter',
    feature_importance: 'bar',
    filter:             'table',
    summary:            'kpi',
  };
  return map[intent] ?? 'bar';
}

// Helper to format underscores to spaces and capitalize fields
function formatFieldName(name: string): string {
  if (!name) return '';
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Generate chart title
function chartTitle(intent: AnalysisIntent, metric?: string, groupBy?: string[]): string {
  const m = metric ? formatFieldName(metric) : '';
  const g = groupBy?.[0] ? formatFieldName(groupBy[0]) : '';
  if (intent === 'grouped_average' && m && g) return `${m} by ${g}`;
  if (intent === 'distribution') return `Distribution of ${m}`;
  if (intent === 'correlation')  return `${m} vs ${g}`;
  return m || 'Analysis Result';
}

function sheetTitle(intent: AnalysisIntent, metric?: string): string {
  const m = metric ? formatFieldName(metric) : '';
  return `${formatFieldName(intent)} — ${m}`;
}

function strengthLabel(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'Strong Correlation';
  if (abs >= 0.4) return 'Moderate Correlation';
  return 'Weak Correlation';
}

const getVal = (r: any): number => Number(r.average_value ?? r.mean ?? r.metric_value ?? r.association ?? 0);
const getLabel = (r: any): string => String(r.category_label ?? r.group_label ?? r.rank_label ?? r.feature ?? 'N/A');

function extractPrimaryKPI(
  intent: AnalysisIntent,
  rows: any[],
  metric: string,
  groupBy: string[] | undefined,
  target: string | undefined
) {
  if (!rows || !rows.length) return null;

  switch (intent) {
    case 'grouped_average':
    case 'ranking':
    case 'comparison': {
      // Find row with max value
      const sorted = [...rows].sort((a, b) => getVal(b) - getVal(a));
      const top = sorted[0];
      const labelPrefix = intent === 'comparison' ? 'Highest Mean' : (intent === 'ranking' ? 'Top Ranked' : 'Highest Average');
      return {
        label: `${labelPrefix} ${formatFieldName(metric)}`,
        value: getVal(top).toFixed(2),
        sub:   getLabel(top),
      };
    }
    case 'correlation': {
      const r = rows[0]?.r ?? 0;
      return {
        label: 'Pearson Correlation (r)',
        value: Number(r).toFixed(3),
        sub:   strengthLabel(r),
      };
    }
    case 'distribution': {
      const mode = [...rows].sort((a, b) => b.count - a.count)[0];
      const label = mode.category_label ?? mode.bin_label ?? mode.binRange ?? 'N/A';
      return {
        label: 'Peak Distribution Bin',
        value: String(label),
        sub:   `${mode.count} Occurrences`,
      };
    }
    default:
      return null;
  }
}

function extractSecondaryKPI(intent: AnalysisIntent, rows: any[], plan: AnalysisPlan) {
  if (!rows || !rows.length) return null;

  switch (intent) {
    case 'grouped_average':
    case 'ranking':
    case 'comparison': {
      const sorted = [...rows].sort((a, b) => getVal(a) - getVal(b));
      const bottom = sorted[0];
      const top    = sorted[sorted.length - 1];
      const gap    = (getVal(top) - getVal(bottom)).toFixed(2);
      const labelPrefix = intent === 'comparison' ? 'Lowest Mean' : (intent === 'ranking' ? 'Bottom Ranked' : 'Lowest Average');
      return {
        label: `${labelPrefix} ${formatFieldName(plan.metric || '')}`,
        value: getVal(bottom).toFixed(2),
        sub:   `Gap of ${gap} from highest`,
      };
    }
    case 'correlation': {
      const p = rows[0]?.pValue ?? rows[0]?.p_value ?? 1;
      return {
        label: 'Statistical Significance',
        value: p < 0.001 ? '< 0.001' : Number(p).toFixed(4),
        sub:   p < 0.05 ? 'Statistically Significant' : 'Not Significant',
      };
    }
    default:
      return null;
  }
}

export function expandToBlueprint(
  result: any, // AnalyticsResult (status === 'computed' or 'partial')
  contract: VisualContract
): WorkspaceBlueprint {
  const { plan, data, narrative, provenance } = result;
  const { intent, metric = '', groupBy, target } = plan;
  const rows = data?.rows || [];
  const cards: CardDefinition[] = [];

  // Card 1: Primary Chart
  cards.push({
    id: 'card_qa_chart',
    title: chartTitle(intent, metric, groupBy),
    chartType: chartTypeForIntent(intent),
    spec: contract as any // Wire visual contract directly in spec for bypass renderer
  });

  // Card 2: Primary KPI Card
  const kpi1 = extractPrimaryKPI(intent, rows, metric, groupBy, target);
  if (kpi1) {
    cards.push({
      id: 'card_qa_kpi_primary',
      title: kpi1.label,
      chartType: 'kpi',
      spec: { type: 'kpi', value: kpi1.value, sub: kpi1.sub }
    });
  }

  // Card 3: Secondary KPI Card
  const kpi2 = extractSecondaryKPI(intent, rows, plan);
  if (kpi2) {
    cards.push({
      id: 'card_qa_kpi_secondary',
      title: kpi2?.label || 'KPI Value',
      chartType: 'kpi',
      spec: { type: 'kpi', value: kpi2?.value || 0, sub: kpi2?.sub || '' }
    });
  }

  // Card 4: Full sorting data table
  cards.push({
    id: 'card_qa_table',
    title: `Filtered records (n = ${rows.length})`,
    chartType: 'table',
    spec: { type: 'table', rows }
  });

  // Card 5: Narrative and Provenance
  cards.push({
    id: 'card_qa_narrative',
    title: 'AI Interpretation',
    chartType: 'kpi',
    spec: { type: 'narrative', text: narrative || '', provenance }
  });

  const sheetId = `snapshot_${Date.now()}`;

  return {
    activeQuestion: provenance?.question || 'Custom Question',
    datasetId: result.plan?.datasetHash || 'current',
    versionHash: String(Date.now()),
    sheets: [{
      id: sheetId,
      name: `🔍 ${provenance?.question?.length > 22 ? provenance.question.slice(0, 22) + '...' : provenance.question}`,
      cards
    }]
  };
}
