import { privacyFetch } from '../infrastructure/firewall/privacyFetch';
import { create } from 'zustand';
import type { Page, Workspace } from '../App';
import { localDB } from '../lib/indexedDb';

interface EgressStats {
  external: number;
  loopback: number;
  auditSync: number;
}

interface VaultState {
  page: Page;
  workspaces: Workspace[];
  ws: Workspace | null;
  netAlert: boolean;
  datasets: any[];
  selectedDataset: any | null;
  queries: any[];
  saved: any[];
  ollamaStatus: 'online' | 'offline' | 'checking';
  ollamaModels: string[];

  // Egress byte counters — updated reactively by NetworkMonitor / privacyFetch
  egressStats: EgressStats;

  // Auth states
  isAuthenticated: boolean;
  authMode: 'solo' | 'server' | null;
  serverUrl: string;

  setPage: (page: Page) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setWs: (ws: Workspace | null) => void;
  setNetAlert: (netAlert: boolean) => void;
  setSelectedDataset: (dataset: any | null) => void;
  setEgressStats: (stats: Partial<EgressStats>) => void;

  login: (mode: 'solo' | 'server', serverUrl?: string) => Promise<void>;
  logout: () => void;

  loadWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, description: string, mode: string) => Promise<void>;
  loadDatasets: (wsId: number) => Promise<void>;
  registerDataset: (name: string, fileType: string, rowCount: number, colCount: number, sizeBytes: number, columnsMeta?: any[]) => Promise<any>;
  deleteDataset: (id: number, name: string) => Promise<void>;
  loadQueries: (wsId: number) => Promise<void>;
  saveQuery: (queryData: any) => Promise<any>;
  loadSaved: (wsId: number) => Promise<void>;
  saveBookmark: (bookmarkData: any) => Promise<void>;
  deleteBookmark: (id: number) => Promise<void>;
  checkOllama: () => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  page: 'home',
  workspaces: [],
  ws: null,
  netAlert: false,
  datasets: [],
  selectedDataset: null,
  queries: [],
  saved: [],
  ollamaStatus: 'checking',
  ollamaModels: [],

  egressStats: { external: 0, loopback: 0, auditSync: 0 },

  isAuthenticated: false,
  authMode: null,
  serverUrl: '',

  setPage: (page) => set({ page }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setWs: (ws) => {
    set({ ws });
    if (ws) {
      get().loadDatasets(ws.id);
      get().loadQueries(ws.id);
      get().loadSaved(ws.id);
    }
  },
  setNetAlert: (netAlert) => set({ netAlert }),
  setSelectedDataset: (selectedDataset) => set({ selectedDataset }),
  setEgressStats: (stats) => set(s => ({ egressStats: { ...s.egressStats, ...stats } })),

  login: async (mode, serverUrl = '') => {
    set({ isAuthenticated: true, authMode: mode, serverUrl });
    await get().loadWorkspaces();
  },


  logout: () => {
    set({ isAuthenticated: false, authMode: null, ws: null, workspaces: [], datasets: [], selectedDataset: null, queries: [], saved: [] });
  },

  loadWorkspaces: async () => {
    const { authMode } = get();
    
    if (authMode === 'solo') {
      try {
        let list = await localDB.getWorkspaces();
        if (list.length === 0) {
          // Seed initial workspace
          const seed = await localDB.saveWorkspace({
            name: 'Default Local Workspace',
            description: 'My offline private analytical workspace.',
            mode: 'solo',
            owner: 'local@privana.local'
          });
          list = [seed];
        }
        set({ workspaces: list });
        if (list.length && !get().ws) {
          get().setWs(list[0]);
        }
      } catch (e) {
        console.error('Failed to load local workspaces', e);
      }
    } else {
      try {
        const r = await privacyFetch('/api/workspaces');
        const d = await r.json();
        if (Array.isArray(d)) {
          set({ workspaces: d });
          if (d.length && !get().ws) {
            get().setWs(d[0]);
          }
        }
      } catch {}
    }
  },

  createWorkspace: async (name, description, mode) => {
    const { authMode, workspaces } = get();
    if (authMode === 'solo') {
      const newWs = await localDB.saveWorkspace({
        name,
        description,
        mode: 'solo',
        owner: 'local@privana.local'
      });
      set({ workspaces: [...workspaces, newWs] });
      get().setWs(newWs);
    } else {
      const r = await privacyFetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, mode })
      });
      const w = await r.json();
      set({ workspaces: [...workspaces, w] });
      get().setWs(w);
    }
  },

  loadDatasets: async (wsId) => {
    const { authMode } = get();
    if (authMode === 'solo') {
      // For solo mode, retrieve cached datasets metadata from localStorage
      // or filter from a list stored locally.
      try {
        const metaKey = `privana_ds_meta_${wsId}`;
        const raw = localStorage.getItem(metaKey);
        const list = raw ? JSON.parse(raw) : [];
        set({ datasets: list });
        if (list.length && (!get().selectedDataset || !list.some((x: any) => x.id === get().selectedDataset.id))) {
          set({ selectedDataset: list[0] });
        } else if (list.length === 0) {
          set({ selectedDataset: null });
        }
      } catch {}
    } else {
      try {
        const r = await privacyFetch(`/api/datasets?workspace_id=${wsId}`);
        const d = await r.json();
        if (Array.isArray(d)) {
          set({ datasets: d });
          if (d.length && (!get().selectedDataset || !d.some(x => x.id === get().selectedDataset.id))) {
            set({ selectedDataset: d[0] });
          } else if (d.length === 0) {
            set({ selectedDataset: null });
          }
        }
      } catch {}
    }
  },

  registerDataset: async (name, fileType, rowCount, colCount, sizeBytes, columnsMeta) => {
    const { authMode, ws, datasets } = get();
    if (!ws) throw new Error('No active workspace');

    const meta = columnsMeta || [
      { name: 'value', type: 'DECIMAL' },
      { name: 'count', type: 'INTEGER' },
      { name: 'category', type: 'VARCHAR' },
      { name: 'date', type: 'DATE' },
    ];

    if (authMode === 'solo') {
      const newDs = {
        id: Date.now(),
        workspace_id: ws.id,
        name,
        file_type: fileType,
        row_count: rowCount,
        col_count: colCount,
        size_bytes: sizeBytes,
        columns_meta: meta,
        created_at: new Date().toISOString()
      };
      const updated = [...datasets, newDs];
      localStorage.setItem(`privana_ds_meta_${ws.id}`, JSON.stringify(updated));
      set({ datasets: updated, selectedDataset: newDs });
      return newDs;
    } else {
      const r = await privacyFetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: ws.id,
          name,
          file_type: fileType,
          row_count: rowCount,
          col_count: colCount,
          size_bytes: sizeBytes,
          columns_meta: meta
        })
      });
      const d = await r.json();
      set({ datasets: [...datasets, d], selectedDataset: d });
      return d;
    }
  },

  deleteDataset: async (id, name) => {
    const { authMode, ws, datasets, selectedDataset } = get();
    if (!ws) return;

    if (authMode === 'solo') {
      const updated = datasets.filter((x: any) => x.id !== id);
      localStorage.setItem(`privana_ds_meta_${ws.id}`, JSON.stringify(updated));
      await localDB.deleteDatasetCSV(name);
      set({ datasets: updated });
      if (selectedDataset && selectedDataset.id === id) {
        set({ selectedDataset: updated.length ? updated[0] : null });
      }
    } else {
      await privacyFetch('/api/datasets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const updated = datasets.filter((x: any) => x.id !== id);
      set({ datasets: updated });
      if (selectedDataset && selectedDataset.id === id) {
        set({ selectedDataset: updated.length ? updated[0] : null });
      }
    }
  },

  loadQueries: async (wsId) => {
    const { authMode } = get();
    if (authMode === 'solo') {
      const list = await localDB.getQueries(wsId);
      set({ queries: list });
    } else {
      try {
        const r = await privacyFetch(`/api/queries?workspace_id=${wsId}`);
        const d = await r.json();
        if (Array.isArray(d)) {
          set({ queries: d });
        }
      } catch {}
    }
  },

  saveQuery: async (queryData) => {
    const { authMode, queries } = get();
    if (authMode === 'solo') {
      // In local mode, store full details in IndexedDB
      const saved = await localDB.saveQuery({
        workspace_id: queryData.workspace_id,
        dataset_id: queryData.dataset_id,
        question: queryData.question,
        generated_sql: queryData.generated_sql,
        result_data: queryData.result_data,
        chart_type: queryData.chart_type,
        insights: queryData.insights,
        execution_ms: queryData.execution_ms,
        row_count: queryData.row_count
      });
      set({ queries: [saved, ...queries] });
      return saved;
    } else {
      // In server mode, sync query to Supabase.
      // Privacy Protection: Remove result_data rows before saving query to cloud database
      const cloudPayload = {
        ...queryData,
        result_data: [] // Zero records leave client network in server mode
      };
      
      const r = await privacyFetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cloudPayload)
      });
      const d = await r.json();
      set({ queries: [d, ...queries] });
      return d;
    }
  },

  loadSaved: async (wsId) => {
    const { authMode } = get();
    if (authMode === 'solo') {
      const list = await localDB.getBookmarks(wsId);
      set({ saved: list });
    } else {
      try {
        const r = await privacyFetch(`/api/saved?workspace_id=${wsId}`);
        const d = await r.json();
        if (Array.isArray(d)) {
          set({ saved: d });
        }
      } catch {}
    }
  },

  saveBookmark: async (bookmarkData) => {
    const { authMode, saved } = get();
    if (authMode === 'solo') {
      const newB = await localDB.saveBookmark({
        workspace_id: bookmarkData.workspace_id,
        title: bookmarkData.title,
        query_id: bookmarkData.query_id,
        notes: bookmarkData.notes || '',
        pinned: false
      });
      set({ saved: [...saved, newB] });
    } else {
      const r = await privacyFetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookmarkData)
      });
      const d = await r.json();
      set({ saved: [...saved, d] });
    }
  },

  deleteBookmark: async (id) => {
    const { authMode, saved } = get();
    if (authMode === 'solo') {
      // Wait, we don't have deleteBookmark in localDB yet, let's open IndexedDB and delete it directly
      // In a real app we'd expose localDB.deleteBookmark, let's do it directly:
      const db = await indexedDB.open('privana_local_db');
      db.onsuccess = () => {
        const transaction = db.result.transaction('saved', 'readwrite');
        transaction.objectStore('saved').delete(id);
      };
      set({ saved: saved.filter(x => x.id !== id) });
    } else {
      await privacyFetch('/api/saved', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      set({ saved: saved.filter(x => x.id !== id) });
    }
  },

  checkOllama: async () => {
    set({ ollamaStatus: 'checking' });
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1500);
      const r = await privacyFetch('http://localhost:11434/api/tags', { signal: controller.signal });
      clearTimeout(id);
      
      if (r.ok) {
        const data = await r.json();
        const models = Array.isArray(data.models) ? data.models.map((m: any) => m.name) : [];
        set({ ollamaStatus: 'online', ollamaModels: models });
      } else {
        set({ ollamaStatus: 'offline', ollamaModels: [] });
      }
    } catch {
      set({ ollamaStatus: 'offline', ollamaModels: [] });
    }
  }
}));
