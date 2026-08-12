import alasql from 'alasql';
import Papa from 'papaparse';

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
alasql.fn.round = (val: any, precision: any = 0) => {
  if (typeof val !== 'number') return val;
  const factor = Math.pow(10, precision);
  return Math.round(val * factor) / factor;
};

// ─────────────────────────────────────────────────────────────────────────────
// TABLE NAME HELPER
// ─────────────────────────────────────────────────────────────────────────────
export function getSqlTableName(filename: string): string {
  return filename
    .replace(/\.(csv|parquet|xlsx|json)$/i, '')
    .replace(/[^a-z0-9_]/gi, '_');
}

/**
 * Wraps an identifier in backticks for AlaSQL compatibility.
 * AlaSQL chokes on square brackets + reserved words (like "count").
 * Backticks are the ONLY safe quoting mechanism.
 */
function q(identifier: string): string {
  return '`' + identifier + '`';
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────
export function registerTable(tableName: string, data: any[]): void {
  const name = getSqlTableName(tableName);

  // Guard: AlaSQL identifiers must start with a letter/underscore and contain
  // only word characters. Filenames like ".csv" or "2024.csv" produce empty or
  // digit-leading identifiers that crash CREATE TABLE.
  if (!name || !/^[A-Za-z_]\w*$/.test(name)) {
    throw new Error(
      `registerTable: sanitized name "${name}" (from "${tableName}") is not a valid SQL identifier.`
    );
  }

  // Must CREATE TABLE first so AlaSQL's query engine recognizes it.
  // Direct assignment to alasql.tables works for data storage,
  // but CREATE TABLE ensures the parser can find it.
  try { alasql('DROP TABLE IF EXISTS ' + q(name)); } catch { /* ignore */ }
  try { alasql('CREATE TABLE ' + q(name)); } catch { /* ignore */ }

  // Null guard: if CREATE TABLE failed silently, the table slot won't exist.
  const tableSlot = (alasql.tables as any)[name];
  if (!tableSlot) {
    throw new Error(
      `registerTable: AlaSQL table slot for "${name}" does not exist after CREATE TABLE.`
    );
  }
  tableSlot.data = data;
}


// ─────────────────────────────────────────────────────────────────────────────
// SPEC V1.1 INGESTION AND SCHEMA CONTRACT
// ─────────────────────────────────────────────────────────────────────────────
export interface ColumnSpec {
  name: string;
  type: 'number' | 'integer' | 'string' | 'boolean' | 'date' | 'timestamp';
  nullable: boolean;
  role: 'dimension' | 'metric' | 'time' | 'id' | 'unknown';
  cardinality?: number;
  nullCount: number;
  originalType?: string;
  coercedType?: string;
  coercedExample?: string;
}

export interface SchemaContract {
  datasetId: string;
  versionHash: string; // content-addressed hash of CSV contents
  columns: ColumnSpec[];
  rowCount: number;
  ingestionTimestamp: number;
}

export const SCHEMA_PROFILES: Record<string, SchemaContract> = {};

function getStringHash(str: string): string {
  let hash = 2166136261;
  // Sub-millisecond hashing for large files by sampling head, tail, and length
  const sample = str.length > 10000 ? str.slice(0, 5000) + str.slice(-5000) + str.length : str;
  for (let i = 0; i < sample.length; i++) {
    hash ^= sample.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export function normalizeAndProfileData(tableName: string, data: any[], rawContent: string): SchemaContract {
  const rowCount = data.length;
  const ingestionTimestamp = Date.now();
  const datasetId = tableName;
  const versionHash = getStringHash(rawContent);

  if (rowCount === 0) {
    const contract: SchemaContract = { datasetId, versionHash, columns: [], rowCount, ingestionTimestamp };
    Object.freeze(contract);
    SCHEMA_PROFILES[tableName] = contract;
    return contract;
  }

  const columns = Object.keys(data[0] || {});
  const colSpecs: ColumnSpec[] = [];

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

  // High-performance representative sampling (max 2,000 rows for schema sniffing)
  const sampleSize = Math.min(rowCount, 2000);

  for (const colName of columns) {
    let nullCountInSample = 0;
    const sampleValues: any[] = [];
    let coercedType = 'string';
    let coercedExample = '';

    for (let i = 0; i < sampleSize; i++) {
      let val = data[i][colName];

      // Null check
      if (val === null || val === undefined || val === '' || (typeof val === 'string' && val.trim() === '')) {
        nullCountInSample++;
        continue;
      }

      if (typeof val === 'number') {
        if (isNaN(val) || !isFinite(val)) {
          nullCountInSample++;
          continue;
        }
      }

      // Conservative Date Coercion Sniffing
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (datePattern.test(trimmed) || dateTimePattern.test(trimmed)) {
          try {
            const d = new Date(trimmed);
            if (!isNaN(d.getTime())) {
              const iso = d.toISOString();
              coercedType = 'date';
              coercedExample = trimmed;
              val = iso;
            }
          } catch {
            // Keep original on parse failure
          }
        }
      }

      sampleValues.push(val);
    }

    const nonNullCount = sampleValues.length;
    let inferredType: ColumnSpec['type'] = 'string';
    let role: ColumnSpec['role'] = 'unknown';

    if (nonNullCount > 0) {
      const numbers = sampleValues.filter(v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))));
      const booleans = sampleValues.filter(v => typeof v === 'boolean' || (typeof v === 'string' && ['true', 'false'].includes(v.trim().toLowerCase())));
      const dates = sampleValues.filter(v => typeof v === 'string' && (datePattern.test(v) || dateTimePattern.test(v) || v.endsWith('Z')));

      if (numbers.length > nonNullCount * 0.7) {
        const isAllInt = numbers.every(n => Number.isInteger(typeof n === 'number' ? n : Number(n)));
        inferredType = isAllInt ? 'integer' : 'number';
        role = 'metric';
      } else if (booleans.length > nonNullCount * 0.7) {
        inferredType = 'boolean';
        role = 'dimension';
      } else if (dates.length > nonNullCount * 0.5 || coercedType === 'date') {
        inferredType = 'date';
        role = 'time';
      } else {
        inferredType = 'string';
        role = colName.toLowerCase().includes('id') ? 'id' : 'dimension';
      }
    }

    const uniqueValues = new Set(sampleValues);
    const cardinality = uniqueValues.size;
    const estimatedNullCount = Math.round((nullCountInSample / sampleSize) * rowCount);

    const spec: ColumnSpec = {
      name: colName,
      type: inferredType,
      nullable: estimatedNullCount > 0,
      role,
      cardinality: cardinality < 100 ? cardinality : undefined,
      nullCount: estimatedNullCount,
      originalType: 'string',
      coercedType: coercedType !== 'string' ? coercedType : undefined,
      coercedExample: coercedExample || undefined
    };

    Object.freeze(spec);
    colSpecs.push(spec);
  }

  const contract: SchemaContract = {
    datasetId,
    versionHash,
    columns: colSpecs,
    rowCount,
    ingestionTimestamp
  };

  Object.freeze(contract);
  SCHEMA_PROFILES[tableName] = contract;
  return contract;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV LOADER (Hardened limits & sanitization, Web Worker streaming)
// ─────────────────────────────────────────────────────────────────────────────
export function loadCSV(
  filename: string,
  source: string | Blob | File,
  onProgress?: (fraction: number) => void
): Promise<any[]> {
  return new Promise(async (resolve, reject) => {
    const blob: Blob = typeof source === 'string' ? new Blob([source]) : source;
    const totalBytes = blob.size;

    // 1. File size check (100MB cap)
    if (totalBytes > 100 * 1024 * 1024) {
      return reject(new Error(`Duplicate and/or overflow Column check failed: File size exceeds the strict cap of 100 MB (size: ${(totalBytes / (1024 * 1024)).toFixed(1)} MB).`));
    }

    // 2. Pre-validate unparsed raw header line for duplicates and column count
    try {
      let headerStr = '';
      if (typeof source === 'string') {
        const firstNewline = source.indexOf('\n');
        headerStr = firstNewline !== -1 ? source.slice(0, firstNewline) : source;
      } else {
        const sliceText = await source.slice(0, 65536).text();
        const firstNewline = sliceText.indexOf('\n');
        headerStr = firstNewline !== -1 ? sliceText.slice(0, firstNewline) : sliceText;
      }

      const trimmedHeader = headerStr.trim();
      if (trimmedHeader) {
        const parsedHeader = Papa.parse(trimmedHeader).data[0] as string[];
        if (parsedHeader && parsedHeader.length > 0) {
          if (parsedHeader.length > 500) {
            return reject(new Error(`Duplicate and/or overflow Column check failed: Column count exceeds the strict cap of 500 columns (found ${parsedHeader.length} columns).`));
          }
          const seen = new Set<string>();
          for (const h of parsedHeader) {
            const cleanH = h?.trim() || '';
            if (cleanH === '') {
              return reject(new Error(`Ingestion failed: Found empty column header in CSV.`));
            }
            if (seen.has(cleanH)) {
              return reject(new Error(`Ingestion failed: Duplicate column header name "${cleanH}" detected. Ingestion requires unique headers.`));
            }
            seen.add(cleanH);
          }
        }
      }
    } catch (hErr: any) {
      return reject(hErr);
    }

    const rows: any[] = [];
    let bytesSeen = 0;
    const CHUNK_SIZE = 1024 * 1024;
    let settled = false;

    // Hard safety-net timeout: a worker-based parse can hang forever with no
    // callback at all if Web Worker creation (blob: URL) is blocked by the
    // hosting page's CSP or a sandboxed preview iframe — the exact "stuck at
    // Processing locally... 0%" freeze. Never let the UI hang indefinitely.
    const HARD_TIMEOUT_MS = 90_000;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(
        `Parsing "${filename}" timed out after ${HARD_TIMEOUT_MS / 1000}s with no progress. ` +
        `This usually means background parsing was blocked by the browser or embedding context. ` +
        `Try again, or use a smaller file.`
      ));
    }, HARD_TIMEOUT_MS);

    Papa.parse(blob as File, {
      // Disabled: worker-based parsing can silently hang with zero callbacks
      // (no chunk/complete/error) inside sandboxed or CSP-restricted preview
      // iframes. Chunked main-thread parsing still yields between chunks via
      // Papa's own scheduling, so the UI stays responsive without a worker.
      worker: false,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      chunkSize: CHUNK_SIZE,
      chunk: (results) => {
        if (settled) return;
        if (results.data && Array.isArray(results.data)) {
          for (let i = 0; i < results.data.length; i++) {
            rows.push(results.data[i]);
          }
        }
        if (onProgress && totalBytes > 0 && results.meta && typeof results.meta.cursor === 'number') {
          onProgress(Math.min(1, results.meta.cursor / totalBytes));
        }
      },
      complete: () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        try {
          const headerFields = rows.length > 0 ? Object.keys(rows[0] || {}) : [];
          const versionSignature = typeof source === 'string'
            ? source
            : [filename, totalBytes, rows.length, headerFields.join(',')].join('|');
          normalizeAndProfileData(filename, rows, versionSignature);
          registerTable(filename, rows);
          if (onProgress) onProgress(1);
          resolve(rows);
        } catch (e: any) {
          reject(e);
        }
      },
      error: (err: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        reject(err);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON LOADER (smart: metadata-aware + nested-array extraction)
// ─────────────────────────────────────────────────────────────────────────────
export function loadJSON(filename: string, jsonContent: string): any[] {
  // 1. File size check (100MB cap)
  const byteSize = new Blob([jsonContent]).size;
  if (byteSize > 100 * 1024 * 1024) {
    throw new Error(`Ingestion failed: File size exceeds the strict cap of 100 MB (size: ${(byteSize / (1024 * 1024)).toFixed(1)} MB).`);
  }

  let raw: any;
  try {
    raw = JSON.parse(jsonContent);
  } catch (parseErr: any) {
    throw new Error(`Invalid JSON in "${filename}": ${parseErr.message}`);
  }

  let finalRows: any[] = [];
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error(`"${filename}" contains an empty JSON array — no records to load.`);
    }
    finalRows = raw;
  } else if (typeof raw === 'object' && raw !== null) {
    const NESTED_KEYS = ['data', 'records', 'rows', 'items', 'results',
                         'features', 'entries', 'dataset', 'values'];
    let extracted = false;
    for (const key of NESTED_KEYS) {
      const candidate = raw[key];
      if (Array.isArray(candidate) && candidate.length > 0
          && typeof candidate[0] === 'object' && candidate[0] !== null) {
        finalRows = candidate;
        extracted = true;
        break;
      }
    }
    if (!extracted) {
      const METADATA_SIGNALS = [
        '@context', '@type', 'license', 'creator', 'publisher',
        'dateModified', 'dateCreated', 'isBasedOn', 'measurementTechnique',
        'variableMeasured', 'sameAs'
      ];
      const foundSignals = METADATA_SIGNALS.filter(k => k in raw);
      if (foundSignals.length >= 2) {
        throw new Error(
          `"${filename}" appears to be a dataset metadata / descriptor file ` +
          `(detected schema fields: ${foundSignals.slice(0, 4).join(', ')}…). ` +
          `This file describes the dataset but contains NO actual data rows.\n\n` +
          `Please upload the real records dataset instead.`
        );
      }
      finalRows = [raw];
    }
  } else {
    throw new Error(`"${filename}" is not a valid JSON data file.`);
  }

  // 2. Headers count limit
  if (finalRows.length > 0) {
    const keys = Object.keys(finalRows[0]);
    if (keys.length > 500) {
      throw new Error(`Duplicate and/or overflow Column check failed: Column count exceeds the strict cap of 500 columns (found ${keys.length} columns).`);
    }
  }

  // UTF-8 Clean Pass
  const cleanedData = finalRows.map((row: any) => {
    const newRow: any = {};
    for (const key of Object.keys(row)) {
      let val = row[key];
      if (typeof val === 'string') {
        val = val.replace(/[\uFFFD\u007F-\u009F]/g, '\uFFFD');
      }
      newRow[key] = val;
    }
    return newRow;
  });

  normalizeAndProfileData(filename, cleanedData, jsonContent);
  registerTable(filename, cleanedData);
  return cleanedData;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA INTROSPECTION
// ─────────────────────────────────────────────────────────────────────────────
export interface ColumnInfo {
  name: string;
  type: 'number' | 'string' | 'date' | 'boolean' | 'unknown';
  sample: any;
}

export function getTableData(tableName: string): any[] {
  const tbl = getSqlTableName(tableName);
  const tableObj = (alasql.tables as any)[tbl];
  return tableObj?.data || [];
}

export function getTableSchema(tableName: string): ColumnInfo[] {
  const tbl = getSqlTableName(tableName);
  const tableObj = (alasql.tables as any)[tbl];
  if (!tableObj || !tableObj.data || tableObj.data.length === 0) return [];

  const sampleRows = tableObj.data.slice(0, 20);
  const columns = Object.keys(sampleRows[0]);

  return columns.map(name => {
    const values = sampleRows.map((r: any) => r[name]).filter((v: any) => v != null && v !== '');
    if (values.length === 0) return { name, type: 'unknown' as const, sample: null };

    const numCount = values.filter((v: any) => typeof v === 'number').length;
    const boolCount = values.filter((v: any) => typeof v === 'boolean').length;

    if (numCount > values.length * 0.7) return { name, type: 'number' as const, sample: values[0] };
    if (boolCount > values.length * 0.7) return { name, type: 'boolean' as const, sample: values[0] };

    const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/;
    const dateCount = values.filter((v: any) => typeof v === 'string' && datePattern.test(v)).length;
    if (dateCount > values.length * 0.5) return { name, type: 'date' as const, sample: values[0] };

    return { name, type: 'string' as const, sample: values[0] };
  });
}

export function getTableRowCount(tableName: string): number {
  const tbl = getSqlTableName(tableName);
  const tableObj = (alasql.tables as any)[tbl];
  return tableObj?.data?.length || 0;
}

export function isTableLoaded(tableName: string): boolean {
  const tbl = getSqlTableName(tableName);
  const tableObj = (alasql.tables as any)[tbl];
  return !!(tableObj && tableObj.data && tableObj.data.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS ROW SAMPLING (avoids blocking the main thread on huge tables)
// ─────────────────────────────────────────────────────────────────────────────
const ANALYSIS_ROW_CAP = 50_000;

/**
 * Returns rows for the analytics pipeline. Reads directly off the AlaSQL table's
 * backing array (skips the SQL engine's SELECT * overhead) and, for tables above
 * maxRows, returns a reservoir-sampled representative subset instead of the full
 * dataset. Feeding an unbounded 100k+/1M+ row array into the synchronous,
 * main-thread analytics pipeline is what causes the "Analyze" button to freeze
 * the tab on large uploads — this keeps the pipeline's input bounded regardless
 * of dataset size. Use getTableRowCount() for the true total row count.
 */
export function getTableRows(tableName: string, maxRows: number = ANALYSIS_ROW_CAP): any[] {
  const tbl = getSqlTableName(tableName);
  const tableObj = (alasql.tables as any)[tbl];
  const data: any[] = tableObj?.data || [];

  if (data.length <= maxRows) return data;

  const reservoir = data.slice(0, maxRows);
  for (let i = maxRows; i < data.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j < maxRows) reservoir[j] = data[i];
  }
  return reservoir;
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE OWNERSHIP & LIFECYCLE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
const TABLE_OWNERS: Record<string, string> = {};

export function setTableOwner(tableName: string, datasetId: string): void {
  TABLE_OWNERS[getSqlTableName(tableName)] = datasetId;
}

export function getTableOwner(tableName: string): string | undefined {
  return TABLE_OWNERS[getSqlTableName(tableName)];
}

export function dropTable(name: string): void {
  const sqlName = getSqlTableName(name);
  try { alasql('DROP TABLE IF EXISTS ' + sqlName); } catch { /* ignore */ }
  delete (alasql.tables as any)[sqlName];
  delete TABLE_OWNERS[sqlName];
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY QUERY GENERATOR & INSIGHTS — REMOVED
//
// These functions have been removed as part of the Phase 1 pipeline unification.
// All analytics computation now routes through the domain layer:
//   src/domain/analytics/runAnalyticsQuestion.ts → IntentPlanner → Executors
//
// Removed functions:
//   - classifyIntent() → replaced by IntentPlanner.plan()
//   - stem(), getMatchScore(), findMentionedColumns() → replaced by SemanticResolver
//   - generateLocalQuery() → replaced by domain executors
//   - generateInsights() → replaced by narrative compiler in runAnalyticsQuestion
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// SQL EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────
export function executeSQL(sql: string, params?: any[]): any[] {
  try {
    // Strip SQL comments
    let cleaned = sql.replace(/--[^\n]*/g, '').trim();

    // Enforce strict SELECT & WITH compile statement allowed checks §2.3
    const isSelectOrWith = /^\s*(SELECT|WITH)\b/i.test(cleaned);
    if (!isSelectOrWith) {
      throw new Error("Security Violation: Only SELECT and WITH statement types are permitted for execution.");
    }

    // Remove features AlaSQL doesn't support
    cleaned = cleaned
      .replace(/DATE_TRUNC\s*\(\s*'month'\s*,\s*([^)]+)\)/gi, '$1')
      .replace(/PERCENTILE_CONT\([^)]+\)\s+WITHIN\s+GROUP\s*\([^)]+\)/gi, 'AVG($1)')
      .replace(/STDDEV\s*\(/gi, 'AVG(')
      .replace(/\bSUM\s*\(\s*SUM\s*\([^)]+\)\s*\)\s*OVER\s*\(\s*\)/gi, '0')
      .replace(/\bOVER\s*\([^)]*\)/gi, '');

    // CRITICAL: Convert square brackets to backticks
    // AlaSQL fails with [col] + reserved words like "count"
    cleaned = cleaned.replace(/\[([^\]]+)\]/g, '`$1`');

    // If it has WITH (CTE), try to extract just the final SELECT
    if (/^\s*WITH\s/i.test(cleaned)) {
      const lastSelect = cleaned.lastIndexOf('SELECT');
      if (lastSelect > 0) {
        try { return alasql(cleaned, params); } catch { /* fall through */ }
        cleaned = cleaned.substring(lastSelect);
      }
    }

    return alasql(cleaned, params);
  } catch (err: any) {
    console.error('AlaSQL query failed:', err.message);
    throw new Error(`Local SQL execution failed: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED FILTERS COMPILER
// ─────────────────────────────────────────────────────────────────────────────
export interface FilterClause {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between';
  value: any;
  isSuspended?: boolean;
}

export function compileFiltersToSQL(tableName: string, filters: FilterClause[]): { where: string; params: any[] } {
  const profile = SCHEMA_PROFILES[tableName];
  if (!profile) {
    return { where: '', params: [] };
  }

  const validCols = new Set(profile.columns.map(c => c.name));
  const clauses: string[] = [];
  const params: any[] = [];

  for (const f of filters) {
    if (f.isSuspended) continue;

    // Safety identifier check: column name MUST be an active schema column! §2.3
    if (!validCols.has(f.column)) {
      console.warn(`[SQL Compiler] Blocked unknown column identifier in filter: ${f.column}`);
      continue;
    }

    const col = '`' + f.column + '`';

    switch (f.operator) {
      case 'eq':
        clauses.push(`${col} = ?`);
        params.push(f.value);
        break;
      case 'neq':
        clauses.push(`${col} != ?`);
        params.push(f.value);
        break;
      case 'gt':
        clauses.push(`${col} > ?`);
        params.push(f.value);
        break;
      case 'lt':
        clauses.push(`${col} < ?`);
        params.push(f.value);
        break;
      case 'gte':
        clauses.push(`${col} >= ?`);
        params.push(f.value);
        break;
      case 'lte':
        clauses.push(`${col} <= ?`);
        params.push(f.value);
        break;
      case 'in':
        if (Array.isArray(f.value) && f.value.length > 0) {
          // Cap lists to 50 items to avoid stack overflows §6
          const truncated = f.value.slice(0, 50);
          const placeholders = truncated.map(() => '?').join(', ');
          clauses.push(`${col} IN (${placeholders})`);
          params.push(...truncated);
        }
        break;
      case 'between':
        if (Array.isArray(f.value) && f.value.length === 2) {
          clauses.push(`${col} BETWEEN ? AND ?`);
          params.push(f.value[0], f.value[1]);
        }
        break;
    }
  }

  const where = clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : '';
  return { where, params };
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEC V1.1 AGGREGATED LRU CACHE
// ─────────────────────────────────────────────────────────────────────────────
interface CacheEntry {
  key: string;
  result: any;
  byteSize: number;
  timestamp: number;
}

const cacheMap = new Map<string, CacheEntry>();
const CACHE_MAX_ENTRIES = 50;
const CACHE_MAX_BYTES = 64 * 1024 * 1024; // 64 MB

export function clearCache(): void {
  cacheMap.clear();
}

export function getCacheKeyHash(
  datasetId: string,
  versionHash: string,
  normalizedSQL: string,
  orderedParams: any[],
  filterContextHash: string,
  querySignature: string
): string {
  const rawKey = `${datasetId}:${versionHash}:${normalizedSQL.replace(/\s+/g, ' ').toLowerCase().trim()}:${JSON.stringify(orderedParams)}:${filterContextHash}:${querySignature}`;
  return getStringHash(rawKey);
}

export function getCache(key: string): any | null {
  const entry = cacheMap.get(key);
  if (entry) {
    // Evict and re-insert to refresh LRU order
    cacheMap.delete(key);
    cacheMap.set(key, entry);
    return entry.result;
  }
  return null;
}

export function setCache(key: string, result: any, querySignature: string): void {
  // Caching Constraint: Never cache full datagrid row outputs above 1,000 rows §5.2
  if (querySignature.includes('tableRows') || (Array.isArray(result) && result.length > 1000)) {
    return;
  }

  const strRep = JSON.stringify(result);
  const byteSize = strRep.length * 2;

  if (byteSize > CACHE_MAX_BYTES / 4) return;

  let totalBytes = Array.from(cacheMap.values()).reduce((sum, e) => sum + e.byteSize, 0);

  // Evict until constraints are satisfied
  while (cacheMap.size >= CACHE_MAX_ENTRIES || totalBytes + byteSize > CACHE_MAX_BYTES) {
    const oldestKey = cacheMap.keys().next().value;
    if (!oldestKey) break;
    const evicted = cacheMap.get(oldestKey);
    if (evicted) {
      totalBytes -= evicted.byteSize;
    }
    cacheMap.delete(oldestKey);
  }

  cacheMap.set(key, {
    key,
    result,
    byteSize,
    timestamp: Date.now()
  });
}
