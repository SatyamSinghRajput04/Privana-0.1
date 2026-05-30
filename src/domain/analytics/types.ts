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

export type GroupedAveragesPayload = { category: string; value: number }[];
export type CorrelationPayload = { x: number; y: number }[];
export type TableRowsPayload = any[];
export type DistributionPayload = { binRange: string; count: number }[];

export type VisualContract = (
  | { kind: 'groupedAverages';   schemaVersion: 1; data: GroupedAveragesPayload; xAxisLabel?: string; yAxisLabel?: string }
  | { kind: 'correlationSummary';schemaVersion: 1; data: CorrelationPayload; rValue: number; pValue: number; trendSlope: number; xAxisLabel?: string; yAxisLabel?: string }
  | { kind: 'tableRows';         schemaVersion: 1; data: TableRowsPayload; columns: string[] }
  | { kind: 'distributionBins';  schemaVersion: 1; data: DistributionPayload; metricName: string; xAxisLabel?: string; yAxisLabel?: string }
) & { notes?: string; lastComputedAt?: number };

// ─────────────────────────────────────────────────────────────────────────────
// SPEC V2.0 WORKSPACE ENGINE: WORKSPACE BLUEPRINT & CARD SPECIFICATION
// ─────────────────────────────────────────────────────────────────────────────
export type CardSpec =
  | { kind: 'groupedAverage'; metricColumn: string; groupColumn: string; aggType: 'avg' | 'sum' | 'count'; }
  | { kind: 'correlation'; xColumn: string; yColumn: string; }
  | { kind: 'distribution'; metricColumn: string; binCount: number; }
  | { kind: 'ranking'; metricColumn: string; categoryColumn: string; limit: number; sort: 'asc' | 'desc'; }
  | { kind: 'genderSummary'; }
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
