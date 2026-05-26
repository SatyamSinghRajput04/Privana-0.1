import { privacyFetch } from '../infrastructure/firewall/privacyFetch';
import type { Workspace } from '../App';

export const api = {
  // Workspaces API
  async getWorkspaces(): Promise<Workspace[]> {
    const r = await privacyFetch('/api/workspaces');
    if (!r.ok) throw new Error('Failed to fetch workspaces');
    return r.json();
  },

  async createWorkspace(name: string, description: string, mode: string): Promise<Workspace> {
    const r = await privacyFetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, mode }),
    });
    if (!r.ok) throw new Error('Failed to create workspace');
    return r.json();
  },

  async deleteWorkspace(id: number): Promise<void> {
    const r = await privacyFetch('/api/workspaces', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) throw new Error('Failed to delete workspace');
  },

  // Datasets API
  async getDatasets(workspaceId: number): Promise<any[]> {
    const r = await privacyFetch(`/api/datasets?workspace_id=${workspaceId}`);
    if (!r.ok) throw new Error('Failed to fetch datasets');
    return r.json();
  },

  async uploadDataset(
    workspaceId: number,
    name: string,
    fileType: string,
    rowCount: number,
    colCount: number,
    sizeBytes: number,
    columnsMeta?: any[]
  ): Promise<any> {
    const r = await privacyFetch('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        name,
        file_type: fileType,
        row_count: rowCount,
        col_count: colCount,
        size_bytes: sizeBytes,
        columns_meta: columnsMeta || [
          { name: 'value', type: 'DECIMAL' },
          { name: 'count', type: 'INTEGER' },
          { name: 'category', type: 'VARCHAR' },
          { name: 'date', type: 'DATE' },
        ],
      }),
    });
    if (!r.ok) throw new Error('Failed to register dataset');
    return r.json();
  },

  async deleteDataset(id: number): Promise<void> {
    const r = await privacyFetch('/api/datasets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) throw new Error('Failed to delete dataset');
  },

  // Queries API
  async getQueries(workspaceId: number, limit?: number): Promise<any[]> {
    let url = `/api/queries?workspace_id=${workspaceId}`;
    if (limit) url += `&limit=${limit}`;
    const r = await privacyFetch(url);
    if (!r.ok) throw new Error('Failed to fetch queries');
    return r.json();
  },

  async runAnalysis(question: string, datasetId: number | null, workspaceId: number): Promise<any> {
    const r = await privacyFetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, dataset_id: datasetId, workspace_id: workspaceId }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Analysis failed');
    return d;
  },

  async deleteQuery(id: number): Promise<void> {
    const r = await privacyFetch('/api/queries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) throw new Error('Failed to delete query');
  },

  // Saved Analyses API
  async getSaved(workspaceId: number): Promise<any[]> {
    const r = await privacyFetch(`/api/saved?workspace_id=${workspaceId}`);
    if (!r.ok) throw new Error('Failed to fetch saved analyses');
    return r.json();
  },

  async saveAnalysis(workspaceId: number, title: string, queryId: number, notes?: string): Promise<any> {
    const r = await privacyFetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, title, query_id: queryId, notes }),
    });
    if (!r.ok) throw new Error('Failed to save analysis');
    return r.json();
  },

  async togglePinSaved(id: number, pinned: boolean): Promise<any> {
    const r = await privacyFetch('/api/saved', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pinned }),
    });
    if (!r.ok) throw new Error('Failed to update pin state');
    return r.json();
  },

  async deleteSaved(id: number): Promise<void> {
    const r = await privacyFetch('/api/saved', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) throw new Error('Failed to delete saved analysis');
  },
};
