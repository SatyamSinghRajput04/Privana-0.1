import crypto from 'crypto';
import supabase from './_supabase.js';
import { enforceCORS, enforceSessionWorkspaceHeaders, enforceBodySize, enforceRateLimit } from './_security.js';

export default async function handler(req, res) {
  enforceCORS(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!enforceRateLimit(req, res)) return;
  if (!enforceBodySize(req, res)) return;
  if (!enforceSessionWorkspaceHeaders(req, res)) return;

  const sessionId = req.headers['x-session-id'];

  // Derive secure, unique tenant owner token from session ID
  const tenantToken = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'privana-secure-default-salt')
    .update(sessionId)
    .digest('hex')
    .substring(0, 32);

  try {
    if (req.method === 'GET') {
      let { data, error } = await supabase.from('viq_workspaces').select('*').eq('owner', tenantToken).order('created_at', { ascending: true });
      if (error) throw error;

      // Self-healing fallback: Seed an isolated cloud workspace if this is a fresh user session
      if (!data || data.length === 0) {
        const seed = await supabase.from('viq_workspaces').insert({
          name: 'Default Cloud Workspace',
          description: 'My secure private analytical workspace in the cloud.',
          mode: 'server',
          owner: tenantToken
        }).select().single();
        if (seed.error) throw seed.error;
        data = [seed.data];
      }

      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { name, description, mode } = req.body;
      const { data, error } = await supabase.from('viq_workspaces').insert({
        name,
        description,
        mode: mode || 'solo',
        owner: tenantToken
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body;
      // Guarantee tenant-isolation by making sure they only delete their own workspaces
      const { error } = await supabase.from('viq_workspaces').delete().eq('id', id).eq('owner', tenantToken);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
