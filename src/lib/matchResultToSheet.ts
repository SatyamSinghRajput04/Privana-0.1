// ─────────────────────────────────────────────────────────────────────────────
// src/lib/matchResultToSheet.ts
// LEVEL 2 FEATURE — Maps a Q&A result to the most contextually relevant static
// workspace sheet so the contextual card is injected in the right place.
// ─────────────────────────────────────────────────────────────────────────────

import { WorkspaceBlueprint } from '../domain/analytics/types';

/**
 * Column affinity groups — maps column name fragments to thematic sheet IDs.
 * Scoring: each matching fragment adds +1 to that sheet's score.
 * The sheet with the highest score wins; ties go to the first static sheet.
 */
const SHEET_COLUMN_AFFINITY: Record<string, string[]> = {
  sheet_sleep: [
    'sleep', 'bedtime', 'wake', 'rest', 'insomnia', 'fatigue'
  ],
  sheet_stress: [
    'stress', 'mental', 'anxiety', 'depression'
  ],
  sheet_platform: [
    'platform', 'usage', 'social', 'media', 'instagram',
    'tiktok', 'youtube', 'snapchat', 'twitter', 'screen_time'
  ],
  sheet_demographics: [
    'age', 'gender'
  ],
  sheet_overview: [
    'sleep', 'anxiety', 'depression', 'stress', 'gender',
    'social', 'platform', 'usage', 'daily', 'academic',
    'performance', 'age', 'media', 'instagram', 'tiktok',
    'youtube', 'snapchat', 'twitter', 'screen_time'
  ]
};

const INTENT_SHEET_PREFERENCE: Record<string, string> = {
  correlation:       'sheet_overview',
  distribution:      'sheet_overview',
  grouped_average:   'sheet_overview',
  comparison:        'sheet_overview',
  ranking:           'sheet_overview',
  summary:           'sheet_overview',
  feature_importance:'sheet_overview',
  filter:            'sheet_overview',
};

/**
 * Scores how well a sheet matches based on columns referenced in the result.
 */
function scoreSheet(sheetId: string, columnTokens: string[]): number {
  const affinityList = SHEET_COLUMN_AFFINITY[sheetId] || [];
  return columnTokens.reduce((score, token) => {
    return score + (affinityList.some(kw => token.includes(kw) || kw.includes(token)) ? 1 : 0);
  }, 0);
}

/**
 * Extracts all column name tokens from a Q&A result's plan.
 * Used for affinity scoring against sheet column groups.
 */
function extractColumnTokens(result: any): string[] {
  const tokens: string[] = [];
  const plan = result?.plan;
  if (!plan) return tokens;

  const addTokens = (val: string | undefined) => {
    if (val) {
      val.toLowerCase().split('_').forEach(t => tokens.push(t));
      tokens.push(val.toLowerCase());
    }
  };

  addTokens(plan.metric);
  addTokens(plan.target);
  (plan.groupBy || []).forEach((g: string) => addTokens(g));

  return tokens;
}

/**
 * Returns the ID of the static sheet that best matches the Q&A result.
 * Only considers non-snapshot (static) sheets.
 *
 * @param result    - The AnalyticsResult from runAnalyticsQuestion
 * @param workspace - The active WorkspaceBlueprint
 * @returns         - Sheet ID of the best matching static sheet
 */
export function matchResultToSheet(result: any, workspace: WorkspaceBlueprint): string {
  const staticSheets = workspace.sheets.filter(s => !s.id.startsWith('snapshot_') && !s.id.toLowerCase().includes('insights'));

  if (staticSheets.length === 0) {
    return workspace.sheets[0]?.id || '';
  }

  if (staticSheets.length === 1) {
    return staticSheets[0].id;
  }

  const intent: string = result?.plan?.intent || '';
  const columnTokens = extractColumnTokens(result);

  // Score each static sheet
  const scores: Record<string, number> = {};
  for (const sheet of staticSheets) {
    scores[sheet.id] = scoreSheet(sheet.id, columnTokens);
  }

  // Find winner by highest score
  const maxScore = Math.max(...Object.values(scores));

  // If all scores are 0, use intent-based preference as tiebreaker
  if (maxScore === 0) {
    const preferred = INTENT_SHEET_PREFERENCE[intent];
    const match = staticSheets.find(s => s.id === preferred);
    return match ? match.id : staticSheets[0].id;
  }

  // Return first sheet with the max score
  const winner = staticSheets.find(s => scores[s.id] === maxScore);
  return winner ? winner.id : staticSheets[0].id;
}
