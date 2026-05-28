// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/workspaceQueryEngine.ts
// S13 WORKSPACE ENGINE — Multi-sheet dynamic canvas compiler and active-tab execution.
// ─────────────────────────────────────────────────────────────────────────────

import { WorkspaceBlueprint, SheetSpec, CardDefinition, CardSpec, VisualContract } from './types';
import { executeSQL, getSqlTableName, compileFiltersToSQL, SCHEMA_PROFILES } from '../../lib/sqlEngine';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useCockpitStore } from '../../store/useCockpitStore';
import { DatasetValidator } from '../validator/validator';

// ─────────────────────────────────────────────────────────────────────────────
// 1. DETERMINISTIC WORKSPACE PLANNER (SCHEMA-DRIVEN BLUEPRINTS)
// ─────────────────────────────────────────────────────────────────────────────
export const planWorkspace = (datasetName: string, columns: any[]): WorkspaceBlueprint => {
  const profileContract = SCHEMA_PROFILES[datasetName] || { versionHash: 'default' };
  const names = columns.map(c => c.name);
  const lowercaseNames = columns.map(c => c.name.toLowerCase());

  const hasMentalHealth = lowercaseNames.includes('sleep_hours') && 
                           lowercaseNames.includes('gender') && 
                           lowercaseNames.includes('stress_level');

  const sheets: SheetSpec[] = [];

  if (hasMentalHealth) {
    // Tab 1: Overview Dashboard
    sheets.push({
      id: 'sheet_overview',
      name: 'Overview Dashboard',
      cards: [
        {
          id: 'card_stress_gender',
          title: 'Stress Level by Gender',
          chartType: 'bar',
          spec: { kind: 'groupedAverage', metricColumn: 'stress_level', groupColumn: 'gender', aggType: 'avg' }
        },
        {
          id: 'card_screentime_gender',
          title: 'Social Hours by Gender',
          chartType: 'bar',
          spec: { kind: 'groupedAverage', metricColumn: 'daily_social_media_hours', groupColumn: 'gender', aggType: 'avg' }
        },
        {
          id: 'card_screentime_stress',
          title: 'Social Hours vs Stress Level',
          chartType: 'scatter',
          spec: { kind: 'correlation', xColumn: 'daily_social_media_hours', yColumn: 'stress_level' }
        }
      ]
    });

    // Tab 2: Sleep & Anxiety Metrics
    sheets.push({
      id: 'sheet_sleep_anxiety',
      name: 'Sleep & Anxiety Metrics',
      cards: [
        {
          id: 'card_sleep_academic',
          title: 'Sleep Hours by Academic Grade',
          chartType: 'bar',
          spec: { kind: 'groupedAverage', metricColumn: 'sleep_hours', groupColumn: 'academic_performance', aggType: 'avg' }
        },
        {
          id: 'card_sleep_anxiety',
          title: 'Sleep Hours vs Anxiety Level',
          chartType: 'scatter',
          spec: { kind: 'correlation', xColumn: 'sleep_hours', yColumn: 'anxiety_level' }
        },
        {
          id: 'card_depression_dist',
          title: 'Depression Distribution Bins',
          chartType: 'bar',
          spec: { kind: 'distribution', metricColumn: 'depression_label', binCount: 5 }
        }
      ]
    });

    // Tab 3: Dynamic AI Insights
    sheets.push({
      id: 'sheet_insights',
      name: 'Interpretive AI Insights',
      cards: [
        {
          id: 'card_insights_kpi',
          title: 'Report Summary Index',
          chartType: 'kpi',
          spec: { kind: 'ranking', metricColumn: 'stress_level', categoryColumn: 'gender', limit: 2, sort: 'desc' }
        }
      ]
    });
  } else {
    // Generic Schema fallback tabs
    const numCols = columns.filter(c => c.type === 'number');
    const catCols = columns.filter(c => c.type === 'string' || c.type === 'category');
    
    const xCol = numCols[0]?.name || columns[0]?.name;
    const yCol = numCols[1]?.name || numCols[0]?.name;
    const catCol = catCols[0]?.name || columns[0]?.name;

    // Tab 1: Standard Aggregates
    sheets.push({
      id: 'sheet_aggregates',
      name: 'Metric Summaries',
      cards: [
        {
          id: 'card_generic_agg1',
          title: `${xCol} Average by ${catCol}`,
          chartType: 'bar',
          spec: { kind: 'groupedAverage', metricColumn: xCol, groupColumn: catCol, aggType: 'avg' }
        },
        {
          id: 'card_generic_dist',
          title: `${catCol} Category Frequency`,
          chartType: 'bar',
          spec: { kind: 'distribution', metricColumn: catCol, binCount: 6 }
        }
      ]
    });

    if (numCols.length >= 2) {
      // Tab 2: Scientific Relationships
      sheets.push({
        id: 'sheet_trends',
        name: 'Scientific Trends',
        cards: [
          {
            id: 'card_generic_corr',
            title: `${xCol} vs ${yCol} Correlation`,
            chartType: 'scatter',
            spec: { kind: 'correlation', xColumn: xCol, yColumn: yCol }
          },
          {
            id: 'card_generic_rank',
            title: `Top 5 Categories in ${catCol}`,
            chartType: 'bar',
            spec: { kind: 'ranking', metricColumn: xCol, categoryColumn: catCol, limit: 5, sort: 'desc' }
          }
        ]
      });
    }

    // Tab 3: Insights
    sheets.push({
      id: 'sheet_generic_insights',
      name: 'Workspace Insights',
      cards: [
        {
          id: 'card_generic_insights_kpi',
          title: 'KPI Indicator',
          chartType: 'kpi',
          spec: { kind: 'groupedAverage', metricColumn: xCol, groupColumn: catCol, aggType: 'avg' }
        }
      ]
    });
  }

  return {
    activeQuestion: `Comprehensive Analytics workspace definition for dataset ${datasetName}`,
    datasetId: datasetName,
    versionHash: profileContract.versionHash || 'default',
    sheets
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. PARALLEL DEBOUNCED ACTIVE-TAB CARD EXECUTOR & COMPILER
// ─────────────────────────────────────────────────────────────────────────────
export const executeWorkspaceActiveTab = async (
  datasetName: string,
  filterContext: any,
  runId: number
): Promise<void> => {
  const store = useWorkspaceStore.getState();
  const cockpit = useCockpitStore.getState();
  const blueprint = store.activeWorkspace;
  const activeSheetId = store.activeSheetId;

  if (!blueprint || !activeSheetId) return;

  const currentSheet = blueprint.sheets.find(s => s.id === activeSheetId);
  if (!currentSheet) return;

  // Safeguard: Verify runId matches current latest run to prevent out-of-order LIFO race conditions
  if (cockpit.currentRunId !== runId) {
    cockpit.logTelemetry('run.superseded', { runId, reason: 'LIFO latch discarded stale workspace query execution' });
    return;
  }

  const tbl = getSqlTableName(datasetName);
  const { where, params } = compileFiltersToSQL(datasetName, filterContext);

  // Parallel loop over all active sheet cards
  await Promise.all(
    currentSheet.cards.map(async (card) => {
      try {
        const compiled = compileCardSpecToSQL(card.spec, tbl, where);
        const rows = executeSQL(compiled.sql, params);
        
        // Map clean rows directly to discriminated visual contracts
        const contract = mapCardRowsToVisualContract(card, rows);
        
        // Deep freeze visual contract payload before store committing to guarantee rendering immutability S1.2
        deepFreeze(contract);
        
        if (cockpit.currentRunId === runId) {
          store.commitCardResult(activeSheetId, card.id, contract);
        }
      } catch (err: any) {
        console.error(`Execution error for card ${card.id}:`, err);
        if (cockpit.currentRunId === runId) {
          store.commitCardError(activeSheetId, card.id, err.message || 'SQL execution failed');
        }
      }
    })
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. SECURE PARAMETERIZED COMPILER (STAGE 2 COMPACT SPECIFICATION ENFORCEMENT)
// ─────────────────────────────────────────────────────────────────────────────
const compileCardSpecToSQL = (spec: CardSpec, tableName: string, whereClause: string): { sql: string } => {
  const where = whereClause ? `WHERE ${whereClause}` : '';
  // AlaSQL uses [bracket] quoting for identifiers, NOT backticks
  const q = (col: string) => `[${col}]`;

  if (spec.kind === 'groupedAverage') {
    return {
      sql: `SELECT ${q(spec.groupColumn)} AS category, ${spec.aggType.toUpperCase()}(${q(spec.metricColumn)}) AS value
            FROM ${q(tableName)}
            ${where}
            GROUP BY ${q(spec.groupColumn)}
            ORDER BY value DESC`
    };
  }

  if (spec.kind === 'correlation') {
    return {
      sql: `SELECT ${q(spec.xColumn)} AS x, ${q(spec.yColumn)} AS y
            FROM ${q(tableName)}
            ${where}`
    };
  }

  if (spec.kind === 'distribution') {
    return {
      sql: `SELECT ${q(spec.metricColumn)} AS binRange, COUNT(*) AS count
            FROM ${q(tableName)}
            ${where}
            GROUP BY ${q(spec.metricColumn)}
            ORDER BY count DESC`
    };
  }

  if (spec.kind === 'ranking') {
    return {
      sql: `SELECT ${q(spec.categoryColumn)} AS category, AVG(${q(spec.metricColumn)}) AS value
            FROM ${q(tableName)}
            ${where}
            GROUP BY ${q(spec.categoryColumn)}
            ORDER BY value ${spec.sort.toUpperCase()}
            LIMIT ${spec.limit}`
    };
  }

  throw new Error(`Unsupported CardSpec kind: ${(spec as any).kind}`);
};


// ─────────────────────────────────────────────────────────────────────────────
// 4. STATISTICAL CALCULATOR & VISUAL CONTRACT ADAPTER (STAGE 4 COMPLIANCE)
// ─────────────────────────────────────────────────────────────────────────────
const mapCardRowsToVisualContract = (card: CardDefinition, rows: any[]): VisualContract => {
  const kind = card.spec.kind;

  if (kind === 'groupedAverage' || kind === 'ranking') {
    const payload = rows.map(r => ({
      category: String(r.category ?? 'Unknown'),
      value: Number(r.value || 0)
    }));
    return {
      kind: 'groupedAverages',
      schemaVersion: 1,
      data: payload,
      xAxisLabel: card.spec.kind === 'groupedAverage' ? card.spec.groupColumn : (card.spec as any).categoryColumn,
      yAxisLabel: card.spec.metricColumn
    };
  }

  if (kind === 'correlation') {
    const payload = rows
      .filter(r => r.x !== null && r.y !== null && !isNaN(Number(r.x)) && !isNaN(Number(r.y)))
      .map(r => ({
        x: Number(r.x),
        y: Number(r.y)
      }));

    // Compute exact Pearson correlation, p-value, and regression slope S6 & S7
    const n = payload.length;
    let rValue = 0;
    let pValue = 1;
    let trendSlope = 0;

    if (n >= 3) {
      const xs = payload.map(p => p.x);
      const ys = payload.map(p => p.y);
      const meanX = xs.reduce((a, b) => a + b, 0) / n;
      const meanY = ys.reduce((a, b) => a + b, 0) / n;

      let num = 0, denX = 0, denY = 0;
      for (let i = 0; i < n; i++) {
        const dx = xs[i] - meanX;
        const dy = ys[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }

      rValue = denX === 0 || denY === 0 ? 0 : num / Math.sqrt(denX * denY);
      trendSlope = denX === 0 ? 0 : num / denX;

      // Compute exact p-value S7.3
      const df = n - 2;
      const t = Math.abs(rValue) * Math.sqrt(df / Math.max(0.0001, 1 - rValue * rValue));
      pValue = tDistPValue(t, df);
    }

    return {
      kind: 'correlationSummary',
      schemaVersion: 1,
      data: payload,
      rValue,
      pValue,
      trendSlope,
      xAxisLabel: card.spec.xColumn,
      yAxisLabel: card.spec.yColumn
    };
  }

  if (kind === 'distribution') {
    const payload = rows.map(r => ({
      binRange: String(r.binRange ?? 'Empty'),
      count: Number(r.count || 0)
    }));
    return {
      kind: 'distributionBins',
      schemaVersion: 1,
      data: payload,
      metricName: card.spec.metricColumn,
      xAxisLabel: card.spec.metricColumn,
      yAxisLabel: 'Record Count'
    };
  }

  return {
    kind: 'tableRows',
    schemaVersion: 1,
    data: rows,
    columns: Object.keys(rows[0] || {})
  };
};

// Lancet exact continued fraction t-distribution S7.3
const tDistPValue = (t: number, df: number): number => {
  if (df <= 0) return 1;
  const x = df / (df + t * t);
  return betaIncomplete(df / 2, 0.5, x);
};

const betaIncomplete = (a: number, b: number, x: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  
  const lbetaVal = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbetaVal) / a;

  const cf = (a2: number, b2: number, x2: number): number => {
    const MAXIT = 100, EPS = 3e-7, FPMIN = 1e-30;
    let qab = a2 + b2, qap = a2 + 1, qam = a2 - 1;
    let c = 1.0, d = 1 - qab * x2 / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      let m2 = 2 * m;
      let aa = m * (b2 - m) * x2 / ((qam + m2) * (a2 + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a2 + m) * (qab + m) * x2 / ((a2 + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
    }
    return h;
  };

  if (x < (a + 1) / (a + b + 2)) return front * cf(a, b, x);
  return 1 - Math.exp(Math.log(1 - x) * b + Math.log(x) * a - lbetaVal) / b * cf(b, a, 1 - x);
};

const lgamma = (z: number): number => {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
             -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = z, x2 = z, tmp = z + 5.5;
  tmp -= (z + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / x2);
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. SECURE STATE IMMUTABILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const deepFreeze = (obj: any): void => {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj);
    Object.keys(obj).forEach(key => {
      deepFreeze(obj[key]);
    });
  }
};
