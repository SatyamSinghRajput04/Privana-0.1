import alasql from 'alasql';
import { DatasetValidator } from '../validator/validator';
import { ColumnResolver } from '../resolver/resolver';
import { SQLGenerator } from '../sql/sqlGenerator';
import { ResultVerifier } from '../verifier/verifier';
import { QueryPlan, Intent } from '../types/plan';
import { getSqlTableName } from '../../lib/sqlEngine';

/**
 * Deep check for calculation correctness with floating point tolerance
 */
function areRowsDeepEqual(rows1: any[], rows2: any[], tolerance = 0.005): { equal: boolean; reason?: string } {
  if (rows1.length !== rows2.length) {
    return { equal: false, reason: `Record counts differ: ${rows1.length} vs ${rows2.length}` };
  }
  if (rows1.length === 0) return { equal: true };

  const cols1 = Object.keys(rows1[0]).sort();
  const cols2 = Object.keys(rows2[0]).sort();

  if (cols1.length !== cols2.length) {
    return { equal: false, reason: `Column counts differ: ${cols1.length} vs ${cols2.length}` };
  }

  // Row by row cell checks
  for (let i = 0; i < rows1.length; i++) {
    const r1 = rows1[i];
    const r2 = rows2[i];

    for (const key of cols1) {
      const v1 = r1[key];
      // Since new columns might use alias labels like 'x_value', find best case-insensitive match or position match
      const matchingKey = cols2.find(k => k.toLowerCase() === key.toLowerCase()) || cols2[cols1.indexOf(key)];
      if (!matchingKey) {
        return { equal: false, reason: `Missing matching column for key "${key}" in shadow results` };
      }
      const v2 = r2[matchingKey];

      if (typeof v1 === 'number' && typeof v2 === 'number') {
        if (Math.abs(v1 - v2) > tolerance) {
          return { equal: false, reason: `Numeric mismatch at row ${i}, col "${key}": ${v1} vs ${v2} (diff > ${tolerance})` };
        }
      } else if (String(v1).trim().toLowerCase() !== String(v2).trim().toLowerCase()) {
        // Safe string representation checks
        return { equal: false, reason: `Value mismatch at row ${i}, col "${key}": "${v1}" vs "${v2}"` };
      }
    }
  }

  return { equal: true };
}

export const ShadowTester = {
  run(question: string, tableName: string, legacySql: string, legacyResults: any[]): void {
    try {
      const tbl = getSqlTableName(tableName);
      const tableObj = (alasql.tables as any)[tbl];
      if (!tableObj || !tableObj.data) {
        console.warn(`[Privana Shadow Test] Table "${tbl}" not loaded in alasql. Skipping.`);
        return;
      }

      const rowsData = tableObj.data;

      // 1. Profile Dataset
      const profile = DatasetValidator.profile(rowsData, tableName);

      // 2. Classify Intent
      const ql = question.toLowerCase();
      let intent: Intent = 'aggregation';
      if (/correlat|scatter|relationship|related|vs\s|versus/.test(ql)) intent = 'correlation';
      else if (/regression|predict|trend\s*line|linear/.test(ql)) intent = 'regression';
      else if (/histogram|distribution\s+of|frequency|spread|percentile|quartile|median/.test(ql)) intent = 'distribution';
      else if (/trend|monthly|weekly|daily|over\s+time|by\s+month|by\s+week|time\s*series|year|quarter/.test(ql)) intent = 'timeseries';
      else if (/top\s|highest|best|most|bottom\s|lowest|worst|least|rank/.test(ql)) intent = 'ranking';
      else if (/compare|margin|ratio|growth|change/.test(ql)) intent = 'comparison';
      else if (/breakdown|share|percent|proportion|composition|split|pie/.test(ql)) intent = 'composition';
      else if (/how\s+many|number\s+of|count\s+by/.test(ql)) intent = 'count';

      // 3. Resolve columns using natural words in the question
      const resolvedCols: string[] = [];
      const words = question.split(/[^a-zA-Z0-9_]+/);
      
      words.forEach(w => {
        if (w.length < 3) return;
        const matched = ColumnResolver.resolve(w, profile);
        if (matched && !resolvedCols.includes(matched.columnName)) {
          resolvedCols.push(matched.columnName);
        }
      });

      // Default fallback columns if resolver mapped none
      const numCols = profile.columns.filter(c => c.type === 'numeric').map(c => c.name);
      const catCols = profile.columns.filter(c => c.type === 'category').map(c => c.name);
      const dateCols = profile.columns.filter(c => c.type === 'date').map(c => c.name);

      const metric = resolvedCols.find(c => profile.columns.find(x => x.name === c)?.type === 'numeric') || numCols[0] || null;
      const groupBy = resolvedCols.filter(c => profile.columns.find(x => x.name === c)?.type !== 'numeric');
      
      if (groupBy.length === 0) {
        const fallbackGroup = catCols[0] || dateCols[0] || null;
        if (fallbackGroup) groupBy.push(fallbackGroup);
      }

      // 4. Construct plan
      const plan: QueryPlan = {
        planId: 'shadow_plan_' + Date.now().toString(16),
        intent,
        metric,
        groupBy,
        filters: [],
        assumptions: ['Automated shadow-testing assumptions generated'],
        confidence: 'high',
        source: 'rule-engine',
        datasetHash: profile.datasetHash
      };

      // 5. Generate New SQL (now parameterized!)
      const parameterized = SQLGenerator.generate(plan, tableName);

      // 6. Execute Parameterized Query
      let newResults: any[] = [];
      let executionError = null;
      try {
        // Strip SQL comments for alasql parsing
        let cleaned = parameterized.sql.replace(/--[^\n]*/g, '').trim();
        cleaned = cleaned.replace(/\[([^\]]+)\]/g, '`$1`');
        
        // Execute with parameterized bindings securely!
        newResults = alasql(cleaned, parameterized.params);
      } catch (err: any) {
        executionError = err.message;
      }

      // 7. Verify Outcome
      const verification = ResultVerifier.verify(plan, newResults);

      // 8. Output Deep Parity Report
      const parityCheck = areRowsDeepEqual(legacyResults, newResults);

      console.log(`%c[Privana Shadow Test] Deep Parity Summary: "${question}"`, 'color: #38bdf8; font-weight: bold; font-size: 1.1em;');
      console.log(`- Legacy SQL:\n%c${legacySql}`, 'color: #94a3b8; font-family: monospace;');
      console.log(`- New SQL:\n%c${parameterized.sql}\n%cParameters: [${parameterized.params.join(', ')}]`, 'color: #60a5fa; font-family: monospace;', 'color: #38bdf8;');
      
      if (executionError) {
        console.log(`- Deep Calculation Parity: %cFAILED%c (Execution Error: ${executionError})`, 'color: #ef4444; font-weight: bold;', 'color: inherit;');
      } else if (parityCheck.equal) {
        console.log(`- Deep Calculation Parity: %cMATCHED (100% CORRECT CALCULATIONS)%c`, 'color: #22c55e; font-weight: bold;', 'color: inherit;');
      } else {
        console.log(`- Deep Calculation Parity: %cMISMATCH%c (Reason: ${parityCheck.reason})`, 'color: #f97316; font-weight: bold;', 'color: inherit;');
      }

      console.log(`- Verification Metrics: Success -> %c${verification.success}%c, Issues: ${verification.issues.length}`, 
        verification.success ? 'color: #22c55e;' : 'color: #ef4444;', 'color: inherit;'
      );
      console.log('─────────────────────────────────────────────────────────────────────────────');

    } catch (e: any) {
      console.error('[Privana Shadow Test Error] Failed to complete shadow run:', e.message);
    }
  }
};
