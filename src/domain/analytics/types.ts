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
