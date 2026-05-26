import supabase from './_supabase.js';
import { enforceCORS, enforceBodySize, enforceSessionWorkspaceHeaders, enforceRateLimit } from './_security.js';

export default async function handler(req, res) {
  enforceCORS(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!enforceRateLimit(req, res)) return;
  if (!enforceBodySize(req, res)) return;
  if (!enforceSessionWorkspaceHeaders(req, res)) return;

  try {
    const headerWorkspaceId = parseInt(req.headers['x-workspace-id'], 10);
    const headerSessionId = req.headers['x-session-id'];

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('viq_network_log')
        .select('*')
        .eq('workspace_id', headerWorkspaceId)
        .eq('session_id', headerSessionId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { event_type, process_name, dst_ip, dst_port, bytes_sent, message } = req.body;

      // Validate event_type against whitelist
      const eventTypeWhitelist = ['INFO', 'ALLOW', 'WARN', 'ALERT', 'BLOCK'];
      if (!eventTypeWhitelist.includes(event_type)) {
        return res.status(400).json({ error: 'Invalid event type' });
      }

      // Enforce metadata-only validation on the logged message
      if (message) {
        const lowerMsg = message.toLowerCase();

        // 1. Strict PII Scanner
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;
        const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/;
        const aadhaarRegex = /(?<!\d[ -]*)\b\d{4}\s\d{4}\s\d{4}\b(?![ -]*\d)|(?<!\d[ -]*)\b\d{12}\b(?![ -]*\d)/;
        const panRegex = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;

        if (emailRegex.test(message) || phoneRegex.test(message) || ssnRegex.test(message) || aadhaarRegex.test(message) || panRegex.test(message)) {
          return res.status(400).json({ error: 'Security Intercept: Message content rejected (contains potential PII)' });
        }

        // 2. Query / Code / Dataset Leakage Block (prevent SQL queries or questions inside message strings)
        const sqlKeywords = ['select ', 'insert ', 'update ', 'delete ', 'create table', 'from ', 'where '];
        const containsSql = sqlKeywords.some(keyword => lowerMsg.includes(keyword));
        if (containsSql) {
          return res.status(400).json({ error: 'Security Intercept: Message content rejected (raw database operations/queries are forbidden in remote logs)' });
        }

        // 3. Secrets / Token Leakage Block
        const secretRegex = /\bsk-[A-Za-z0-9]{32,}\b|\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b|\bghp_[A-Za-z0-9]{36,255}\b/i;
        if (secretRegex.test(message)) {
          return res.status(400).json({ error: 'Security Intercept: Message content rejected (contains sensitive secret tokens)' });
        }
      }

      const { data, error } = await supabase.from('viq_network_log').insert({ 
        workspace_id: headerWorkspaceId, 
        session_id: headerSessionId, 
        event_type, 
        process_name, 
        dst_ip, 
        dst_port, 
        bytes_sent: bytes_sent || 0, 
        message 
      }).select().single();
      
      if (error) throw error;
      return res.status(201).json(data);
    }
    
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
