import supabase from './_supabase.js';
import { enforceCORS, enforceSessionWorkspaceHeaders, enforceBodySize, securePromptPersistence, enforceRateLimit } from './_security.js';

export default async function handler(req, res) {
  enforceCORS(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!enforceRateLimit(req, res)) return;
  if (!enforceBodySize(req, res)) return;
  if (!enforceSessionWorkspaceHeaders(req, res)) return;
  try {
    const headerWorkspaceId = parseInt(req.headers['x-workspace-id'], 10);

    if (req.method === 'GET') {
      const { limit } = req.query;
      let q = supabase.from('viq_queries').select('*').eq('workspace_id', headerWorkspaceId).order('created_at', { ascending: false });
      if (limit) q = q.limit(parseInt(limit));
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { dataset_id, question, generated_sql, result_data, chart_type, chart_config, insights, execution_ms, row_count } = req.body;
      const secureQuestion = securePromptPersistence(question);
      const { data, error } = await supabase.from('viq_queries').insert({ workspace_id: headerWorkspaceId, dataset_id, question: secureQuestion, generated_sql, result_data, chart_type, chart_config, insights, execution_ms, row_count, status: 'completed' }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      const { error } = await supabase.from('viq_queries').delete().eq('id', id).eq('workspace_id', headerWorkspaceId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
