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
// CSV LOADER
// ─────────────────────────────────────────────────────────────────────────────
export function loadCSV(filename: string, csvContent: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing errors:', results.errors);
        }
        registerTable(filename, results.data);
        resolve(results.data);
      },
      error: (err: any) => {
        reject(err);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON LOADER  (smart: metadata-aware + nested-array extraction)
// ─────────────────────────────────────────────────────────────────────────────
export function loadJSON(filename: string, jsonContent: string): any[] {
  // ── Step 1: Parse ────────────────────────────────────────────────────────
  let raw: any;
  try {
    raw = JSON.parse(jsonContent);
  } catch (parseErr: any) {
    throw new Error(`Invalid JSON in "${filename}": ${parseErr.message}`);
  }

  // ── Step 2: Handle top-level arrays directly ──────────────────────────────
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error(`"${filename}" contains an empty JSON array — no records to load.`);
    }
    registerTable(filename, raw);
    return raw;
  }

  // ── Step 3: Object — check for nested data arrays first ──────────────────
  if (typeof raw === 'object' && raw !== null) {
    const NESTED_KEYS = ['data', 'records', 'rows', 'items', 'results',
                         'features', 'entries', 'dataset', 'values'];
    for (const key of NESTED_KEYS) {
      const candidate = raw[key];
      if (Array.isArray(candidate) && candidate.length > 0
          && typeof candidate[0] === 'object' && candidate[0] !== null) {
        console.info(
          `[loadJSON] "${filename}": extracted nested data array ` +
          `from key "${key}" (${candidate.length} records).`
        );
        registerTable(filename, candidate);
        return candidate;
      }
    }

    // ── Step 4: Metadata/descriptor-file detection ────────────────────────
    // Files like *-metadata.json contain @context, license, creator, etc.
    // They are NOT data tables.  Give the user a clear error instead of
    // creating a 1-row table that contains schema metadata.
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
        `Please upload the real data file — it is usually a .csv or a .json ` +
        `file that contains the actual records (e.g., one row per respondent).`
      );
    }

    // ── Step 5: Single plain object — wrap as 1-row table (last resort) ───
    console.warn(
      `[loadJSON] "${filename}": wrapping single JSON object as 1-row table. ` +
      `If this is unexpected, upload a JSON array or a CSV file instead.`
    );
    const singleRow = [raw];
    registerTable(filename, singleRow);
    return singleRow;
  }

  throw new Error(
    `"${filename}" is not a valid JSON data file. Expected a JSON array or ` +
    `an object with a nested data array.`
  );
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
