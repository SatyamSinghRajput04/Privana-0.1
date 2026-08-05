// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/types.ts
// S2 CONTRACTS — Types, intents, plans, and discriminated union results.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_INTENTS = [
  'summary',
  'distribution',
  'grouped_average',
  'correlation',
  'feature_importance',
  'ranking',
  'filter',
  'comparison'
] as const;

export type AnalysisIntent = (typeof SUPPORTED_INTENTS)[number];

export type ColumnRole = 'metric' | 'groupBy' | 'filter' | 'target' | 'time' | 'id';

export interface ColumnMatch {
  columnName: string;
  confidence: number;
  role: ColumnRole;
}

export interface Filter {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains';
  value: any;
}

export interface AnalysisPlan {
  planId: string;
  intent: AnalysisIntent;
  metric?: string;
  groupBy?: string[];
  filters?: Filter[];
  target?: string;
  limit?: number;
  confidence: number;
  source: 'pattern' | 'semantic' | 'llm';
  datasetHash?: string;
}

export interface Provenance {
  question: string;
  planGeneratedAt: Date;
  executionTimeMs: number;
  plannerAttempts: number;
}

export interface ExecutorResult {
  status: 'success' | 'partial_missing' | 'partial_small_n';
  rows: any[];
  metadata?: Record<string, any>;
}

export interface ChartSpec {
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram' | 'none';
  xAxisKey?: string;
  yAxisKey?: string;
  seriesKeys?: string[];
  title?: string;
  description?: string;
}

export interface ClarificationChoice {
  label: string;
  plan: AnalysisPlan;
  question: string;
}

export interface Clarification {
  message: string;
  choices: ClarificationChoice[];
}

export type AnalyticsResult =
  | {
      status: 'computed';
      plan: AnalysisPlan;
      data: ExecutorResult;
      chart: ChartSpec;
      narrative: string;
      provenance: Provenance;
    }
  | {
      status: 'partial';
      plan: AnalysisPlan;
      data: ExecutorResult;
      chart: ChartSpec;
      narrative: string;
      reasons: string[];
      provenance: Provenance;
    }
  | {
      status: 'clarify';
      clarification: Clarification;
      provenance: Provenance;
    }
  | {
      status: 'blocked';
      reason: string;
      bypassAllowed?: boolean;
      provenance: Provenance;
    }
  | {
      status: 'unsupported';
      explanation: string;
      suggestedQuestions: string[];
      provenance: Provenance;
    }
  | {
      status: 'refused';
      errors: string[];
      reason?: string;
      missing?: string[];
      message?: string;
      suggestions?: string[];
      provenance: Provenance;
    }
  | {
      status: 'error';
      message: string;
      debugId: string;
      provenance: Provenance;
    };

// ─────────────────────────────────────────────────────────────────────────────
// SPEC V1.1 INVARIANTS: STRUCTURED QUERY & VISUAL CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────
export interface StructuredQuery {
  datasetId: string;
  table: string;
  select: string[];
  where: string;
  params: any[];
  limit?: number;
}

export interface AxisSpec {
  key: string;
  label: string;
  vizType: 'numeric' | 'category' | 'date';
  format?: 'number' | 'currency' | 'percent';
}

export interface SeriesSpec {
  key: string;
  label: string;
  color?: string;
}

export type GroupedAveragesPayload = { category: string; value: number }[];
export type ComparisonSummaryPayload = { category: string; value: number }[];
export type RankingSummaryPayload = { category: string; value: number }[];
export type FeatureImportancePayload = { feature: string; association: number; method?: string }[];
export type CorrelationPayload = { x: number; y: number }[];
export type TableRowsPayload = any[];
export type DistributionPayload = { binRange: string; count: number }[];

export type VisualContract = (
  | { kind: 'bar';              schemaVersion: 1; xAxis: AxisSpec; yAxis: AxisSpec; series: SeriesSpec[]; data: ReadonlyArray<Record<string, any>>; xAxisLabel?: string; yAxisLabel?: string }
  | { kind: 'line';             schemaVersion: 1; xAxis: AxisSpec; yAxis: AxisSpec; series: SeriesSpec[]; data: ReadonlyArray<Record<string, any>>; xAxisLabel?: string; yAxisLabel?: string }
  | { kind: 'scatter';          schemaVersion: 1; xAxis: AxisSpec; yAxis: AxisSpec; zAxis?: AxisSpec; data: ReadonlyArray<Record<string, number>>; rValue?: number; pValue?: number; trendSlope?: number; xAxisLabel?: string; yAxisLabel?: string }
  | { kind: 'pie';              schemaVersion: 1; labelKey: string; valueKey: string; labelDisplay: string; data: ReadonlyArray<Record<string, any>>; xAxisLabel?: string; yAxisLabel?: string }
  | { kind: 'groupedAverages';  schemaVersion: 1; data: GroupedAveragesPayload; xAxisLabel?: string; yAxisLabel?: string; xAxis?: AxisSpec; yAxis?: AxisSpec; series?: SeriesSpec[] }
  | { kind: 'comparisonSummary';schemaVersion: 1; data: ComparisonSummaryPayload; xAxisLabel?: string; yAxisLabel?: string; xAxis?: AxisSpec; yAxis?: AxisSpec; series?: SeriesSpec[] }
  | { kind: 'rankingSummary';   schemaVersion: 1; data: RankingSummaryPayload; xAxisLabel?: string; yAxisLabel?: string; xAxis?: AxisSpec; yAxis?: AxisSpec; series?: SeriesSpec[] }
  | { kind: 'featureImportance';schemaVersion: 1; data: FeatureImportancePayload; xAxisLabel?: string; yAxisLabel?: string; xAxis?: AxisSpec; yAxis?: AxisSpec; series?: SeriesSpec[] }
  | { kind: 'correlationSummary';schemaVersion: 1; data: CorrelationPayload; rValue: number; pValue: number; trendSlope: number; sampleSize?: number; method?: string; xAxisLabel?: string; yAxisLabel?: string; xAxis?: AxisSpec; yAxis?: AxisSpec }
  | { kind: 'tableRows';         schemaVersion: 1; data: TableRowsPayload; columns: string[]; rowCount?: number }
  | { kind: 'distributionBins';  schemaVersion: 1; data: DistributionPayload; metricName: string; xAxisLabel?: string; yAxisLabel?: string; xAxis?: AxisSpec; yAxis?: AxisSpec; series?: SeriesSpec[] }
  | { kind: 'empty';            schemaVersion: 1; reason: string; data?: any[] }
) & { notes?: string; lastComputedAt?: number; data?: any[] };

// ─────────────────────────────────────────────────────────────────────────────
// SPEC V2.0 WORKSPACE ENGINE: WORKSPACE BLUEPRINT & CARD SPECIFICATION
// ─────────────────────────────────────────────────────────────────────────────
export type CardSpec =
  | { kind: 'groupedAverage'; metricColumn: string; groupColumn: string; aggType: 'avg' | 'sum' | 'count'; }
  | { kind: 'correlation'; xColumn: string; yColumn: string; }
  | { kind: 'distribution'; metricColumn: string; binCount: number; }
  | { kind: 'ranking'; metricColumn: string; categoryColumn: string; limit: number; sort: 'asc' | 'desc'; }
  | { kind: 'segmentSummary'; segmentColumn: string; metricColumns: string[]; }
  | { type: 'kpi'; value: string | number; sub?: string; }
  | { type: 'table'; rows: any[]; }
  | { type: 'narrative'; text: string; provenance?: Provenance; };

export interface CardDefinition {
  id: string;
  title: string;
  chartType: 'bar' | 'line' | 'scatter' | 'table' | 'kpi' | 'pie' | 'donut';
  spec: CardSpec;
}

export interface SheetSpec {
  id: string;
  name: string;
  cards: CardDefinition[];
}

export interface WorkspaceBlueprint {
  activeQuestion: string;
  datasetId: string;
  versionHash: string;
  sheets: SheetSpec[];
}
