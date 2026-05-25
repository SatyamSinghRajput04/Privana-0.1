/**
 * Privana local-first IndexedDB Database Utility
 * Handles binary and large text caching (e.g., raw CSV files) in-browser.
 * Prevents the 5MB browser localStorage overflow error.
 */

const DB_NAME = 'privana_local_db';
const DB_VERSION = 1;

export interface CachedDataset {
  name: string;
  csvContent: string;
  updatedAt: number;
}

export interface LocalWorkspace {
  id: number;
  name: string;
  description: string;
  mode: string;
  owner: string;
  created_at: string;
}

export interface LocalQuery {
  id: number;
  workspace_id: number;
  dataset_id: number | null;
  question: string;
  generated_sql: string;
  result_data: any[];
  chart_type: string;
  insights: string[];
  execution_ms: number;
  row_count: number;
  created_at: string;
}

export interface LocalSaved {
  id: number;
  workspace_id: number;
  title: string;
  query_id: number;
  notes: string;
  pinned: boolean;
  created_at: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Store raw CSV dataset files
      if (!db.objectStoreNames.contains('datasets')) {
        db.createObjectStore('datasets', { keyPath: 'name' });
      }
      
      // Offline workspaces
      if (!db.objectStoreNames.contains('workspaces')) {
        db.createObjectStore('workspaces', { keyPath: 'id', autoIncrement: true });
      }

      // Offline query logs
      if (!db.objectStoreNames.contains('queries')) {
        const queryStore = db.createObjectStore('queries', { keyPath: 'id', autoIncrement: true });
        queryStore.createIndex('workspace_id', 'workspace_id', { unique: false });
      }

      // Offline bookmarks (Saved)
      if (!db.objectStoreNames.contains('saved')) {
        const savedStore = db.createObjectStore('saved', { keyPath: 'id', autoIncrement: true });
        savedStore.createIndex('workspace_id', 'workspace_id', { unique: false });
      }
    };
  });
}

export const localDB = {
  // --- Datasets Storage (CSV Caching) ---
  async saveDatasetCSV(name: string, csvContent: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('datasets', 'readwrite');
      const store = transaction.objectStore('datasets');
      const item: CachedDataset = {
        name,
        csvContent,
        updatedAt: Date.now()
      };
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getDatasetCSV(name: string): Promise<string | null> {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('datasets', 'readonly');
      const store = transaction.objectStore('datasets');
      const request = store.get(name);
      request.onsuccess = () => {
        const res = request.result as CachedDataset | undefined;
        resolve(res ? res.csvContent : null);
      };
      request.onerror = () => resolve(null);
    });
  },

  async deleteDatasetCSV(name: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('datasets', 'readwrite');
      const store = transaction.objectStore('datasets');
      const request = store.delete(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // --- Offline Workspaces Management ---
  async saveWorkspace(workspace: Omit<LocalWorkspace, 'id' | 'created_at'>): Promise<LocalWorkspace> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('workspaces', 'readwrite');
      const store = transaction.objectStore('workspaces');
      const newWs = {
        ...workspace,
        created_at: new Date().toISOString()
      };
      const request = store.add(newWs);
      request.onsuccess = () => {
        resolve({ ...newWs, id: request.result as number });
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getWorkspaces(): Promise<LocalWorkspace[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('workspaces', 'readonly');
      const store = transaction.objectStore('workspaces');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as LocalWorkspace[] || []);
      request.onerror = () => reject(request.error);
    });
  },

  // --- Offline Query Logs Storage ---
  async saveQuery(query: Omit<LocalQuery, 'id' | 'created_at'>): Promise<LocalQuery> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('queries', 'readwrite');
      const store = transaction.objectStore('queries');
      const newQuery = {
        ...query,
        created_at: new Date().toISOString()
      };
      const request = store.add(newQuery);
      request.onsuccess = () => {
        resolve({ ...newQuery, id: request.result as number });
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getQueries(workspaceId: number): Promise<LocalQuery[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('queries', 'readonly');
      const store = transaction.objectStore('queries');
      const index = store.index('workspace_id');
      const request = index.getAll(workspaceId);
      request.onsuccess = () => {
        const results = request.result as LocalQuery[] || [];
        // Sort descending by date
        resolve(results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      };
      request.onerror = () => reject(request.error);
    });
  },

  // --- Offline Bookmarks (Saved Analyses) ---
  async saveBookmark(saved: Omit<LocalSaved, 'id' | 'created_at'>): Promise<LocalSaved> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('saved', 'readwrite');
      const store = transaction.objectStore('saved');
      const newBookmark = {
        ...saved,
        created_at: new Date().toISOString()
      };
      const request = store.add(newBookmark);
      request.onsuccess = () => {
        resolve({ ...newBookmark, id: request.result as number });
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getBookmarks(workspaceId: number): Promise<LocalSaved[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('saved', 'readonly');
      const store = transaction.objectStore('saved');
      const index = store.index('workspace_id');
      const request = index.getAll(workspaceId);
      request.onsuccess = () => resolve(request.result as LocalSaved[] || []);
      request.onerror = () => reject(request.error);
    });
  }
};
