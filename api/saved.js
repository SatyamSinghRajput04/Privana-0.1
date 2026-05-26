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
      // First try with the join
      let q = supabase.from('viq_saved_analyses')
        .select('*, viq_queries(question, chart_type, execution_ms)')
        .eq('workspace_id', headerWorkspaceId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      let { data, error } = await q;
      
      // If join fails, fetch without join
      if (error) {
        let q2 = supabase.from('viq_saved_analyses')
          .select('*')
          .eq('workspace_id', headerWorkspaceId)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false });
        const r2 = await q2;
        if (r2.error) throw r2.error;
        data = r2.data;
      }
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { title, query_id, notes } = req.body;
      const { data, error } = await supabase.from('viq_saved_analyses')
        .insert({ workspace_id: headerWorkspaceId, title, query_id, notes, pinned: false })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, pinned, notes } = req.body;
      const { data, error } = await supabase.from('viq_saved_analyses')
        .update({ pinned, notes })
        .eq('id', id)
        .eq('workspace_id', headerWorkspaceId)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      const { error } = await supabase.from('viq_saved_analyses')
        .delete()
        .eq('id', id)
        .eq('workspace_id', headerWorkspaceId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
