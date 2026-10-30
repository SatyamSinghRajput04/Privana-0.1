export type ColumnProfile = {
  name: string;
  type: 'numeric' | 'category' | 'date' | 'text' | 'boolean' | 'identifier';
  nullPct: number;
  uniqueValues?: any[];
  cardinality?: number;
};

export type QualityMetrics = {
  missingValuesPct: number;
  duplicatesCount: number;
  criticalIssuesCount: number;
  criticalIssues: string[];
};

export type PiiFlag = {
  columnName: string;
  piiType: 'email' | 'phone' | 'national_id' | 'name';
};

export type DatasetProfile = {
  datasetHash: string;          // content hash — primary cache key
  rowCount: number;
  columnCount: number;
  shape: 'tabular' | 'metadata' | 'empty' | 'header-only' | 'corrupted';
  columns: ColumnProfile[];
  qualityMetrics: QualityMetrics;
  piiFlags: PiiFlag[];
  profiledAt: string;           // ISO-8601
  profilerVersion: string;      // for cache invalidation on profiler upgrade
};
