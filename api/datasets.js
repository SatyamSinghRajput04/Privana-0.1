import supabase from './_supabase.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { workspace_id } = req.query;
      let q = supabase.from('viq_datasets').select('*').order('created_at', { ascending: false });
      if (workspace_id) q = q.eq('workspace_id', parseInt(workspace_id));
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { workspace_id, name, file_type, row_count, col_count, size_bytes, columns_meta } = req.body;
      const { data, error } = await supabase.from('viq_datasets').insert({ workspace_id, name, file_type, row_count, col_count, size_bytes, columns_meta }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, columns_meta } = req.body;
      const { data, error } = await supabase.from('viq_datasets').update({ columns_meta }).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      const { error } = await supabase.from('viq_datasets').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
