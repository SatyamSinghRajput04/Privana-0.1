import supabase from './_supabase.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { session_id, workspace_id } = req.query;
      let q = supabase.from('viq_network_log').select('*').order('created_at', { ascending: true }).limit(200);
      if (session_id) q = q.eq('session_id', session_id);
      if (workspace_id) q = q.eq('workspace_id', parseInt(workspace_id));
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { workspace_id, session_id, event_type, process_name, dst_ip, dst_port, bytes_sent, message } = req.body;
      const { data, error } = await supabase.from('viq_network_log').insert({ workspace_id, session_id, event_type, process_name, dst_ip, dst_port, bytes_sent: bytes_sent || 0, message }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
