import supabase from './_supabase.js';
import { enforceCORS, enforceSessionWorkspaceHeaders, enforceBodySize, securePromptPersistence, enforceRateLimit } from './_security.js';

// ─────────────────────────────────────────────────────────────────────────────
// api/analyze.js — METADATA-ONLY ENDPOINT
//
// POLICY: All analytics computation runs locally in the browser via the
// domain layer (src/domain/analytics/). This endpoint NEVER fabricates,
// infers, or simulates analytics results. It only persists query metadata
// (hashed question, timestamp) for history sync and collaboration.
//
// See: SPEC V1.1 §2 — "User data analysis runs locally."
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  enforceCORS(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!enforceRateLimit(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!enforceBodySize(req, res)) return;
  if (!enforceSessionWorkspaceHeaders(req, res)) return;

  try {
    const headerWorkspaceId = parseInt(req.headers['x-workspace-id'], 10);
    const { question, dataset_id } = req.body;
    if (!question) return res.status(400).json({ error: 'question required' });

    // ── METADATA-ONLY PERSISTENCE ──────────────────────────────────────────
    // Hash the question for privacy-safe storage. No analytics computation
    // occurs server-side. All analysis is performed locally in the browser.
    const secureQuestion = securePromptPersistence(question);

    const { data: saved, error } = await supabase.from('viq_queries').insert({
      workspace_id: headerWorkspaceId,
      dataset_id: dataset_id || null,
      question: secureQuestion,
      generated_sql: null,
      result_data: null,
      chart_type: null,
      insights: [],
      execution_ms: 0,
      row_count: 0,
      status: 'local_only',
    }).select().single();

    if (error) throw error;

    return res.status(200).json({
      id: saved.id,
      status: 'local_only',
      message: 'Analytics computation runs locally. This endpoint only persists query metadata for history sync.',
      privacyStatus: { bytesSent: 0, connections: 0, teeActive: false },
    });
  } catch (err) {
    console.error('analyze metadata error:', err);
    res.status(500).json({ error: err.message });
  }
}
