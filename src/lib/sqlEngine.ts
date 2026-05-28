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
  // Must CREATE TABLE first so AlaSQL's query engine recognizes it.
  // Direct assignment to alasql.tables works for data storage,
  // but CREATE TABLE ensures the parser can find it.
  try { alasql('DROP TABLE IF EXISTS ' + q(name)); } catch { /* ignore */ }
  try { alasql('CREATE TABLE ' + q(name)); } catch { /* ignore */ }
  (alasql.tables as any)[name].data = data;
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
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Multiply by FNV prime (using bitwise ops for JS integer range)
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

  const columns = Object.keys(data[0]);
  const colSpecs: ColumnSpec[] = [];

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

  for (const colName of columns) {
    let nullCount = 0;
    const values: any[] = [];
    let originalType = 'string';
    let coercedType = 'string';
    let coercedExample = '';

    for (let i = 0; i < rowCount; i++) {
      let val = data[i][colName];

      // Stage 0 Ingestion: Null Coercion
      if (val === null || val === undefined || val === '' || (typeof val === 'string' && val.trim() === '')) {
        data[i][colName] = null;
        nullCount++;
        continue;
      }

      if (typeof val === 'number') {
        if (isNaN(val) || !isFinite(val)) {
          data[i][colName] = null;
          nullCount++;
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
              data[i][colName] = iso;
              originalType = 'string';
              coercedType = 'date';
              coercedExample = trimmed;
              val = iso;
            }
          } catch {
            // Keep original on parse failure
          }
        }
      }

      values.push(val);
    }

    const nonNullCount = values.length;
    let inferredType: ColumnSpec['type'] = 'string';
    let role: ColumnSpec['role'] = 'unknown';

    if (nonNullCount > 0) {
      const numbers = values.filter(v => typeof v === 'number');
      const booleans = values.filter(v => typeof v === 'boolean');
      const dates = values.filter(v => typeof v === 'string' && (datePattern.test(v) || dateTimePattern.test(v) || v.endsWith('Z')));

      if (numbers.length > nonNullCount * 0.7) {
        const isAllInt = numbers.every(n => Number.isInteger(n));
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

    const uniqueValues = new Set(values);
    const cardinality = uniqueValues.size;

    const spec: ColumnSpec = {
      name: colName,
      type: inferredType,
      nullable: nullCount > 0,
      role,
      cardinality: cardinality < 100 ? cardinality : undefined,
      nullCount,
      originalType,
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
// CSV LOADER (Hardened limits & sanitization)
// ─────────────────────────────────────────────────────────────────────────────
export function loadCSV(filename: string, csvContent: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    // 1. File size check (100MB cap)
    const byteSize = new Blob([csvContent]).size;
    if (byteSize > 100 * 1024 * 1024) {
      return reject(new Error(`Duplicate and/or overflow Column check failed: File size exceeds the strict cap of 100 MB (size: ${(byteSize / (1024 * 1024)).toFixed(1)} MB).`));
    }

    // 2. Headers count & uniqueness checks
    const lines = csvContent.split(/\r?\n/).filter(Boolean);
    if (lines.length > 0) {
      const firstLine = lines[0];
      const parsedHeader = Papa.parse(firstLine).data[0] as string[];
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

    Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing errors:', results.errors);
        }

        // UTF-8 Clean Pass & Replacement of Invalid Character Sentinels
        const cleanedData = results.data.map((row: any) => {
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

        try {
          normalizeAndProfileData(filename, cleanedData, csvContent);
          registerTable(filename, cleanedData);
          resolve(cleanedData);
        } catch (e: any) {
          reject(e);
        }
      },
      error: (err: any) => {
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
// SMART LOCAL QUERY GENERATOR
//
// CRITICAL RULES for AlaSQL compatibility:
// 1. ALL identifiers MUST use backticks (not square brackets)
// 2. NEVER use "count" as an alias — it's a reserved word
// 3. Use "cnt" or "record_count" instead
// 4. All column names in backticks to avoid reserved word clashes
// ─────────────────────────────────────────────────────────────────────────────
interface QueryResult {
  sql: string;
  chartType: string;
  intent: string;
}

function classifyIntent(question: string): string {
  const ql = question.toLowerCase();
  if (/correlat|scatter|relationship|related|vs\s|versus/.test(ql)) return 'correlation';
  if (/histogram|distribution\s+of|frequency|spread|percentile|quartile|median/.test(ql)) return 'distribution';
  if (/trend|monthly|weekly|daily|over\s+time|by\s+month|by\s+week|time\s*series|year|quarter/.test(ql)) return 'timeseries';
  if (/top\s|highest|best|most|bottom\s|lowest|worst|least|rank/.test(ql)) return 'ranking';
  if (/compare|margin|ratio|growth|change/.test(ql)) return 'comparison';
  if (/breakdown|share|percent|proportion|composition|split|pie/.test(ql)) return 'composition';
  if (/how\s+many|number\s+of|count\s+by/.test(ql)) return 'count';
  if (/average|mean|avg|sum|total/.test(ql)) return 'aggregation';
  return 'ranking';
}

function stem(word: string): string {
  word = word.toLowerCase().trim();
  // Strip trailing 's' to handle simple plurals, but avoid words naturally ending in double s like stress
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
}

function getMatchScore(colName: string, questionStems: string[], questionRaw: string): number {
  const cl = colName.toLowerCase();
  const clWords = cl.replace(/_/g, ' ');

  // Use regex with word boundaries to prevent substring matching (e.g. "age" matching inside "average")
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r1 = new RegExp('\\b' + esc(cl) + '\\b');
  const r2 = new RegExp('\\b' + esc(clWords) + '\\b');

  if (r1.test(questionRaw) || r2.test(questionRaw)) {
    return 2.0;
  }

  const colWords = colName.split(/[_\s]+/).map(w => w.trim()).filter(Boolean);
  const colStems = colWords.map(stem);

  // Calculate intersection of stems
  let matches = 0;
  for (const stemVal of colStems) {
    if (questionStems.includes(stemVal)) {
      matches++;
    }
  }

  if (matches === 0) return 0;

  // Single word columns must match exactly
  if (colStems.length === 1) {
    return matches === 1 ? 1.0 : 0;
  }

  // Multi-word columns score by match density
  const ratio = matches / colStems.length;

  // If we match all words of a compound column name (e.g. "sleep hour" matching "sleep_hours"), boost it
  if (matches === colStems.length) {
    return 1.8;
  }

  // Require at least 50% of the column words to match to avoid weak/spurious matches
  if (ratio >= 0.5) {
    return ratio;
  }

  return 0;
}

function findMentionedColumns(question: string, schema: ColumnInfo[]): ColumnInfo[] {
  const ql = question.toLowerCase();
  
  // Clean question punctuation and extract word stems
  const qWords = ql.split(/[^a-z0-9_]+/).map(w => w.trim()).filter(Boolean);
  const qStems = qWords.map(stem);

  const scored = schema.map(col => {
    const score = getMatchScore(col.name, qStems, ql);
    return { col, score };
  });

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.col);
}

export function generateLocalQuery(question: string, tableName: string): QueryResult {
  const tbl = getSqlTableName(tableName);
  const T = q(tbl); // backtick-quoted table name
  const schema = getTableSchema(tableName);

  if (schema.length === 0) {
    return { sql: `SELECT * FROM ${T} LIMIT 20`, chartType: 'bar', intent: 'unknown' };
  }

  const intent = classifyIntent(question);
  const mentioned = findMentionedColumns(question, schema);

  const numCols = schema.filter(c => c.type === 'number');
  const strCols = schema.filter(c => c.type === 'string');
  const dateCols = schema.filter(c => c.type === 'date');

  const mentionedNum = mentioned.filter(c => c.type === 'number');
  const mentionedStr = mentioned.filter(c => c.type === 'string');

  // Pick the best columns
  const groupCol = mentionedStr[0]?.name || strCols[0]?.name;
  const valueCol = mentionedNum[0]?.name || numCols[0]?.name;
  const valueCol2 = mentionedNum[1]?.name || numCols[1]?.name;
  const dateCol = dateCols[0]?.name;

  // Extract LIMIT from question
  const limitMatch = question.match(/\b(\d+)\b/);
  const limit = limitMatch ? Math.min(parseInt(limitMatch[1]), 50) : 15;

  switch (intent) {
    case 'ranking': {
      if (groupCol && valueCol) {
        return {
          sql: `SELECT ${q(groupCol)}, SUM(${q(valueCol)}) AS ${q('total_' + valueCol)}, COUNT(*) AS ${q('cnt')} FROM ${T} WHERE ${q(groupCol)} IS NOT NULL GROUP BY ${q(groupCol)} ORDER BY ${q('total_' + valueCol)} DESC LIMIT ${limit}`,
          chartType: 'bar', intent
        };
      }
      if (groupCol) {
        return {
          sql: `SELECT ${q(groupCol)}, COUNT(*) AS ${q('cnt')} FROM ${T} WHERE ${q(groupCol)} IS NOT NULL GROUP BY ${q(groupCol)} ORDER BY ${q('cnt')} DESC LIMIT ${limit}`,
          chartType: 'bar', intent
        };
      }
      if (valueCol) {
        return {
          sql: `SELECT * FROM ${T} ORDER BY ${q(valueCol)} DESC LIMIT ${limit}`,
          chartType: 'bar', intent
        };
      }
      break;
    }

    case 'count': {
      const col = groupCol || strCols[0]?.name;
      if (col) {
        return {
          sql: `SELECT ${q(col)}, COUNT(*) AS ${q('cnt')} FROM ${T} WHERE ${q(col)} IS NOT NULL GROUP BY ${q(col)} ORDER BY ${q('cnt')} DESC`,
          chartType: 'bar', intent
        };
      }
      break;
    }

    case 'composition': {
      const col = groupCol || strCols[0]?.name;
      if (col && valueCol) {
        return {
          sql: `SELECT ${q(col)}, SUM(${q(valueCol)}) AS ${q('total')} FROM ${T} WHERE ${q(col)} IS NOT NULL GROUP BY ${q(col)} ORDER BY ${q('total')} DESC`,
          chartType: 'pie', intent
        };
      }
      if (col) {
        return {
          sql: `SELECT ${q(col)}, COUNT(*) AS ${q('cnt')} FROM ${T} WHERE ${q(col)} IS NOT NULL GROUP BY ${q(col)} ORDER BY ${q('cnt')} DESC`,
          chartType: 'pie', intent
        };
      }
      break;
    }

    case 'comparison': {
      if (groupCol && valueCol && valueCol2) {
        return {
          sql: `SELECT ${q(groupCol)}, SUM(${q(valueCol)}) AS ${q(valueCol)}, SUM(${q(valueCol2)}) AS ${q(valueCol2)} FROM ${T} WHERE ${q(groupCol)} IS NOT NULL GROUP BY ${q(groupCol)} ORDER BY 2 DESC LIMIT 15`,
          chartType: 'bar', intent
        };
      }
      if (groupCol && valueCol) {
        return {
          sql: `SELECT ${q(groupCol)}, SUM(${q(valueCol)}) AS ${q('total')}, COUNT(*) AS ${q('cnt')} FROM ${T} WHERE ${q(groupCol)} IS NOT NULL GROUP BY ${q(groupCol)} ORDER BY ${q('total')} DESC LIMIT 15`,
          chartType: 'bar', intent
        };
      }
      break;
    }

    case 'timeseries': {
      if (dateCol && valueCol) {
        return {
          sql: `SELECT ${q(dateCol)}, SUM(${q(valueCol)}) AS ${q('total')}, COUNT(*) AS ${q('cnt')} FROM ${T} WHERE ${q(dateCol)} IS NOT NULL GROUP BY ${q(dateCol)} ORDER BY ${q(dateCol)}`,
          chartType: 'line', intent
        };
      }
      if (dateCol) {
        return {
          sql: `SELECT ${q(dateCol)}, COUNT(*) AS ${q('cnt')} FROM ${T} WHERE ${q(dateCol)} IS NOT NULL GROUP BY ${q(dateCol)} ORDER BY ${q(dateCol)}`,
          chartType: 'line', intent
        };
      }
      break;
    }

    case 'correlation': {
      const x = mentionedNum[0]?.name || numCols[0]?.name;
      const y = mentionedNum[1]?.name || numCols[1]?.name;
      if (x && y) {
        return {
          sql: `SELECT ${q(x)} AS ${q('x_value')}, ${q(y)} AS ${q('y_value')} FROM ${T} WHERE ${q(x)} IS NOT NULL AND ${q(y)} IS NOT NULL LIMIT 200`,
          chartType: 'scatter', intent
        };
      }
      break;
    }

    case 'distribution': {
      const col = mentionedNum[0]?.name || numCols[0]?.name;
      if (col) {
        return {
          sql: `SELECT ${q(col)} FROM ${T} WHERE ${q(col)} IS NOT NULL`,
          chartType: 'bar', intent
        };
      }
      break;
    }

    case 'aggregation': {
      if (groupCol && valueCol) {
        return {
          sql: `SELECT ${q(groupCol)}, SUM(${q(valueCol)}) AS ${q('total')}, AVG(${q(valueCol)}) AS ${q('average')}, COUNT(*) AS ${q('cnt')} FROM ${T} WHERE ${q(groupCol)} IS NOT NULL GROUP BY ${q(groupCol)} ORDER BY ${q('total')} DESC LIMIT 20`,
          chartType: 'bar', intent
        };
      }
      if (groupCol) {
        return {
          sql: `SELECT ${q(groupCol)}, COUNT(*) AS ${q('cnt')} FROM ${T} WHERE ${q(groupCol)} IS NOT NULL GROUP BY ${q(groupCol)} ORDER BY ${q('cnt')} DESC LIMIT 20`,
          chartType: 'bar', intent
        };
      }
      break;
    }
  }

  // Fallback: group by first string column
  if (strCols.length > 0) {
    const col = strCols[0].name;
    return {
      sql: `SELECT ${q(col)}, COUNT(*) AS ${q('cnt')} FROM ${T} WHERE ${q(col)} IS NOT NULL GROUP BY ${q(col)} ORDER BY ${q('cnt')} DESC LIMIT 20`,
      chartType: 'bar', intent
    };
  }

  return { sql: `SELECT * FROM ${T} LIMIT 20`, chartType: 'bar', intent };
}

// ─────────────────────────────────────────────────────────────────────────────
// INSIGHT GENERATOR — works on real data
// ─────────────────────────────────────────────────────────────────────────────
export function generateInsights(data: any[]): string[] {
  if (!data || data.length === 0) return ['No data returned for this query.'];

  const insights: string[] = [];
  const keys = Object.keys(data[0]);
  const numKeys = keys.filter(k => typeof data[0][k] === 'number');
  const strKeys = keys.filter(k => typeof data[0][k] === 'string');

  const catKey = strKeys[0];
  const valKey = numKeys[0];

  if (catKey && valKey && data.length > 0) {
    const total = data.reduce((s, r) => s + (r[valKey] || 0), 0);
    const topVal = data[0][valKey];
    const topLabel = data[0][catKey];
    const pct = total > 0 ? Math.round((topVal / total) * 100) : 0;

    insights.push(`🥇 "${topLabel}" leads with ${Number(topVal).toLocaleString()} — ${pct}% of total`);

    if (data.length >= 3) {
      const top3Total = data.slice(0, 3).reduce((s, r) => s + (r[valKey] || 0), 0);
      const top3Pct = total > 0 ? Math.round((top3Total / total) * 100) : 0;
      insights.push(`📊 Top 3 account for ${top3Pct}% of total (${Number(top3Total).toLocaleString()})`);
    }

    if (data.length >= 2) {
      const last = data[data.length - 1];
      insights.push(`📉 Lowest: "${last[catKey]}" with ${Number(last[valKey]).toLocaleString()}`);
    }
  } else if (catKey && data.length > 0) {
    insights.push(`📊 ${data.length} distinct values found`);
    const cntKey = numKeys.find(k => k === 'cnt' || k === 'record_count') || numKeys[0];
    if (cntKey) {
      insights.push(`🥇 "${data[0][catKey]}" is most frequent with ${data[0][cntKey]} occurrences`);
    }
  }

  insights.push(`🔒 Analysis executed locally — 0 bytes sent externally`);
  insights.push(`⚡ Processed in-memory — no data left your device`);
  return insights;
}

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
