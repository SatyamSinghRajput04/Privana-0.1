export type Intent =
  | 'correlation'
  | 'regression'
  | 'distribution'
  | 'anomaly'
  | 'timeseries'
  | 'ranking'
  | 'comparison'
  | 'composition'
  | 'count'
  | 'aggregation'
  | 'unsupported';

export type Filter = {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';
  value: any;
};

export type OrderBy = {
  column: string;
  direction: 'ASC' | 'DESC';
};

export type QueryPlan = {
  planId: string;
  intent: Intent;
  metric: string | null;
  groupBy: string[];
  filters: Filter[];
  orderBy?: OrderBy;
  limit?: number;
  assumptions: string[];
  confidence: 'high' | 'medium' | 'low';
  source: 'rule-engine' | 'llm-fallback';
  datasetHash: string;          // binds plan to a specific dataset version
};

export type Refusal = {
  refusalCode: 'missing_column' | 'insufficient_sample' | 'mixed_type' | 'metadata_shaped' | 'ambiguous_intent' | 'unsupported';
  message: string;
};
