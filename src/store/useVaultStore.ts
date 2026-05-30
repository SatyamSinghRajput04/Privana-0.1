import { privacyFetch } from '../infrastructure/firewall/privacyFetch';
import { create } from 'zustand';
import type { Page, Workspace } from '../App';
import { localDB } from '../lib/indexedDb';
import { useWorkspaceStore } from './useWorkspaceStore';

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

  login: (mode: 'solo' | 'server', credentials?: any) => Promise<void>;
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

// Self-contained synchronous SHA-256 implementation running securely in any browser context (independent of crypto.subtle availability)
function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const words: number[] = [];
  const asciiLength = ascii.length;
  for (let i = 0; i < asciiLength; i++) {
    words[i >> 2] |= (ascii.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  
  const maxWordIndex = ((asciiLength + 8) >> 6) * 16 + 15;
  words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);
  words[maxWordIndex] = asciiLength * 8;
  
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  
  const w = new Array(64);
  const totalWords = words.length;
  
  for (let index = 0; index < totalWords; index += 16) {
    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];
    
    for (let i = 0; i < 64; i++) {
      if (i < 16) {
        w[i] = words[index + i] || 0;
      } else {
        const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }
  
  return hash.map(h => {
    const hex = (h >>> 0).toString(16);
    return hex.padStart(8, '0');
  }).join('');
}

const safeLocalStorage = {
  getItem(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  removeItem(key: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
};

export const useVaultStore = create<VaultState>((set, get) => {
  // Read initial localStorage values securely
  let initialAuth = { isAuthenticated: false, authMode: null as 'solo' | 'server' | null, serverUrl: '' };
  try {
    const cached = safeLocalStorage.getItem('privana_auth_state');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.isAuthenticated) {
        const savedPassphraseHash = safeLocalStorage.getItem('privana_passphrase_hash');
        
        // If Solo mode with passphrase set, initialize locked (authenticated false) to require unlocking
        if (parsed.authMode === 'solo' && savedPassphraseHash) {
          initialAuth = {
            isAuthenticated: false,
            authMode: 'solo',
            serverUrl: ''
          };
        } else {
          initialAuth = {
            isAuthenticated: true,
            authMode: parsed.authMode,
            serverUrl: parsed.serverUrl || ''
          };
          if (typeof window !== 'undefined') {
            (window as any).__privana_session_id = parsed.sessionId;
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to parse cached auth state:', e);
  }

  return {
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

    ...initialAuth,

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

    login: async (mode, credentials) => {
      let email = '';
      let password = '';
      let passphrase = '';
      let serverUrl = '';

      if (typeof credentials === 'string') {
        serverUrl = credentials;
      } else if (credentials && typeof credentials === 'object') {
        email = credentials.email || '';
        password = credentials.password || '';
        passphrase = credentials.passphrase || '';
        serverUrl = credentials.serverUrl || '';
      }

      if (mode === 'solo') {
        const savedHash = safeLocalStorage.getItem('privana_passphrase_hash');
        if (passphrase) {
          const hashed = sha256Sync(passphrase);
          if (savedHash && savedHash !== hashed) {
            throw new Error('Incorrect Master Key / Passphrase.');
          }
          if (!savedHash) {
            safeLocalStorage.setItem('privana_passphrase_hash', hashed);
          }
        } else {
          if (savedHash) {
            throw new Error('This local profile is locked. Please enter your Master Key.');
          }
        }

        const sessionId = passphrase ? `local_${sha256Sync(passphrase).substring(0, 16)}` : 'local_default_session';
        if (typeof window !== 'undefined') {
          (window as any).__privana_session_id = sessionId;
        }

        safeLocalStorage.setItem('privana_auth_state', JSON.stringify({
          isAuthenticated: true,
          authMode: 'solo',
          serverUrl: '',
          sessionId
        }));

        set({ isAuthenticated: true, authMode: 'solo', serverUrl: '' });
        await get().loadWorkspaces();
      } else {
        if (!email || !password) {
          throw new Error('Email and password are required for Team Server authentication.');
        }

        const combined = `${email.trim().toLowerCase()}:${password}`;
        const sessionId = `server_${sha256Sync(combined).substring(0, 24)}`;

        if (typeof window !== 'undefined') {
          (window as any).__privana_session_id = sessionId;
        }

        safeLocalStorage.setItem('privana_auth_state', JSON.stringify({
          isAuthenticated: true,
          authMode: 'server',
          serverUrl,
          sessionId
        }));

        set({ isAuthenticated: true, authMode: 'server', serverUrl });
        await get().loadWorkspaces();
      }
    },

    logout: () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__privana_session_id;
      }
      safeLocalStorage.removeItem('privana_auth_state');
      useWorkspaceStore.getState().resetWorkspaceStore();
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
        const raw = safeLocalStorage.getItem(metaKey);
        let list = raw ? JSON.parse(raw) : [];
        
        if (list.length === 0) {
          // Auto-seed the Teen Mental Health Insights dataset
          const { generateTeenMentalHealthDatasetCSV, teenMentalHealthColumns } = await import('../lib/datasetSeeder');
          const csvHeader = generateTeenMentalHealthDatasetCSV();
          
          const newDs = {
            id: Date.now(),
            workspace_id: wsId,
            name: 'Teen_Mental_Health_Dataset.csv',
            file_type: 'csv',
            row_count: 1200,
            col_count: 8,
            size_bytes: 45056,
            columns_meta: teenMentalHealthColumns,
            created_at: new Date().toISOString()
          };
          
          list = [newDs];
          safeLocalStorage.setItem(metaKey, JSON.stringify(list));
          await localDB.saveDatasetCSV('Teen_Mental_Health_Dataset.csv', csvHeader);
        }

        set({ datasets: list });
        if (list.length && (!get().selectedDataset || !list.some((x: any) => x.id === get().selectedDataset.id))) {
          set({ selectedDataset: list[0] });
        } else if (list.length === 0) {
          set({ selectedDataset: null });
        }
      } catch (e) {
        console.error('Failed to load/seed local datasets:', e);
      }
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
      safeLocalStorage.setItem(`privana_ds_meta_${ws.id}`, JSON.stringify(updated));
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
      safeLocalStorage.setItem(`privana_ds_meta_${ws.id}`, JSON.stringify(updated));
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
        pinned: false,
        // Pass optional chart meta for display in SavedPage without a join
        ...(bookmarkData.chart_type !== undefined && { chart_type: bookmarkData.chart_type }),
        ...(bookmarkData.execution_ms !== undefined && { execution_ms: bookmarkData.execution_ms }),
        ...(bookmarkData.row_count !== undefined && { row_count: bookmarkData.row_count }),
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
      await localDB.deleteBookmark(id);
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
};
});
