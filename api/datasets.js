import supabase from './_supabase.js';
import { enforceCORS, enforceSessionWorkspaceHeaders, enforceBodySize, enforceRateLimit } from './_security.js';

export default async function handler(req, res) {
  enforceCORS(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!enforceRateLimit(req, res)) return;
  if (!enforceBodySize(req, res)) return;
  if (!enforceSessionWorkspaceHeaders(req, res)) return;
  try {
    const headerWorkspaceId = parseInt(req.headers['x-workspace-id'], 10);

    if (req.method === 'GET') {
      const { data, error } = await supabase.from('viq_datasets').select('*').eq('workspace_id', headerWorkspaceId).order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { name, file_type, row_count, col_count, size_bytes, columns_meta } = req.body;
      const { data, error } = await supabase.from('viq_datasets').insert({ workspace_id: headerWorkspaceId, name, file_type, row_count, col_count, size_bytes, columns_meta }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, columns_meta } = req.body;
      const { data, error } = await supabase.from('viq_datasets').update({ columns_meta }).eq('id', id).eq('workspace_id', headerWorkspaceId).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      const { error } = await supabase.from('viq_datasets').delete().eq('id', id).eq('workspace_id', headerWorkspaceId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
