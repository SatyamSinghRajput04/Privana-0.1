/**
 * Privana local-first IndexedDB Database Utility
 * Handles binary and large text caching (e.g., raw CSV files) in-browser.
 * Prevents the 5MB browser localStorage overflow error.
 */

const DB_NAME = 'privana_local_db';
const DB_VERSION = 2;

export interface CachedDataset {
  name: string;
  csvContent?: string;
  blob?: Blob;
  datasetId?: string | number;
  rowCount?: number;
  sizeBytes?: number;
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
  // Optional chart meta for solo mode (avoids needing a join like server mode's viq_queries)
  chart_type?: string;
  execution_ms?: number;
  row_count?: number;
}

export interface AuditLog {
  id?: number;
  workspace_id: number;
  created_at: string;
  event_type: 'INFO' | 'ALLOW' | 'WARN' | 'ALERT' | 'BLOCK';
  process_name: string;
  message_label: string; // safe redacted message label only
  pii_types: string[];
  payload_hash: string;
  bytes_external: number;
  bytes_loopback: number;
  bytes_audit_sync: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Graceful check for Node environments that don't have indexedDB globally
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
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

      // Offline Egress Audit Logs (Added in DB Version 2)
      if (!db.objectStoreNames.contains('audit_logs')) {
        const auditStore = db.createObjectStore('audit_logs', { keyPath: 'id', autoIncrement: true });
        auditStore.createIndex('workspace_id', 'workspace_id', { unique: false });
        auditStore.createIndex('created_at', 'created_at', { unique: false });
        auditStore.createIndex('event_type', 'event_type', { unique: false });
      }
    };
  });
}

export const localDB = {
  // --- Datasets Storage (Binary Blob & CSV Caching) ---
  async saveDatasetBlob(name: string, blob: Blob, datasetId?: string | number, rowCount?: number): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('datasets', 'readwrite');
      const store = transaction.objectStore('datasets');
      const item: CachedDataset = {
        name,
        blob,
        datasetId,
        rowCount,
        sizeBytes: blob.size,
        updatedAt: Date.now()
      };
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getDatasetRecord(name: string): Promise<CachedDataset | null> {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('datasets', 'readonly');
      const store = transaction.objectStore('datasets');
      const request = store.get(name);
      request.onsuccess = () => {
        const res = request.result as CachedDataset | undefined;
        if (res) return resolve(res);
        // Fallback: Check alternative name formatting (e.g. stripped extension or sanitized)
        const altName = name.includes('.') ? name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_') : `${name}.csv`;
        const altReq = store.get(altName);
        altReq.onsuccess = () => resolve((altReq.result as CachedDataset) || null);
        altReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  },

  async getDatasetFile(name: string, datasetId?: string | number, expectedRowCount?: number): Promise<{ file: File; rowCount?: number; isLegacy: boolean } | null> {
    const record = await this.getDatasetRecord(name);
    if (!record) return null;

    const rowCount = expectedRowCount || record.rowCount;

    if (record.blob) {
      const file = new File([record.blob], name, { type: 'text/csv' });
      return { file, rowCount, isLegacy: false };
    }

    if (record.csvContent) {
      // Detect legacy 10-line preview: if expected rowCount is high but string has <= 15 lines
      const lineCount = (record.csvContent.match(/\n/g) || []).length;
      const isLegacy = Boolean(rowCount && rowCount > 50 && lineCount <= 15);
      const file = new File([record.csvContent], name, { type: 'text/csv' });
      return { file, rowCount, isLegacy };
    }

    return null;
  },

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
        resolve((res && res.csvContent) ? res.csvContent : null);
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
  },

  async deleteBookmark(id: number): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('saved', 'readwrite');
      const store = transaction.objectStore('saved');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async deleteQuery(id: number): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('queries', 'readwrite');
      const store = transaction.objectStore('queries');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async updateBookmark(id: number, updates: Partial<LocalSaved>): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('saved', 'readwrite');
      const store = transaction.objectStore('saved');
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const record = getRequest.result as LocalSaved | undefined;
        if (record) {
          const updated = { ...record, ...updates };
          const putRequest = store.put(updated);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  },

  // --- Offline Egress Audit Logs (Added in DB Version 2) ---
  async saveAuditLog(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('audit_logs', 'readwrite');
      const store = transaction.objectStore('audit_logs');
      const newLog: AuditLog = {
        ...log,
        created_at: new Date().toISOString()
      };
      
      const addRequest = store.add(newLog);
      
      addRequest.onsuccess = () => {
        newLog.id = addRequest.result as number;
      };

      // Prune logs if they exceed 1,000 for this workspace
      const index = store.index('workspace_id');
      const countRequest = index.count(IDBKeyRange.only(log.workspace_id));
      countRequest.onsuccess = () => {
        const count = countRequest.result;
        if (count > 1000) {
          const excess = count - 1000;
          let deleted = 0;
          const cursorRequest = index.openCursor(IDBKeyRange.only(log.workspace_id), 'next'); // oldest first
          cursorRequest.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor && deleted < excess) {
              cursor.delete();
              deleted++;
              cursor.continue();
            }
          };
        }
      };

      transaction.oncomplete = () => {
        // Dispatch custom event only AFTER transaction is fully committed to prevent premature UI re-fetches
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('privana:audit-log-added', { 
            detail: { workspaceId: log.workspace_id } 
          }));
        }
        resolve(newLog);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getAuditLogs(workspaceId: number): Promise<AuditLog[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('audit_logs', 'readonly');
      const store = transaction.objectStore('audit_logs');
      const index = store.index('workspace_id');
      const request = index.getAll(workspaceId);
      request.onsuccess = () => {
        const results = request.result as AuditLog[] || [];
        // Sort descending by date
        resolve(results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      };
      request.onerror = () => reject(request.error);
    });
  }
};
