import supabase from './_supabase.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { workspace_id, limit } = req.query;
      let q = supabase.from('viq_queries').select('*').order('created_at', { ascending: false });
      if (workspace_id) q = q.eq('workspace_id', parseInt(workspace_id));
      if (limit) q = q.limit(parseInt(limit));
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { workspace_id, dataset_id, question, generated_sql, result_data, chart_type, chart_config, insights, execution_ms, row_count } = req.body;
      const { data, error } = await supabase.from('viq_queries').insert({ workspace_id, dataset_id, question, generated_sql, result_data, chart_type, chart_config, insights, execution_ms, row_count, status: 'completed' }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      const { error } = await supabase.from('viq_queries').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
