import { QueryPlan, Filter } from '../types/plan';

export type ParameterizedSQL = {
  sql: string;
  params: any[];
};

/**
 * Escapes table or column identifiers to prevent SQL injection or parsing errors
 */
export function escapeIdentifier(id: string): string {
  return '[' + id.replace(/[\]]/g, '') + ']';
}

/**
 * Clean and format literal values in SQL where clauses securely
 */
export function formatLiteral(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') {
    return isFinite(val) ? String(val) : 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  // Escape single quotes for string literals
  return "'" + String(val).replace(/'/g, "''") + "'";
}

/**
 * Map standard operators securely
 */
function getSecureOperator(op: string): string {
  const allowed = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN'];
  return allowed.includes(op.toUpperCase()) ? op.toUpperCase() : '=';
}

export const SQLGenerator = {
  generate(plan: QueryPlan, filename: string): ParameterizedSQL {
    const tbl = escapeIdentifier(filename.replace(/\.(csv|parquet|xlsx|json)$/i, '').replace(/[^a-z0-9_]/gi, '_'));
    const intent = plan.intent;
    const metric = plan.metric;
    const groupBy = plan.groupBy || [];
    const filters = plan.filters || [];
    const limit = plan.limit;

    const params: any[] = [];

    // Build parameterized WHERE clause
    const filterClauses: string[] = [];
    
    filters.forEach((f: Filter) => {
      const col = escapeIdentifier(f.column);
      const op = getSecureOperator(f.operator);
      if (op === 'IN' && Array.isArray(f.value)) {
        const placeholders = f.value.map(() => '?').join(', ');
        params.push(...f.value);
        filterClauses.push(`${col} IN (${placeholders})`);
      } else {
        params.push(f.value);
        filterClauses.push(`${col} ${op} ?`);
      }
    });

    // Enforce non-null criteria for core columns by default
    if (metric) {
      filterClauses.push(`${escapeIdentifier(metric)} IS NOT NULL`);
    }
    groupBy.forEach(col => {
      filterClauses.push(`${escapeIdentifier(col)} IS NOT NULL`);
    });

    const whereClause = filterClauses.length > 0 ? '\nWHERE ' + filterClauses.join(' AND\n  ') : '';

    // Handle intent-specific queries
    let sql = '';
    switch (intent) {
      case 'correlation':
      case 'regression': {
        const xCol = escapeIdentifier(metric || 'value');
        const yCol = escapeIdentifier(groupBy[0] || 'count');
        sql = `-- Statistical Relationship Analysis\nSELECT\n  ${xCol} AS x_value,\n  ${yCol} AS y_value\nFROM ${tbl}${whereClause}\nORDER BY ${xCol}\nLIMIT 500`;
        break;
      }

      case 'distribution': {
        const col = escapeIdentifier(metric || 'value');
        sql = `-- Statistical Distribution Summary\nSELECT\n  ${col} AS val\nFROM ${tbl}${whereClause}\nORDER BY ${col}`;
        break;
      }

      case 'anomaly': {
        const col = escapeIdentifier(metric || 'value');
        const idCol = escapeIdentifier(groupBy[0] || 'category');
        sql = `-- Anomaly Detection Feed\nSELECT\n  ${idCol} AS id_label,\n  ${col} AS numeric_value\nFROM ${tbl}${whereClause}\nORDER BY ${col} DESC\nLIMIT 100`;
        break;
      }

      case 'timeseries': {
        const dtCol = escapeIdentifier(groupBy[0] || 'date');
        const metCol = escapeIdentifier(metric || 'value');
        sql = `-- Monthly Time-Series Summary\nSELECT\n  ${dtCol} AS date_label,\n  AVG(${metCol}) AS total_val,\n  COUNT(*) AS count\nFROM ${tbl}${whereClause}\nGROUP BY ${dtCol}\nORDER BY ${dtCol}`;
        break;
      }

      case 'ranking': {
        const catCol = escapeIdentifier(groupBy[0] || 'category');
        const metCol = escapeIdentifier(metric || 'value');
        const countMet = metric ? `SUM(${metCol})` : 'COUNT(*)';
        const finalLim = limit || 10;
        sql = `-- Category Ranking Analysis\nSELECT\n  ${catCol} AS category_label,\n  ${countMet} AS total_val,\n  COUNT(*) AS count\nFROM ${tbl}${whereClause}\nGROUP BY ${catCol}\nORDER BY total_val DESC\nLIMIT ${finalLim}`;
        break;
      }

      case 'composition': {
        const catCol = escapeIdentifier(groupBy[0] || 'category');
        const metCol = escapeIdentifier(metric || 'value');
        const sumMet = metric ? `SUM(${metCol})` : 'COUNT(*)';
        sql = `-- Composition Share Breakdown\nSELECT\n  ${catCol} AS category_label,\n  ${sumMet} AS total_val\nFROM ${tbl}${whereClause}\nGROUP BY ${catCol}\nORDER BY total_val DESC`;
        break;
      }

      case 'comparison': {
        const catCol = escapeIdentifier(groupBy[0] || 'category');
        const metCol = escapeIdentifier(metric || 'value');
        const valMet = metric ? `AVG(${metCol})` : 'COUNT(*)';
        sql = `-- Group Comparison Averages\nSELECT\n  ${catCol} AS category_label,\n  ${valMet} AS total_val,\n  COUNT(*) AS count\nFROM ${tbl}${whereClause}\nGROUP BY ${catCol}\nORDER BY total_val DESC`;
        break;
      }

      default: {
        // Descriptive descriptive statistics
        const catCol = escapeIdentifier(groupBy[0] || 'category');
        const metCol = escapeIdentifier(metric || 'value');
        const sumMet = metric ? `SUM(${metCol})` : 'COUNT(*)';
        sql = `-- Analytical Report Summary\nSELECT\n  ${catCol} AS category_label,\n  ${sumMet} AS total_val,\n  COUNT(*) AS count\nFROM ${tbl}${whereClause}\nGROUP BY ${catCol}\nORDER BY total_val DESC\nLIMIT 20`;
        break;
      }
    }

    return { sql, params };
  }
};
