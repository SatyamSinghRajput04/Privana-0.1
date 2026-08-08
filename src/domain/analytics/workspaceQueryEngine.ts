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
// Local helper to format underscores to spaces and capitalize fields
const formatFieldName = (name: string): string => {
  if (!name) return '';
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export const planWorkspace = (datasetName: string, columns: any[]): WorkspaceBlueprint => {
  const profileContract = SCHEMA_PROFILES[datasetName] || { versionHash: 'default' };

  const isFreeTextOrIdCol = (name: string): boolean => {
    const n = name.toLowerCase();
    if (n === 'id' || n.endsWith('_id') || n.endsWith('id') || n.endsWith('_uuid') || n.endsWith('_hash') || n.endsWith('_key')) return true;
    if (n.includes('comment') || n.includes('message') || n.includes('description') || n.includes('text') || n.includes('title') || n.includes('body') || n.includes('note') || n.includes('date') || n.includes('time')) return true;
    return false;
  };

  const rawNumericCols = columns.filter(c => c.type === 'numeric' || c.type === 'number');
  const numericCols = rawNumericCols.filter(c => !isFreeTextOrIdCol(c.name));
  const activeNumericCols = numericCols.length > 0 ? numericCols : (rawNumericCols.length > 0 ? rawNumericCols : columns);

  const rawCategoryCols = columns.filter(c => c.type === 'text' || c.type === 'string' || c.type === 'category' || c.type === 'boolean');
  const categoryCols = rawCategoryCols.filter(c => !isFreeTextOrIdCol(c.name));
  
  // Safe category selection: NEVER select a high-cardinality ID/UUID column for grouping
  const validCategory = categoryCols[0]?.name;
  const validNumeric = activeNumericCols[0]?.name;

  const sheets: SheetSpec[] = [];

  // Tab 1: Overview Dashboard
  const overviewCards: CardDefinition[] = [];

  if (validCategory) {
    // Card 1: Distribution of categorical column
    overviewCards.push({
      id: 'card_overview_dist_1',
      title: `${formatFieldName(validCategory)} Distribution`,
      chartType: 'donut',
      spec: { kind: 'distribution', metricColumn: validCategory, binCount: 10 }
    });

    if (validNumeric) {
      // Card 2: Grouped Average (numeric by category)
      overviewCards.push({
        id: 'card_overview_grouped_1',
        title: `Average ${formatFieldName(validNumeric)} by ${formatFieldName(validCategory)}`,
        chartType: 'bar',
        spec: { kind: 'groupedAverage', metricColumn: validNumeric, groupColumn: validCategory, aggType: 'avg' }
      });

      // Card 3: Ranking (Top 5 categories by average numeric)
      overviewCards.push({
        id: 'card_overview_ranking_1',
        title: `Top Categories in ${formatFieldName(validCategory)} by ${formatFieldName(validNumeric)}`,
        chartType: 'bar',
        spec: { kind: 'ranking', metricColumn: validNumeric, categoryColumn: validCategory, limit: 5, sort: 'desc' }
      });
    }
  } else {
    // Dataset lacks low-cardinality category columns (e.g. ID/timestamp heavy tables)
    // Fall back to sample table preview to avoid high-cardinality GROUP BY freezes
    const previewCols = columns.slice(0, 5).map(c => c.name);
    overviewCards.push({
      id: 'card_overview_table_preview',
      title: `${formatFieldName(datasetName)} Records Preview`,
      chartType: 'table',
      spec: {
        kind: 'segmentSummary',
        segmentColumn: columns[0]?.name || 'id',
        metricColumns: previewCols
      }
    });
  }

  // Card 4: Segment Summary Report (if we have at least one categorical and one numeric column)
  if (categoryCols.length >= 1 && activeNumericCols.length >= 1) {
    const segmentCol = categoryCols[0].name;
    const metricCols = activeNumericCols.slice(0, 2).map(c => c.name);
    overviewCards.push({
      id: 'card_overview_segment_summary',
      title: `${formatFieldName(segmentCol)} Summary Report`,
      chartType: 'table',
      spec: {
        kind: 'segmentSummary',
        segmentColumn: segmentCol,
        metricColumns: metricCols
      }
    });
  }

  sheets.push({
    id: 'sheet_overview',
    name: 'Overview Dashboard',
    cards: overviewCards
  });

  // Tab 2: Relationships (if we have at least 2 numeric columns)
  if (numericCols.length >= 2) {
    const relationshipCards: CardDefinition[] = [];
    
    // Pairwise correlation between numeric 1 and 2
    relationshipCards.push({
      id: 'card_rel_corr_1',
      title: `${formatFieldName(numericCols[0].name)} vs ${formatFieldName(numericCols[1].name)} Correlation`,
      chartType: 'scatter',
      spec: { kind: 'correlation', xColumn: numericCols[0].name, yColumn: numericCols[1].name }
    });

    // If a third numeric column exists, correlation between 1 and 3
    if (numericCols.length >= 3) {
      relationshipCards.push({
        id: 'card_rel_corr_2',
        title: `${formatFieldName(numericCols[0].name)} vs ${formatFieldName(numericCols[2].name)} Correlation`,
        chartType: 'scatter',
        spec: { kind: 'correlation', xColumn: numericCols[0].name, yColumn: numericCols[2].name }
      });
    } else {
      // Otherwise, distribution of second category or ranking
      const secondCat = categoryCols[1]?.name || categoryCols[0]?.name || columns[0]?.name || 'category';
      relationshipCards.push({
        id: 'card_rel_dist_2',
        title: `${formatFieldName(secondCat)} Distribution`,
        chartType: 'bar',
        spec: { kind: 'distribution', metricColumn: secondCat, binCount: 10 }
      });
    }

    sheets.push({
      id: 'sheet_relationships',
      name: 'Relationships',
      cards: relationshipCards
    });
  }

  // Tab 3: Breakdowns (if both numeric and category exist)
  if (numericCols.length >= 1 && categoryCols.length >= 1) {
    const breakdownCards: CardDefinition[] = [];
    
    // Breakdown 1: numeric[0] by category[0]
    breakdownCards.push({
      id: 'card_breakdown_1',
      title: `${formatFieldName(numericCols[0].name)} by ${formatFieldName(categoryCols[0].name)}`,
      chartType: 'bar',
      spec: { kind: 'groupedAverage', metricColumn: numericCols[0].name, groupColumn: categoryCols[0].name, aggType: 'avg' }
    });

    // Breakdown 2: numeric[0] by category[1] (if exists) or numeric[1] by category[0]
    if (categoryCols.length >= 2) {
      breakdownCards.push({
        id: 'card_breakdown_2',
        title: `${formatFieldName(numericCols[0].name)} by ${formatFieldName(categoryCols[1].name)}`,
        chartType: 'bar',
        spec: { kind: 'groupedAverage', metricColumn: numericCols[0].name, groupColumn: categoryCols[1].name, aggType: 'avg' }
      });
    } else if (numericCols.length >= 2) {
      breakdownCards.push({
        id: 'card_breakdown_2',
        title: `${formatFieldName(numericCols[1].name)} by ${formatFieldName(categoryCols[0].name)}`,
        chartType: 'bar',
        spec: { kind: 'groupedAverage', metricColumn: numericCols[1].name, groupColumn: categoryCols[0].name, aggType: 'avg' }
      });
    }

    sheets.push({
      id: 'sheet_breakdowns',
      name: 'Breakdowns',
      cards: breakdownCards
    });
  }

  // Tab 4: AI Insights
  sheets.push({
    id: 'sheet_insights',
    name: 'AI Insights',
    cards: [
      {
        id: 'card_insights_narrative',
        title: 'Executive Analytics Briefing',
        chartType: 'table',
        spec: {
          type: 'narrative',
          text: `Automated analytical briefing prepared for workspace dataset **${datasetName}**.\n\n* **Columns Analyzed:** Total ${columns.length} schema fields (${numericCols.length} numeric, ${categoryCols.length} categorical).\n* **Primary Driver:** Dynamic exploration canvas ready. Navigate tabs above to inspect localized visual contracts.`,
          provenance: { question: 'Executive Analytics Briefing', planGeneratedAt: new Date(), executionTimeMs: 2, plannerAttempts: 1 }
        }
      }
    ]
  });

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
      const spec = card.spec;
      const isQueryable = spec && ('kind' in spec) && ['groupedAverage', 'correlation', 'distribution', 'ranking', 'segmentSummary'].includes(spec.kind);
      if (!isQueryable) {
        return; // Skip static narrative, table, and kpi cards
      }
      try {
        const compiled = compileCardSpecToSQL(spec, tbl, where);
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
  const where = whereClause ? (whereClause.trim().toUpperCase().startsWith('WHERE') ? whereClause : `WHERE ${whereClause}`) : '';
  // AlaSQL uses [bracket] quoting for identifiers, NOT backticks
  const q = (col: string) => `[${col}]`;

  if (spec && 'kind' in spec) {
    if (spec.kind === 'groupedAverage') {
      return {
        sql: `SELECT ${q(spec.groupColumn)} AS [category], ${spec.aggType.toUpperCase()}(${q(spec.metricColumn)}) AS [value]
              FROM ${q(tableName)}
              ${where}
              GROUP BY ${q(spec.groupColumn)}
              ORDER BY [value] DESC
              LIMIT 25`
      };
    }

    if (spec.kind === 'correlation') {
      return {
        sql: `SELECT ${q(spec.xColumn)} AS [x], ${q(spec.yColumn)} AS [y]
              FROM ${q(tableName)}
              ${where}
              LIMIT 500`
      };
    }

    if (spec.kind === 'distribution') {
      return {
        sql: `SELECT ${q(spec.metricColumn)} AS [binRange], COUNT(*) AS [count]
              FROM ${q(tableName)}
              ${where}
              GROUP BY ${q(spec.metricColumn)}
              ORDER BY [count] DESC
              LIMIT 15`
      };
    }

    if (spec.kind === 'ranking') {
      return {
        sql: `SELECT ${q(spec.categoryColumn)} AS [category], AVG(${q(spec.metricColumn)}) AS [value]
              FROM ${q(tableName)}
              ${where}
              GROUP BY ${q(spec.categoryColumn)}
              ORDER BY [value] ${spec.sort.toUpperCase()}
              LIMIT ${spec.limit}`
      };
    }

    if (spec.kind === 'segmentSummary') {
      const selectFields = [
        q(spec.segmentColumn),
        ...spec.metricColumns.map(col => `AVG(${q(col)}) AS [avg_${col}]`),
        `COUNT(*) AS [count]`
      ];
      return {
        sql: `SELECT ${selectFields.join(', ')}
              FROM ${q(tableName)}
              ${where}
              GROUP BY ${q(spec.segmentColumn)}`
      };
    }
  }

  throw new Error(`Unsupported CardSpec kind: ${(spec as any).kind || (spec as any).type}`);
};


// ─────────────────────────────────────────────────────────────────────────────
// 4. STATISTICAL CALCULATOR & VISUAL CONTRACT ADAPTER (STAGE 4 COMPLIANCE)
// ─────────────────────────────────────────────────────────────────────────────
const mapCardRowsToVisualContract = (card: CardDefinition, rows: any[]): VisualContract => {
  const spec = card.spec;
  if (!spec || !('kind' in spec)) {
    return {
      kind: 'tableRows',
      schemaVersion: 1,
      data: rows,
      columns: Object.keys(rows[0] || {})
    };
  }

  if (spec.kind === 'groupedAverage') {
    const payload = rows.map(r => ({
      category: String(r.category ?? 'Unknown'),
      value: Number(r.value || 0)
    }));
    return {
      kind: 'groupedAverages',
      schemaVersion: 1,
      data: payload,
      xAxisLabel: spec.groupColumn,
      yAxisLabel: spec.metricColumn
    };
  }

  if (spec.kind === 'segmentSummary') {
    const payload = rows.map(r => {
      const item: any = {};
      item[spec.segmentColumn] = String(r[spec.segmentColumn] ?? 'Unknown');
      spec.metricColumns.forEach((col: string) => {
        item[`avg_${col}`] = Number(r[`avg_${col}`] || 0);
      });
      item.count = Number(r.count || 0);
      return item;
    });

    if (payload.length > 0) {
      const totals: any = {};
      totals[spec.segmentColumn] = 'Total';
      let totalCount = 0;
      payload.forEach(p => {
        totalCount += p.count;
      });
      totals.count = totalCount;

      spec.metricColumns.forEach((col: string) => {
        let weightedSum = 0;
        payload.forEach(p => {
          weightedSum += p[`avg_${col}`] * p.count;
        });
        totals[`avg_${col}`] = totalCount > 0 ? parseFloat((weightedSum / totalCount).toFixed(2)) : 0;
      });
      payload.push(totals);
    }

    return {
      kind: 'tableRows',
      schemaVersion: 1,
      data: payload,
      columns: [spec.segmentColumn, ...spec.metricColumns.map((col: string) => `avg_${col}`), 'count']
    };
  }

  if (spec.kind === 'ranking') {
    const payload = rows.map(r => ({
      category: String(r.category ?? 'Unknown'),
      value: Number(r.value || 0)
    }));
    return {
      kind: 'groupedAverages',
      schemaVersion: 1,
      data: payload,
      xAxisLabel: spec.categoryColumn,
      yAxisLabel: spec.metricColumn
    };
  }

  if (spec.kind === 'correlation') {
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
      xAxisLabel: spec.xColumn,
      yAxisLabel: spec.yColumn
    };
  }

  if (spec.kind === 'distribution') {
    const payload = rows.map(r => ({
      binRange: String(r.binRange ?? 'Empty'),
      count: Number(r.count || 0)
    }));

    const getOrdinalRank = (val: string): number => {
      const v = val.trim().toLowerCase();
      const scales: Record<string, number> = {
        'normal': 1,
        'minimal': 2,
        'low': 3,
        'mild': 4,
        'moderate': 5,
        'high': 6,
        'severe': 7,
        'extreme': 8,
        'poor': 10,
        'fair': 11,
        'good': 12,
        'excellent': 13,
        'male': 20,
        'female': 21,
        'other': 22,
        'unknown': 23
      };
      return scales[v] ?? 999;
    };

    const hasOrdinal = payload.some(p => getOrdinalRank(p.binRange) !== 999);
    if (hasOrdinal) {
      payload.sort((a, b) => {
        const rankA = getOrdinalRank(a.binRange);
        const rankB = getOrdinalRank(b.binRange);
        if (rankA !== rankB) return rankA - rankB;
        return a.binRange.localeCompare(b.binRange);
      });
    }

    return {
      kind: 'distributionBins',
      schemaVersion: 1,
      data: payload,
      metricName: spec.metricColumn,
      xAxisLabel: spec.metricColumn,
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
