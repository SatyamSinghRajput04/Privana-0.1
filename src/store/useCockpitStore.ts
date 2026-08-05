import { create } from 'zustand';
import { PrivacyFirewall } from '../infrastructure/firewall/firewall';
import { VisualContract } from '../domain/analytics/types';

export type { VisualContract };

export interface FilterClause {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between';
  value: any; // Single value, or array for 'in' / 'between'
  isSuspended?: boolean; // Suspended filter badge rule
}

export interface TelemetryEvent {
  timestamp: number;
  event: string;
  fields: Record<string, any>;
}

interface CockpitState {
  // ── Two-Context Separation State ──────────────────────────────────────────
  activeQuestion: string;
  visualKind: VisualContract['kind'] | null;
  compiledQuery: string | null;
  
  // Filter Context (Scope)
  filterContext: FilterClause[];
  
  // Immutably committed VisualData
  committedVisual: VisualContract | null;
  // planId the committedVisual belongs to. Without this, every ResultView on
  // screen rendered the same global contract regardless of its own result.
  committedPlanId: string | null;
  visualError: { runId: number; kind: string; message: string } | null;

  // ── Compute Run Governance ────────────────────────────────────────────────
  currentRunId: number;
  isComputeInFlight: boolean;
  performanceBadge: 'normal' | 'degraded' | null;

  // ── Telemetry & Telemetry Observability ────────────────────────────────────
  cacheHitRate: number;
  totalRuns: number;
  cacheHits: number;
  lastRunDurationMs: number;
  telemetryLogs: TelemetryEvent[];

  // ── Actions ───────────────────────────────────────────────────────────────
  setActiveQuestion: (q: string) => void;
  setVisualKind: (kind: VisualContract['kind'] | null) => void;
  setCompiledQuery: (sql: string | null) => void;
  
  // Filter manipulation
  setFilterContext: (filters: FilterClause[]) => void;
  updateFilterClause: (column: string, patch: Partial<FilterClause>) => void;
  clearFilters: () => void;
  
  // Run life cycle (Stale-Result Discards)
  startNewRun: () => number;
  commitResult: (runId: number, visualData: VisualContract, planId?: string) => void;
  commitError: (runId: number, kind: string, message: string) => void;
  setComputeInFlight: (inFlight: boolean) => void;
  setPerformanceBadge: (badge: 'normal' | 'degraded' | null) => void;

  // Schema Transitions & Clean Slate Rules
  resetCockpit: () => void;
  sanitizeFiltersAgainstSchema: (columns: Array<{ name: string; type: string }>) => void;
  
  // Telemetry Actions
  logTelemetry: (event: string, fields: Record<string, any>) => void;
  resetTelemetryStats: () => void;
}

function redactPII(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return PrivacyFirewall.scan(val).sanitized;
  }
  if (Array.isArray(val)) {
    return val.map(item => redactPII(item));
  }
  if (typeof val === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      res[key] = redactPII(val[key]);
    }
    return res;
  }
  return val;
}

export const useCockpitStore = create<CockpitState>((set, get) => ({
  activeQuestion: '',
  visualKind: null,
  compiledQuery: null,
  filterContext: [],
  committedVisual: null,
  committedPlanId: null,
  visualError: null,

  currentRunId: 0,
  isComputeInFlight: false,
  performanceBadge: null,

  cacheHitRate: 0,
  totalRuns: 0,
  cacheHits: 0,
  lastRunDurationMs: 0,
  telemetryLogs: [],

  setActiveQuestion: (activeQuestion) => set({ activeQuestion }),
  setVisualKind: (setVisualKind) => set({ visualKind: setVisualKind }),
  setCompiledQuery: (compiledQuery) => set({ compiledQuery }),

  setFilterContext: (filterContext) => set({ filterContext }),
  
  updateFilterClause: (column, patch) => {
    const updated = get().filterContext.map(f => 
      f.column === column ? { ...f, ...patch } : f
    );
    set({ filterContext: updated });
  },

  clearFilters: () => set({ filterContext: [] }),

  startNewRun: () => {
    const nextRunId = get().currentRunId + 1;
    set({ currentRunId: nextRunId, isComputeInFlight: true, visualError: null });
    return nextRunId;
  },

  commitResult: (runId, visualData, planId) => {
    const { currentRunId } = get();
    // Latest-Wins Ordering §1.3
    if (runId === currentRunId) {
      // Immutability of Committed State §1.5
      const rawData = (visualData as any).data;
      const frozenVisual = Object.freeze({
        ...visualData,
        data: Array.isArray(rawData) ? Object.freeze(rawData.map((d: any) => Object.freeze({ ...d }))) : rawData
      });
      set({ 
        committedVisual: frozenVisual as any, 
        committedPlanId: planId ?? null,
        isComputeInFlight: false, 
        visualError: null 
      });
    } else {
      // Discard stale superseded results silently
      get().logTelemetry('run.superseded', { runId, currentRunId, reason: 'LIFO out-of-order execution' });
    }
  },

  commitError: (runId, kind, message) => {
    const { currentRunId } = get();
    if (runId === currentRunId) {
      set({ 
        committedVisual: null, 
        committedPlanId: null,
        visualError: { runId, kind, message }, 
        isComputeInFlight: false 
      });
    }
  },

  setComputeInFlight: (isComputeInFlight) => set({ isComputeInFlight }),
  setPerformanceBadge: (performanceBadge) => set({ performanceBadge }),

  resetCockpit: () => set({
    activeQuestion: '',
    visualKind: null,
    compiledQuery: null,
    filterContext: [],
    committedVisual: null,
    committedPlanId: null,
    visualError: null,
    currentRunId: 0,
    isComputeInFlight: false,
    performanceBadge: null
  }),

  sanitizeFiltersAgainstSchema: (columns) => {
    const validColNames = new Set(columns.map(c => c.name));
    const currentFilters = get().filterContext;
    
    // Lens vs Scope Separations suspended column badges §1.1
    const sanitized = currentFilters.map(f => {
      const exists = validColNames.has(f.column);
      if (!exists) {
        // Flag filter as suspended rather than silently wiping it
        return { ...f, isSuspended: true };
      }
      return { ...f, isSuspended: false };
    });

    // Defense-in-depth sanitization: completely drop suspended filters ONLY if 
    // there's a hard schema incompatibility reload pass that renders it unsalvageable
    set({ filterContext: sanitized });
  },

  logTelemetry: (event, fields) => {
    // Content-based PII regex redaction inside the telemetry store itself §2.2 & §5
    const redactedFields = redactPII(fields);

    const log: TelemetryEvent = {
      timestamp: Date.now(),
      event,
      fields: Object.freeze(redactedFields)
    };
    
    // Maintain stats
    const stats: Partial<CockpitState> = {};
    if (event === 'run.committed') {
      const hits = get().cacheHits + (fields.cacheHit ? 1 : 0);
      const runs = get().totalRuns + 1;
      stats.cacheHits = hits;
      stats.totalRuns = runs;
      stats.cacheHitRate = runs > 0 ? Math.round((hits / runs) * 100) : 0;
      stats.lastRunDurationMs = fields.durationMs || 0;
    }

    set(s => ({
      ...stats,
      telemetryLogs: [log, ...s.telemetryLogs].slice(0, 100) // cap logs array length
    }));
  },

  resetTelemetryStats: () => set({
    cacheHitRate: 0,
    totalRuns: 0,
    cacheHits: 0,
    lastRunDurationMs: 0,
    telemetryLogs: []
  })
}));

