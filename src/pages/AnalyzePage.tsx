import { setLocalAiKillSwitch } from '../infrastructure/firewall/privacyFetch';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, RefreshCw, Star, MessageSquare, Menu, RotateCcw, 
  RotateCw, Save, ChevronDown, Check, Layers, Filter
} from 'lucide-react';
import type { Page } from '../App';
import { useVaultStore } from '../store/useVaultStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useCockpitStore } from '../store/useCockpitStore';
import { useAnswerWorkspaceStore } from '../store/useAnswerWorkspaceStore';
import { isTableLoaded, loadCSV, loadJSON, setTableOwner, getTableOwner, getTableRowCount, getTableRows, getSqlTableName, ensureTableHydrated, HydrationResult } from '../lib/sqlEngine';
import { localDB } from '../lib/indexedDb';
import { DatasetValidator } from '../domain/validator/validator';
import { SchemaIntelligence } from '../domain/analytics/schemaIntelligence';
import { runAnalyticsQuestion } from '../domain/analytics/runAnalyticsQuestion';
import { CompoundQuestionPlanner } from '../domain/analytics/compoundQuestionPlanner';
import { matchResultToSheet } from '../lib/matchResultToSheet';
import { planWorkspace, executeWorkspaceActiveTab } from '../domain/analytics/workspaceQueryEngine';
import { EvalLogger } from '../domain/analytics/evalLogger';
import { AnalyticsResult } from '../domain/analytics/types';

// Extracted Feature Components
import QueryInputBar from '../components/analytics/QueryInputBar';
import ActiveCockpitFilters, { FilterClause } from '../components/analytics/ActiveCockpitFilters';
import AnalyticsCanvas from '../components/analytics/AnalyticsCanvas';
import CopilotChatDrawer, { ChatMessage } from '../components/analytics/CopilotChatDrawer';
import DatasetProfilePanel from '../components/analytics/DatasetProfilePanel';
import WorkspaceTabs from '../components/analytics/WorkspaceTabs';

interface AnalyzePageProps {
  setPage: (p: Page) => void;
  page?: string;
  onMenu?: () => void;
}

export default function AnalyzePage({ page, onMenu }: AnalyzePageProps) {
  // Store Selectors
  const { ws, selectedDataset, saveBookmark, saveQuery } = useVaultStore();
  const workspacePipelineEnabled = useWorkspaceStore(s => s.workspacePipelineEnabled);
  const setWorkspacePipelineEnabled = useWorkspaceStore(s => s.setWorkspacePipelineEnabled);
  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace);
  const activeSheetId = useWorkspaceStore(s => s.activeSheetId);
  const setActiveSheetId = useWorkspaceStore(s => s.setActiveSheetId);
  const setWorkspaceBlueprint = useWorkspaceStore(s => s.setWorkspaceBlueprint);
  const setWorkspaceInFlight = useWorkspaceStore(s => s.setWorkspaceInFlight);
  const bypassedDatasets = useWorkspaceStore(s => s.bypassedDatasets);
  const bypassDataset = useWorkspaceStore(s => s.bypassDataset);

  // Local State
  const [qaInput, setQaInput] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [qaResponse, setQaResponse] = useState<AnalyticsResult | string | null>(null);
  const [bottomTab, setBottomTab] = useState<string>('Overview');
  const [activeRightTab, setActiveRightTab] = useState<'fields' | 'filters'>('fields');
  const [fieldsSearch, setFieldsSearch] = useState('');
  const [pageViewMode, setPageViewMode] = useState<'Fit to Width' | 'Actual Size' | 'Page Fit'>('Fit to Width');
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [showPredefinedReports, setShowPredefinedReports] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingTable, setLoadingTable] = useState<string | null>(null);

  // Filters State & Undo/Redo Queue
  const [activeFilters, setActiveFilters] = useState<Record<string, FilterClause>>({});
  const [filterHistory, setFilterHistory] = useState<Record<string, FilterClause>[]>([]);
  const [filterHistoryIndex, setFilterHistoryIndex] = useState(-1);
  const isNavigatingRef = useRef(false);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  const handleDirectReupload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDataset) return;
    try {
      setLoadingTable(selectedDataset.name);
      await localDB.saveDatasetBlob(selectedDataset.name, file, selectedDataset.id);
      const res = await ensureTableHydrated(selectedDataset);
      if (res.ok) {
        showToast(`"${selectedDataset.name}" re-hydrated with ${res.rowCount.toLocaleString()} rows!`);
        if (qaInput) {
          runAnalyticsQuestionAsync(qaInput);
        } else {
          setQaResponse(null);
        }
      } else {
        showToast(`Failed to hydrate: ${res.details || res.error}`);
      }
    } catch (err: any) {
      showToast(`Upload error: ${err.message || err}`);
    } finally {
      setLoadingTable(null);
      if (e.target) e.target.value = '';
    }
  };

  // Copilot Drawer State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [localAiKillSwitchActive, setLocalAiKillSwitchActive] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: "👋 **Welcome to Privana AI Copilot!**\n\nI operate 100% locally with zero egress. Ask any analytical question or explore relationships in your dataset.",
      timestamp: new Date()
    }
  ]);

  // Monotonic execution epoch guard against out-of-order async responses
  const executionEpochRef = useRef(0);
  const isDev = typeof process !== 'undefined' ? process.env?.NODE_ENV !== 'production' : ((import.meta as any).env?.DEV ?? true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Ensure workspace pipeline is always enabled on mount
  useEffect(() => {
    setWorkspacePipelineEnabled(true);
  }, [setWorkspacePipelineEnabled]);

  // Reset analytical state on dataset switch
  useEffect(() => {
    setQaInput('');
    setQaResponse(null);
    setShowPredefinedReports(false);
    setActiveFilters({});
    setFilterHistory([]);
    setFilterHistoryIndex(-1);
    if (!selectedDataset) {
      useWorkspaceStore.getState().resetWorkspaceStore();
    } else {
      useWorkspaceStore.getState().clearAnalyticalSnapshots();
    }
  }, [selectedDataset?.name]);

  // Auto-load raw dataset into DuckDB-WASM engine with deterministic handshake & fallback
  const ensureTableLoaded = async (ds: any): Promise<HydrationResult> => {
    if (!ds || !ds.name) {
      return { ok: false, state: 'failed', error: 'FILE_NOT_FOUND_IN_STORAGE', details: 'No dataset selected' };
    }
    const tableName = ds.name;
    setLoadingTable(tableName);

    try {
      // 1. Primary path: Deterministic full-dataset DuckDB-WASM hydration
      const hydration = await ensureTableHydrated(ds);
      if (hydration.ok) {
        return hydration;
      }

      // If stale preview detected, reject immediately (Fail-Closed guarantee)
      if (hydration.error === 'STALE_PREVIEW_DETECTED') {
        return hydration;
      }

      // 2. Secondary fallback for JSON or non-DuckDB small in-memory files
      let text = await localDB.getDatasetCSV(tableName);
      if (!text) {
        text = await localDB.getDatasetCSV(getSqlTableName(tableName));
      }
      if (text) {
        if (tableName.toLowerCase().endsWith('.json')) {
          loadJSON(tableName, text);
        } else {
          await loadCSV(tableName, text);
        }
        setTableOwner(tableName, String(ds.id));
        return {
          ok: true,
          datasetId: String(ds.id),
          tableName: getSqlTableName(tableName),
          rowCount: getTableRowCount(tableName),
          state: 'ready'
        };
      }

      return hydration;
    } catch (err: any) {
      console.error('Error during dataset hydration:', err);
      return {
        ok: false,
        state: 'failed',
        error: 'TABLE_RESTORATION_FAILED',
        details: err?.message || String(err)
      };
    } finally {
      setLoadingTable(null);
    }
  };

  // Pre-load table and blueprint when selected dataset changes
  useEffect(() => {
    if (page !== 'analyze' || !selectedDataset) return;
    ensureTableLoaded(selectedDataset).then(res => {
      if (res.ok && workspacePipelineEnabled && (!activeWorkspace || activeWorkspace.datasetId !== selectedDataset.name)) {
        const schema = selectedDataset.columns_meta || [];
        const blueprint = planWorkspace(selectedDataset.name, schema);
        setWorkspaceBlueprint(blueprint);
      } else if (!res.ok && res.error === 'STALE_PREVIEW_DETECTED') {
        showToast(`"${selectedDataset.name}" has legacy preview. Re-upload for full analytics.`);
      }
    });
  }, [selectedDataset?.name, page, workspacePipelineEnabled]);

  // ─────────────────────────────────────────────────────────────────────────
  // UNIFIED ASYNCHRONOUS EXECUTION SEAM (runAnalyticsQuestionAsync)
  // Single entry point for QueryInputBar, Preset Chips, Copilot, & Sub-charts
  // ─────────────────────────────────────────────────────────────────────────
  const runAnalyticsQuestionAsync = async (rawQuestion: string, bypassMetadata = false) => {
    const inputToUse = rawQuestion.trim();
    if (!inputToUse || !selectedDataset) {
      if (!selectedDataset) setQaResponse('Please select a dataset to analyze.');
      return;
    }

    const epoch = ++executionEpochRef.current;
    setQaLoading(true);
    setLoadingStage(0);
    const runId = useCockpitStore.getState().startNewRun();

    try {
      setTimeout(() => { if (epoch === executionEpochRef.current) setLoadingStage(1); }, 200);
      setTimeout(() => { if (epoch === executionEpochRef.current) setLoadingStage(2); }, 450);
      setTimeout(() => { if (epoch === executionEpochRef.current) setLoadingStage(3); }, 650);

      const hydration = await ensureTableLoaded(selectedDataset);
      if (!hydration.ok) {
        if (hydration.error === 'STALE_PREVIEW_DETECTED') {
          setQaResponse(`⚠️ Legacy Preview Detected\n\n"${selectedDataset.name}" was stored as an older 10-row preview in your browser.\n\nPlease go to the Datasets tab and re-upload "${selectedDataset.name}" to enable 100% full-population DuckDB analytics.`);
          return;
        }
        throw new Error(hydration.details || `Raw data for "${selectedDataset.name}" could not be loaded.`);
      }

      const tableName = selectedDataset.name;
      await new Promise(r => setTimeout(r, 0)); // yield frame for UI paint

      const rows = getTableRows(tableName);
      const totalRowCount = getTableRowCount(tableName);
      const profile = DatasetValidator.profile(rows, tableName);

      const context = {
        tableName,
        rows,
        profile,
        totalRowCount,
        bypassMetadataCheck: bypassMetadata || !!bypassedDatasets[selectedDataset.id],
        runId
      };

      const decomposition = CompoundQuestionPlanner.decompose(inputToUse, profile);
      const subQuestions = decomposition.subQuestions;
      let questionId: string | null = null;

      for (let i = 0; i < subQuestions.length; i++) {
        const subQuestion = subQuestions[i];
        const subResult = await runAnalyticsQuestion(subQuestion, context);

        try {
          await EvalLogger.log(subQuestion, subResult);
        } catch {}

        if (epoch !== executionEpochRef.current) return;

        if (i === 0) {
          setQaResponse(subResult);
          useWorkspaceStore.getState().addAnalyticalSnapshot(inputToUse, subResult);

          if (ws && subResult.status !== 'error') {
            const resultRows: any[] = (subResult as any).data?.rows ?? (subResult as any).rows ?? [];
            const intentRaw = (subResult as any).plan?.intent ?? '';
            const chartObj = (subResult as any).chart;
            const chartType = chartObj?.chartType ?? (intentRaw === 'correlation' ? 'scatter' : intentRaw === 'filter' ? 'table' : 'bar');

            saveQuery({
              workspace_id: ws.id,
              dataset_id: selectedDataset.id,
              question: inputToUse,
              generated_sql: (subResult as any).provenance?.sql ?? '',
              result_data: resultRows.slice(0, 500),
              chart_type: chartType,
              x_axis_key: chartObj?.xAxisKey ?? '',
              y_axis_key: chartObj?.yAxisKey ?? '',
              chart_title: chartObj?.title ?? '',
              insights: (subResult as any).insights ?? [],
              execution_ms: (subResult as any).provenance?.executionTimeMs ?? 0,
              row_count: resultRows.length,
            }).catch(() => {});
          }

          if ((subResult.status === 'computed' || subResult.status === 'partial') && activeWorkspace) {
            try {
              const targetSheetId = matchResultToSheet(subResult, activeWorkspace);
              questionId = useAnswerWorkspaceStore.getState().startNewQuestion(
                inputToUse,
                targetSheetId,
                decomposition.matchedPattern
              );
              useAnswerWorkspaceStore.getState().addEntry(questionId, subResult.plan.planId, subQuestion, subResult);
              setActiveSheetId(targetSheetId);
            } catch (err) {
              console.warn('[AnswerWorkspace] Failed to match sheet:', err);
            }
          }
        } else if (questionId) {
          if (subResult.status === 'computed' || subResult.status === 'partial') {
            useAnswerWorkspaceStore.getState().addEntry(questionId, subResult.plan.planId, subQuestion, subResult);
          }
        }
      }
    } catch (err: any) {
      if (epoch === executionEpochRef.current) {
        setQaResponse({
          status: 'error',
          debugId: `err_${Date.now()}`,
          message: err.message || 'An error occurred during query execution.',
          provenance: { question: inputToUse, planGeneratedAt: new Date(), executionTimeMs: 0, plannerAttempts: 1 }
        });
      }
    } finally {
      if (epoch === executionEpochRef.current) {
        setQaLoading(false);
      }
    }
  };

  // Handle pending chart additions from Answer Workspace view
  const pendingChartRequest = useAnswerWorkspaceStore(s => s.pendingChartRequest);
  useEffect(() => {
    if (!pendingChartRequest) return;
    runAnalyticsQuestionAsync(pendingChartRequest).finally(() => {
      useAnswerWorkspaceStore.getState().clearPendingChartRequest();
    });
  }, [pendingChartRequest]);

  // Synchronize copilot chat narrative with latest analytical result
  useEffect(() => {
    if (qaResponse && typeof qaResponse === 'object') {
      const narrative = (qaResponse as any).narrative || (qaResponse as any).message || 'Analysis complete.';
      const sql = (qaResponse as any).provenance?.sql;
      const executionTimeMs = (qaResponse as any).provenance?.executionTimeMs;
      const intent = (qaResponse as any).plan?.intent;

      setChatMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'ai' && last.text === narrative) return prev;
        return [
          ...prev,
          {
            sender: 'ai',
            text: narrative,
            timestamp: new Date(),
            provenance: { sql, executionTimeMs, intent }
          }
        ];
      });
    }
  }, [qaResponse]);

  // Filter change handlers & history queue
  const handleFilterChange = (col: string, clause: FilterClause | null) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      if (!clause) delete next[col];
      else next[col] = clause;
      return next;
    });
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
    showToast('Reset all slicers');
  };

  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }
    setFilterHistory(prev => [...prev.slice(0, filterHistoryIndex + 1), { ...activeFilters }]);
    setFilterHistoryIndex(prev => prev + 1);
  }, [activeFilters]);

  const handleUndo = () => {
    if (filterHistoryIndex > 0) {
      isNavigatingRef.current = true;
      const prevIdx = filterHistoryIndex - 1;
      setFilterHistoryIndex(prevIdx);
      setActiveFilters(filterHistory[prevIdx]);
      showToast('Undo slicer adjustment');
    }
  };

  const handleRedo = () => {
    if (filterHistoryIndex < filterHistory.length - 1) {
      isNavigatingRef.current = true;
      const nextIdx = filterHistoryIndex + 1;
      setFilterHistoryIndex(nextIdx);
      setActiveFilters(filterHistory[nextIdx]);
      showToast('Redo slicer adjustment');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setActiveFilters({});
    setQaInput('');
    setQaResponse(null);
    setShowPredefinedReports(false);
    useWorkspaceStore.getState().clearAnalyticalSnapshots();
    showToast('Resetting dashboard to defaults...');
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Dashboard reloaded with local data');
    }, 500);
  };

  const handleSaveReport = async () => {
    if (!ws || !selectedDataset) return;
    setSaveStatus('saving');
    try {
      const title = selectedDataset.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ") + ' Insights';
      await saveBookmark({
        workspace_id: ws.id,
        title,
        notes: `Report created automatically from dataset ${selectedDataset.name} using Privana Universal Tabular UI.`
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e: any) {
      showToast(`Failed to save report: ${e.message || e}`);
      setSaveStatus('idle');
    }
  };

  // Re-execute workspace tab when filters change
  useEffect(() => {
    if (page !== 'analyze' || !workspacePipelineEnabled || !selectedDataset || !activeWorkspace || !activeSheetId) return;
    const clauses = Object.values(activeFilters);
    const runId = useCockpitStore.getState().startNewRun();
    setWorkspaceInFlight(true);
    executeWorkspaceActiveTab(selectedDataset.name, clauses, runId).finally(() => {
      setWorkspaceInFlight(false);
    });
  }, [selectedDataset?.name, activeFilters, activeSheetId, workspacePipelineEnabled, activeWorkspace?.datasetId, page]);

  // Derived suggested queries from schema intelligence
  const suggestedQueries = useMemo(() => {
    if (!selectedDataset) return [];
    const meta = selectedDataset.columns_meta || [];
    if (!meta.length) return [];
    try {
      const profile = {
        datasetHash: selectedDataset.name,
        rowCount: selectedDataset.row_count || 1000,
        columnCount: meta.length,
        shape: 'tabular' as const,
        columns: meta.map((c: any) => ({
          name: c.name,
          type: (c.type === 'number' || ['DECIMAL', 'INTEGER', 'BIGINT', 'FLOAT'].includes(c.type?.toUpperCase())) ? 'numeric' : c.type === 'date' ? 'date' : 'category',
          nullable: false,
          role: 'metric',
          nullCount: 0
        })),
        qualityMetrics: { missingValuesPct: 0, duplicatesCount: 0, criticalIssuesCount: 0, criticalIssues: [] },
        piiFlags: [],
        profiledAt: '',
        profilerVersion: '1.0.0'
      };
      const questions = SchemaIntelligence.suggestQuestions(profile as any);
      return questions.map((q: string, idx: number) => ({
        title: `Suggested Query ${idx + 1}`,
        query: q
      }));
    } catch {
      return [];
    }
  }, [selectedDataset]);

  // Derived enriched column metadata with min, max, and distinct distributions for cockpit slicers
  const filterColumns = useMemo(() => {
    if (!selectedDataset) return [];
    const meta = selectedDataset.columns_meta || [];
    if (!meta.length) return [];
    
    let sampleRows: any[] = [];
    try {
      if (isTableLoaded(selectedDataset.name)) {
        sampleRows = getTableRows(selectedDataset.name);
      }
    } catch {}

    return meta.map((col: any) => {
      const colName = col.name;
      const typeStr = (col.type || '').toUpperCase();
      const isNum = col.type === 'number' || ['INTEGER', 'DECIMAL', 'BIGINT', 'FLOAT'].includes(typeStr);
      const isDate = col.type === 'date' || col.type === 'timestamp';
      
      let min: number | undefined;
      let max: number | undefined;
      let distribution: { value: string; count: number }[] | undefined;
      let uniqueValues: any[] | undefined;

      if (sampleRows.length > 0) {
        if (isNum) {
          let numMin = Infinity;
          let numMax = -Infinity;
          for (const r of sampleRows) {
            const v = r[colName];
            if (v !== null && v !== undefined && v !== '') {
              const n = Number(v);
              if (!isNaN(n)) {
                if (n < numMin) numMin = n;
                if (n > numMax) numMax = n;
              }
            }
          }
          if (numMin !== Infinity) min = numMin;
          if (numMax !== -Infinity) max = numMax;
        } else if (!isDate) {
          const counts: Record<string, number> = {};
          for (const r of sampleRows) {
            const v = r[colName];
            if (v !== null && v !== undefined && v !== '') {
              const s = String(v);
              counts[s] = (counts[s] || 0) + 1;
            }
          }
          const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([value, count]) => ({ value, count }));
          distribution = sorted;
          uniqueValues = sorted.map(d => d.value);
        }
      }

      return {
        name: colName,
        type: col.type,
        role: col.role,
        min,
        max,
        distribution,
        uniqueValues
      };
    });
  }, [selectedDataset, loadingTable]);

  // Canvas style based on page view mode
  const canvasStyle: React.CSSProperties = useMemo(() => {
    switch (pageViewMode) {
      case 'Actual Size':
        return { width: '1280px', minWidth: '1280px', margin: '0 auto', padding: '1rem', background: '#070709' };
      case 'Page Fit':
        return { width: '96%', maxWidth: '1360px', margin: '0 auto', transform: 'scale(0.98)', transformOrigin: 'top center', padding: '0.85rem' };
      case 'Fit to Width':
      default:
        return { width: '100%', padding: '0.85rem' };
    }
  }, [pageViewMode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#07070a', color: '#e4e4e7', fontFamily: "'Geist', sans-serif" }}>
      {/* 1. TOP BREADCRUMB BAR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid #1a1a24',
        background: '#09090b',
        height: '46px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button onClick={onMenu} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Toggle sidebar">
            <Menu size={16} />
          </button>
          <div style={{ width: 1, height: 14, background: '#27272a' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', color: '#a1a1aa' }}>
            <span style={{ fontWeight: 700, color: '#f4f4f5' }}>Privana</span>
            <span style={{ color: '#3f3f46' }}>/</span>
            <span>{selectedDataset ? selectedDataset.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ") : 'Analytics'}</span>
            <span style={{ color: '#3f3f46' }}>/</span>
            <span style={{ color: '#f4f4f5', fontWeight: 600 }}>Report</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#110b0d', border: '1px solid #3c1417', borderRadius: '999px', padding: '2px 9px', fontSize: '0.58rem', fontFamily: 'var(--mono)', color: '#e4e4e7' }}>
            <Database size={10} style={{ color: '#ef4444' }} /> Local DB
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#110b0d', border: '1px solid #3c1417', borderRadius: '999px', padding: '2px 9px', fontSize: '0.58rem', fontFamily: 'var(--mono)', color: '#e4e4e7' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} /> 0 bytes sent
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#110b0d', border: '1px solid #3c1417', borderRadius: '999px', padding: '2px 9px', fontSize: '0.58rem', fontFamily: 'var(--mono)', color: '#e4e4e7' }}>
            <span style={{ color: '#ef4444', fontSize: '0.65rem' }}>⚡</span> DuckDB Engine
          </div>
        </div>
      </div>

      {/* 2. REPORT TITLE BLOCK */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1rem', borderBottom: '1px solid #1a1a24', background: '#09090b', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.02em', margin: 0 }}>
              {selectedDataset ? selectedDataset.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ") + ' Insights' : 'Workspace Insights'}
            </h1>
            <Star size={13} style={{ fill: '#ef4444', color: '#ef4444', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '0.66rem', color: '#71717a', marginTop: 2 }}>
            {selectedDataset ? `${selectedDataset.row_count || '1,000+'} records • ${selectedDataset.columns_meta?.length || 0} fields` : 'Local analytical workspace'}
          </div>
        </div>

        {/* Ribbon Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button onClick={handleUndo} disabled={filterHistoryIndex <= 0} style={{ background: 'none', border: 'none', color: filterHistoryIndex > 0 ? '#e4e4e7' : '#3f3f46', cursor: filterHistoryIndex > 0 ? 'pointer' : 'default', padding: '4px' }} title="Undo slicer change">
            <RotateCcw size={14} />
          </button>
          <button onClick={handleRedo} disabled={filterHistoryIndex >= filterHistory.length - 1} style={{ background: 'none', border: 'none', color: filterHistoryIndex < filterHistory.length - 1 ? '#e4e4e7' : '#3f3f46', cursor: filterHistoryIndex < filterHistory.length - 1 ? 'pointer' : 'default', padding: '4px' }} title="Redo slicer change">
            <RotateCw size={14} />
          </button>
          <button onClick={handleRefresh} style={{ background: 'none', border: 'none', color: '#e4e4e7', cursor: 'pointer', padding: '4px' }} title="Reload dashboard">
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* Page View Dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowViewDropdown(prev => !prev)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#121215', border: '1px solid #27272a', borderRadius: '4px', padding: '3px 8px', fontSize: '0.62rem', color: '#e4e4e7', cursor: 'pointer' }}>
              <span>{pageViewMode}</span>
              <ChevronDown size={10} />
            </button>
            {showViewDropdown && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#121215', border: '1px solid #27272a', borderRadius: '6px', zIndex: 100, minWidth: 110, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                {(['Fit to Width', 'Page Fit', 'Actual Size'] as const).map(mode => (
                  <button key={mode} onClick={() => { setPageViewMode(mode); setShowViewDropdown(false); }} style={{ width: '100%', textAlign: 'left', padding: '5px 10px', fontSize: '0.62rem', background: pageViewMode === mode ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: pageViewMode === mode ? '#ef4444' : '#e4e4e7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{mode}</span>
                    {pageViewMode === mode && <Check size={10} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSaveReport} disabled={saveStatus !== 'idle'} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ef4444', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.62rem', fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
            <Save size={11} />
            <span>{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Report'}</span>
          </button>
        </div>
      </div>

      {/* 3. MAIN DASHBOARD CONTENT AREA */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* LEFT AREA: Query Bar + Analytics Canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem 0.25rem 1rem', flexShrink: 0 }}>
            <QueryInputBar
              qaInput={qaInput}
              setQaInput={setQaInput}
              qaLoading={qaLoading}
              loadingStage={loadingStage}
              onSearch={(q) => runAnalyticsQuestionAsync(q)}
              onReset={() => { setQaInput(''); setQaResponse(null); }}
              hasResult={qaResponse !== null}
              suggestedQueries={suggestedQueries}
            />
          </div>

          <AnalyticsCanvas
            qaResponse={qaResponse}
            activeWorkspace={activeWorkspace}
            activeSheetId={activeSheetId}
            selectedDataset={selectedDataset}
            isDev={isDev}
            showPredefinedReports={showPredefinedReports}
            onTogglePredefinedReports={() => setShowPredefinedReports(prev => !prev)}
            onSelectPrompt={(p) => { setQaInput(p); runAnalyticsQuestionAsync(p); }}
            onCrossFilter={(col, val) => handleFilterChange(col, { column: col, operator: 'eq', value: val })}
            onBypassDataset={bypassDataset}
            bypassedDatasets={bypassedDatasets}
            localAiKillSwitchActive={localAiKillSwitchActive}
            onToggleKillSwitch={() => setLocalAiKillSwitchActive(prev => { const n = !prev; setLocalAiKillSwitch(n); return n; })}
            onReupload={() => reuploadInputRef.current?.click()}
            canvasStyle={canvasStyle}
          />
          <input
            type="file"
            ref={reuploadInputRef}
            onChange={handleDirectReupload}
            accept=".csv,.parquet,.json"
            style={{ display: 'none' }}
          />

          {/* DOCKED FOOTER: Workspace Tabs */}
          <div style={{ padding: '0.4rem 1rem', borderTop: '1px solid #1a1a24', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <WorkspaceTabs
              workspacePipelineEnabled={workspacePipelineEnabled}
              activeWorkspace={activeWorkspace}
              activeSheetId={activeSheetId}
              setActiveSheetId={setActiveSheetId}
              setQaResponse={setQaResponse}
              setAnalyticalContext={() => {}}
              bottomTab={bottomTab}
              setBottomTab={setBottomTab}
              onRemoveSnapshot={(id) => useWorkspaceStore.getState().removeAnalyticalSnapshot(id)}
            />
            <div style={{ fontSize: '0.58rem', color: '#71717a', fontFamily: 'var(--mono)' }}>
              Privana v1.0 • Universal Tabular Engine
            </div>
          </div>
        </div>

        {/* RIGHT AREA: WORKSPACE SIDEBAR (240px wide) */}
        <div style={{ width: '240px', borderLeft: '1px solid #1a1a24', background: '#09090b', display: 'flex', flexDirection: 'column', minHeight: 0, flexShrink: 0 }}>
          {/* Segmented Switcher Header */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1a1a24', background: '#0b0b0e', flexShrink: 0 }}>
            <button onClick={() => setActiveRightTab('fields')} style={{ flex: 1, padding: '7px 0', fontSize: '0.65rem', fontWeight: 700, color: activeRightTab === 'fields' ? '#ef4444' : '#71717a', background: 'transparent', border: 'none', borderBottom: activeRightTab === 'fields' ? '2px solid #ef4444' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Layers size={11} /> Fields
            </button>
            <button onClick={() => setActiveRightTab('filters')} style={{ flex: 1, padding: '7px 0', fontSize: '0.65rem', fontWeight: 700, color: activeRightTab === 'filters' ? '#ef4444' : '#71717a', background: 'transparent', border: 'none', borderBottom: activeRightTab === 'filters' ? '2px solid #ef4444' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Filter size={11} /> Slicers {Object.keys(activeFilters).length > 0 && `(${Object.keys(activeFilters).length})`}
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {activeRightTab === 'fields' ? (
              <DatasetProfilePanel
                selectedDataset={selectedDataset}
                columnsList={selectedDataset?.columns_meta || []}
                fieldsSearch={fieldsSearch}
                setFieldsSearch={setFieldsSearch}
              />
            ) : (
              <ActiveCockpitFilters
                columns={filterColumns}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
                onClearAllFilters={handleClearAllFilters}
              />
            )}
          </div>
        </div>
      </div>

      {/* Floating AI Copilot Trigger Button */}
      {!isChatOpen && (
        <motion.button
          onClick={() => setIsChatOpen(true)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            position: 'fixed',
            bottom: '2.5rem',
            right: '255px',
            background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
            border: '1.5px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '999px',
            padding: '7px 14px',
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.45)',
            zIndex: 900
          }}
        >
          <MessageSquare size={13} />
          <span>Ask Copilot</span>
        </motion.button>
      )}

      {/* Slide-over Copilot Chat Drawer */}
      <CopilotChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        loading={qaLoading}
        onSendMessage={(msg) => runAnalyticsQuestionAsync(msg)}
        onResetChat={() => {
          setChatMessages([{
            sender: 'ai',
            text: "👋 Chat reset. Ask me anything about the active dataset.",
            timestamp: new Date()
          }]);
        }}
        suggestedQueries={suggestedQueries.map(s => s.query)}
        localAiKillSwitchActive={localAiKillSwitchActive}
        onToggleKillSwitch={() => setLocalAiKillSwitchActive(prev => { const n = !prev; setLocalAiKillSwitch(n); return n; })}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#18181b',
          border: '1px solid #27272a',
          color: '#f4f4f5',
          fontSize: '0.72rem',
          padding: '6px 14px',
          borderRadius: '6px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
          zIndex: 2000
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
