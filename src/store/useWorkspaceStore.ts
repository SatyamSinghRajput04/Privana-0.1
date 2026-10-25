// ─────────────────────────────────────────────────────────────────────────────
// src/store/useWorkspaceStore.ts
// S12 WORKSPACE STORE — Decoupled Zustand store slice for dynamic worksheets.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { WorkspaceBlueprint, VisualContract, SheetSpec, CardDefinition, CardSpec } from '../domain/analytics/types';
import { mapToVisualContract } from '../domain/analytics/resultToVisualContext';
import { expandToBlueprint } from '../lib/expandToBlueprint';

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTUAL CARD — Q&A answer injected into a static sheet (Level 2 Feature)
// ─────────────────────────────────────────────────────────────────────────────
export interface ContextualCard {
  sheetId: string;           // target static sheet ID
  cardId: string;            // always 'card_contextual_qa'
  question: string;          // original user question (shown in badge)
  visualContract: VisualContract; // pre-computed chart data
  intent: string;            // e.g. 'distribution', 'grouped_average'
  chartType: 'bar' | 'line' | 'scatter' | 'kpi' | 'table';
}

interface WorkspaceStore {
  workspacePipelineEnabled: boolean;
  activeWorkspace: WorkspaceBlueprint | null;
  activeSheetId: string | null;
  workspaceResults: Record<string, Record<string, VisualContract>>;
  workspaceErrors: Record<string, Record<string, string>>;
  isWorkspaceInFlight: boolean;

  // Level 2: Contextual Q&A card injected into static sheets
  contextualCard: ContextualCard | null;
  setContextualCard: (card: ContextualCard | null) => void;
  clearContextualCard: () => void;

  setWorkspacePipelineEnabled: (enabled: boolean) => void;
  setWorkspaceBlueprint: (blueprint: WorkspaceBlueprint | null) => void;
  setActiveSheetId: (sheetId: string | null) => void;
  commitCardResult: (sheetId: string, cardId: string, result: VisualContract) => void;
  commitSheetResults: (sheetId: string, resultsMap: Record<string, VisualContract>) => void;
  commitCardError: (sheetId: string, cardId: string, error: string) => void;
  setWorkspaceInFlight: (inFlight: boolean) => void;
  
  // Workspace Analytical Snapshots (Spec v2.2 Production-Hardened)
  addAnalyticalSnapshot: (queryText: string, result: any) => void;
  commitAnalyticalSnapshotError: (queryText: string, errorMessage: string) => void;
  removeAnalyticalSnapshot: (snapshotId: string) => void;
  clearAnalyticalSnapshots: () => void;
  
  bypassedDatasets: Record<string, boolean>;
  bypassDataset: (datasetId: string) => void;
  resetWorkspaceStore: () => void;
  clearWorkspaceResults: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  workspacePipelineEnabled: true,
  activeWorkspace: null,
  activeSheetId: null,
  workspaceResults: {},
  workspaceErrors: {},
  isWorkspaceInFlight: false,
  bypassedDatasets: {},
  contextualCard: null,

  setContextualCard: (card) => set({ contextualCard: card }),
  clearContextualCard: () => set({ contextualCard: null }),

  bypassDataset: (datasetId) => set((state) => ({
    bypassedDatasets: { ...state.bypassedDatasets, [datasetId]: true }
  })),

  setWorkspacePipelineEnabled: (enabled) => set({ workspacePipelineEnabled: enabled }),
  
  setWorkspaceBlueprint: (blueprint) => set((state) => {
    const defaultSheetId = blueprint && blueprint.sheets.length > 0 ? blueprint.sheets[0].id : null;
    return {
      activeWorkspace: blueprint,
      activeSheetId: defaultSheetId,
      workspaceResults: {},
      workspaceErrors: {},
      contextualCard: null, // clear Q&A injection on new dataset
    };
  }),

  setActiveSheetId: (sheetId) => set({ activeSheetId: sheetId }),

  commitCardResult: (sheetId, cardId, result) => set((state) => {
    const nextResults = { ...state.workspaceResults };
    if (!nextResults[sheetId]) nextResults[sheetId] = {};
    const resultWithTime = { ...result, lastComputedAt: Date.now() };
    nextResults[sheetId] = {
      ...nextResults[sheetId],
      [cardId]: resultWithTime
    };
    
    // Clear any previous error on success
    const nextErrors = { ...state.workspaceErrors };
    if (nextErrors[sheetId]) {
      const copy = { ...nextErrors[sheetId] };
      delete copy[cardId];
      nextErrors[sheetId] = copy;
    }

    return {
      workspaceResults: nextResults,
      workspaceErrors: nextErrors
    };
  }),

  commitSheetResults: (sheetId, resultsMap) => set((state) => {
    const nextResults = { ...state.workspaceResults };
    const currentSheetResults = { ...(nextResults[sheetId] || {}) };
    const now = Date.now();
    for (const [cardId, result] of Object.entries(resultsMap)) {
      currentSheetResults[cardId] = { ...result, lastComputedAt: now };
    }
    nextResults[sheetId] = currentSheetResults;

    const nextErrors = { ...state.workspaceErrors };
    if (nextErrors[sheetId]) {
      const copy = { ...nextErrors[sheetId] };
      for (const cardId of Object.keys(resultsMap)) {
        delete copy[cardId];
      }
      nextErrors[sheetId] = copy;
    }

    return {
      workspaceResults: nextResults,
      workspaceErrors: nextErrors
    };
  }),

  commitCardError: (sheetId, cardId, error) => set((state) => {
    const nextErrors = { ...state.workspaceErrors };
    if (!nextErrors[sheetId]) nextErrors[sheetId] = {};
    nextErrors[sheetId] = {
      ...nextErrors[sheetId],
      [cardId]: error
    };

    return {
      workspaceErrors: nextErrors
    };
  }),

  setWorkspaceInFlight: (inFlight) => set({ isWorkspaceInFlight: inFlight }),

  addAnalyticalSnapshot: (queryText: string, result: any) => set((state) => {
    if (!state.activeWorkspace) return {};

    const cleanQuery = queryText.length > 25 ? queryText.slice(0, 25) + '...' : queryText;

    // Use expandToBlueprint for computed and partial states
    if (result.status === 'computed' || result.status === 'partial') {
      const contract = mapToVisualContract(result);
      const blueprint = expandToBlueprint(result, contract);
      const sheet = blueprint.sheets[0];
      const sheetId = sheet.id;

      let sheets = [...state.activeWorkspace.sheets];
      const nextResults = { ...state.workspaceResults };
      const nextErrors = { ...state.workspaceErrors };

      // FIFO queue protection
      sheets = sheets.filter(s => s.id !== sheetId);
      const qaSheets = sheets.filter(s => s.id.startsWith('snapshot_'));
      if (qaSheets.length >= 5) {
        const oldest = qaSheets[0];
        sheets = sheets.filter(s => s.id !== oldest.id);
        delete nextResults[oldest.id];
        delete nextErrors[oldest.id];
      }

      const insightsIndex = sheets.findIndex(s => s.id.toLowerCase().includes('insights'));
      if (insightsIndex !== -1) {
        sheets.splice(insightsIndex, 0, sheet);
      } else {
        sheets.push(sheet);
      }

      // Map the results for all cards on the dynamic sheet
      const cardResults: Record<string, VisualContract> = {};
      sheet.cards.forEach(card => {
        if (card.id === 'card_qa_chart') {
          cardResults[card.id] = { ...contract, lastComputedAt: Date.now() };
        } else if (card.id === 'card_qa_narrative') {
          cardResults[card.id] = {
            kind: 'tableRows',
            schemaVersion: 1,
            data: [],
            columns: [],
            notes: result.narrative || '',
            lastComputedAt: Date.now()
          };
        } else {
          // KPI cards
          cardResults[card.id] = {
            kind: 'tableRows',
            schemaVersion: 1,
            data: [],
            columns: [],
            notes: card.title,
            lastComputedAt: Date.now()
          };
        }
      });

      nextResults[sheetId] = cardResults;

      const nextErrorsClean = { ...nextErrors };
      delete nextErrorsClean[sheetId];

      return {
        activeWorkspace: {
          ...state.activeWorkspace,
          sheets
        },
        activeSheetId: sheetId,
        workspaceResults: nextResults,
        workspaceErrors: nextErrorsClean
      };
    }

    // Temporal Session Keying & Fallbacks for non-computed states
    const sheetId = `snapshot_${Date.now()}`;
    let narrativeText = result.narrative || '';
    let chartTitle = result.chart?.title || 'Query Visualization';
    let chartType = result.chart?.chartType || 'bar';
    let chartSpec = planToCardSpec(result.plan);

    if (result.status === 'blocked') {
      narrativeText = `### 🚨 Query Blocked\n\n${result.reason || 'The query was blocked by local safety guards.'}`;
      chartTitle = 'Blocked by Safety Guard';
      chartType = 'kpi';
    } else if (result.status === 'unsupported') {
      narrativeText = `### ⚠️ Unsupported Query\n\n${result.explanation || 'This query format is not supported.'}`;
      if (result.suggestedQuestions && result.suggestedQuestions.length > 0) {
        narrativeText += `\n\n**Try asking one of these questions instead:**\n` + result.suggestedQuestions.map((q: string) => `* "${q}"`).join('\n');
      }
      chartTitle = 'Unsupported Operation';
      chartType = 'kpi';
    } else if (result.status === 'refused') {
      narrativeText = `### ❌ Query Refused\n\n${result.message || 'The query was refused due to invalid schema reference.'}`;
      if (result.suggestions && result.suggestions.length > 0) {
        narrativeText += `\n\n**Similar fields available in this dataset:**\n` + result.suggestions.map((s: string) => `* \`${s}\``).join('\n');
      }
      chartTitle = 'Refused - Invalid Column';
      chartType = 'kpi';
    } else if (result.status === 'clarify') {
      narrativeText = `### 🤔 Clarification Required\n\n${result.clarification?.message || 'Please select a path below:'}\n\n`;
      if (result.clarification?.choices) {
        narrativeText += result.clarification.choices.map((c: any, ci: number) => `* **Option ${ci + 1}:** ${c.label}\n  *Query:* \`${c.question}\``).join('\n');
      }
      chartTitle = 'Clarification Required';
      chartType = 'kpi';
    } else if (result.status === 'error') {
      narrativeText = `### 💥 System Error\n\n${result.message || 'An unexpected error occurred.'}`;
      chartTitle = 'Pipeline Execution Error';
      chartType = 'kpi';
    }

    let mappedChartType: 'bar' | 'line' | 'scatter' | 'table' | 'kpi' = 'bar';
    if (chartType === 'line') mappedChartType = 'line';
    else if (chartType === 'scatter') mappedChartType = 'scatter';
    else if (chartType === 'table') mappedChartType = 'table';
    else if (chartType === 'kpi') mappedChartType = 'kpi';
    else if (chartType === 'none') {
      const contract = mapToVisualContract(result);
      if (contract.kind === 'tableRows') {
        mappedChartType = 'table';
      } else {
        mappedChartType = 'kpi';
      }
    }

    const newSheet: SheetSpec = {
      id: sheetId,
      name: `🔍 ${cleanQuery}`,
      cards: [
        {
          id: 'card_qa_chart',
          title: chartTitle,
          chartType: mappedChartType,
          spec: chartSpec
        },
        {
          id: 'card_qa_narrative',
          title: 'AI Interpretation',
          chartType: 'kpi' as const,
          spec: { kind: 'groupedAverage' as const, metricColumn: '', groupColumn: '', aggType: 'avg' as const }
        }
      ]
    };

    let sheets = [...state.activeWorkspace.sheets];
    const nextResults = { ...state.workspaceResults };
    const nextErrors = { ...state.workspaceErrors };

    // FIFO queue protection inside store just in case
    sheets = sheets.filter(s => s.id !== sheetId);
    const qaSheets = sheets.filter(s => s.id.startsWith('snapshot_'));
    if (qaSheets.length >= 5) {
      const oldest = qaSheets[0];
      sheets = sheets.filter(s => s.id !== oldest.id);
      delete nextResults[oldest.id];
      delete nextErrors[oldest.id];
    }

    const insightsIndex = sheets.findIndex(s => s.id.toLowerCase().includes('insights'));
    if (insightsIndex !== -1) {
      sheets.splice(insightsIndex, 0, newSheet);
    } else {
      sheets.push(newSheet);
    }

    const updatedWorkspace = {
      ...state.activeWorkspace,
      sheets
    };

    const contract = mapToVisualContract(result);
    const visualContract = { ...contract, lastComputedAt: Date.now() };

    const narrativeContract = {
      kind: 'tableRows' as const,
      schemaVersion: 1 as const,
      data: [],
      columns: [],
      notes: narrativeText,
      lastComputedAt: Date.now()
    };

    nextResults[sheetId] = {
      card_qa_chart: visualContract,
      card_qa_narrative: narrativeContract
    };

    const nextErrorsClean = { ...nextErrors };
    delete nextErrorsClean[sheetId];

    return {
      activeWorkspace: updatedWorkspace,
      activeSheetId: sheetId,
      workspaceResults: nextResults,
      workspaceErrors: nextErrorsClean
    };
  }),

  commitAnalyticalSnapshotError: (queryText: string, errorMessage: string) => set((state) => {
    if (!state.activeWorkspace) return {};
    const sheetId = `snapshot_${Date.now()}`;
    const cleanQuery = queryText.length > 25 ? queryText.slice(0, 25) + '...' : queryText;
    
    const newSheet: SheetSpec = {
      id: sheetId,
      name: `🔍 ${cleanQuery}`,
      cards: [
        {
          id: 'card_qa_chart',
          title: 'Query Error',
          chartType: 'kpi' as const,
          spec: { kind: 'distribution' as const, metricColumn: '', binCount: 5 }
        }
      ]
    };

    let sheets = [...state.activeWorkspace.sheets].filter(s => s.id !== sheetId);
    const nextErrors = { ...state.workspaceErrors };

    // FIFO fallback queue protection
    const qaSheets = sheets.filter(s => s.id.startsWith('snapshot_'));
    if (qaSheets.length >= 5) {
      const oldest = qaSheets[0];
      sheets = sheets.filter(s => s.id !== oldest.id);
      delete nextErrors[oldest.id];
    }

    const insightsIndex = sheets.findIndex(s => s.id.toLowerCase().includes('insights'));
    if (insightsIndex !== -1) {
      sheets.splice(insightsIndex, 0, newSheet);
    } else {
      sheets.push(newSheet);
    }

    const updatedWorkspace = {
      ...state.activeWorkspace,
      sheets
    };

    const nextErrorsClean = { ...nextErrors };
    if (!nextErrorsClean[sheetId]) nextErrorsClean[sheetId] = {};
    nextErrorsClean[sheetId] = {
      card_qa_chart: errorMessage
    };

    return {
      activeWorkspace: updatedWorkspace,
      activeSheetId: sheetId,
      workspaceErrors: nextErrorsClean
    };
  }),

  removeAnalyticalSnapshot: (snapshotId: string) => set((state) => {
    if (!state.activeWorkspace) return {};
    
    const sheets = state.activeWorkspace.sheets.filter(s => s.id !== snapshotId);
    
    let nextActiveSheetId = state.activeSheetId;
    if (state.activeSheetId === snapshotId) {
      nextActiveSheetId = sheets.length > 0 ? sheets[0].id : null;
    }
    
    const nextResults = { ...state.workspaceResults };
    delete nextResults[snapshotId];
    
    const nextErrors = { ...state.workspaceErrors };
    delete nextErrors[snapshotId];
    
    return {
      activeWorkspace: {
        ...state.activeWorkspace,
        sheets
      },
      activeSheetId: nextActiveSheetId,
      workspaceResults: nextResults,
      workspaceErrors: nextErrors
    };
  }),

  clearAnalyticalSnapshots: () => set((state) => {
    if (!state.activeWorkspace) return {};

    const sheets = state.activeWorkspace.sheets.filter(s => !s.id.startsWith('snapshot_'));

    let nextActiveSheetId = state.activeSheetId;
    if (state.activeSheetId && state.activeSheetId.startsWith('snapshot_')) {
      nextActiveSheetId = sheets.length > 0 ? sheets[0].id : null;
    }

    const nextResults = { ...state.workspaceResults };
    const nextErrors = { ...state.workspaceErrors };

    Object.keys(nextResults).forEach(key => {
      if (key.startsWith('snapshot_')) delete nextResults[key];
    });
    Object.keys(nextErrors).forEach(key => {
      if (key.startsWith('snapshot_')) delete nextErrors[key];
    });

    return {
      activeWorkspace: {
        ...state.activeWorkspace,
        sheets
      },
      activeSheetId: nextActiveSheetId,
      workspaceResults: nextResults,
      workspaceErrors: nextErrors
    };
  }),

  resetWorkspaceStore: () => set({
    activeWorkspace: null,
    activeSheetId: null,
    workspaceResults: {},
    workspaceErrors: {},
    isWorkspaceInFlight: false,
    bypassedDatasets: {},
    contextualCard: null,
  }),

  clearWorkspaceResults: () => set({
    workspaceResults: {},
    workspaceErrors: {}
  })
}));

const planToCardSpec = (plan: any): CardSpec => {
  if (!plan) return { kind: 'distribution', metricColumn: '', binCount: 5 };
  if (plan.intent === 'grouped_average') {
    return {
      kind: 'groupedAverage' as const,
      metricColumn: plan.metric,
      groupColumn: plan.groupBy?.[0] || '',
      aggType: 'avg' as const
    };
  }
  if (plan.intent === 'correlation') {
    return {
      kind: 'correlation' as const,
      xColumn: plan.metric,
      yColumn: plan.target
    };
  }
  if (plan.intent === 'distribution') {
    return {
      kind: 'distribution' as const,
      metricColumn: plan.metric,
      binCount: 5
    };
  }
  if (plan.intent === 'ranking') {
    return {
      kind: 'ranking' as const,
      metricColumn: plan.metric,
      categoryColumn: plan.groupBy?.[0] || '',
      limit: plan.limit || 5,
      sort: 'desc' as const
    };
  }
  return {
    kind: 'distribution' as const,
    metricColumn: plan.metric || '',
    binCount: 5
  };
};
