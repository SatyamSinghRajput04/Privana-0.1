// ─────────────────────────────────────────────────────────────────────────────
// src/lib/matchResultToSheet.ts
// LEVEL 2 FEATURE — Maps a Q&A result to the most contextually relevant static
// workspace sheet so the contextual card is injected in the right place.
// ─────────────────────────────────────────────────────────────────────────────

import { WorkspaceBlueprint } from '../domain/analytics/types';

/**
 * Extracts all column name tokens from a Q&A result's plan.
 */
function extractResultColumns(result: any): string[] {
  const cols = new Set<string>();
  const plan = result?.plan;
  if (!plan) return [];

  if (plan.metric) cols.add(plan.metric.toLowerCase());
  if (plan.target) cols.add(plan.target.toLowerCase());
  if (Array.isArray(plan.groupBy)) {
    plan.groupBy.forEach((g: string) => cols.add(g.toLowerCase()));
  }
  return Array.from(cols);
}

/**
 * Scores how well a sheet matches based on columns referenced in the cards.
 */
function scoreSheetDynamic(sheet: any, resultCols: string[]): number {
  if (!sheet.cards || !Array.isArray(sheet.cards)) return 0;
  
  const sheetCols = new Set<string>();
  for (const card of sheet.cards) {
    const spec = card.spec;
    if (!spec) continue;
    
    if (spec.metricColumn) sheetCols.add(spec.metricColumn.toLowerCase());
    if (spec.groupColumn) sheetCols.add(spec.groupColumn.toLowerCase());
    if (spec.categoryColumn) sheetCols.add(spec.categoryColumn.toLowerCase());
    if (spec.xColumn) sheetCols.add(spec.xColumn.toLowerCase());
    if (spec.yColumn) sheetCols.add(spec.yColumn.toLowerCase());
  }

  let score = 0;
  for (const col of resultCols) {
    if (sheetCols.has(col)) {
      score += 1;
    }
  }
  return score;
}

/**
 * Fallback matcher based on intent name substrings.
 */
function getPreferredSheetForIntent(intent: string, staticSheets: any[]): string {
  const preferredSubstrings: Record<string, string[]> = {
    correlation: ['relationship', 'trend', 'overview'],
    distribution: ['overview', 'demographic', 'breakdown'],
    grouped_average: ['breakdown', 'overview'],
    comparison: ['breakdown', 'overview'],
    ranking: ['breakdown', 'overview']
  };

  const substrings = preferredSubstrings[intent] || ['overview'];
  for (const sub of substrings) {
    const match = staticSheets.find(s => s.id.toLowerCase().includes(sub) || s.name.toLowerCase().includes(sub));
    if (match) return match.id;
  }
  return staticSheets[0]?.id || '';
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
  const resultCols = extractResultColumns(result);

  // Score each static sheet
  const scores: Record<string, number> = {};
  for (const sheet of staticSheets) {
    scores[sheet.id] = scoreSheetDynamic(sheet, resultCols);
  }

  // Find winner by highest score
  const maxScore = Math.max(...Object.values(scores));

  // If all scores are 0, use intent-based preference as tiebreaker
  if (maxScore === 0) {
    return getPreferredSheetForIntent(intent, staticSheets);
  }

  // Return first sheet with the max score
  const winner = staticSheets.find(s => scores[s.id] === maxScore);
  return winner ? winner.id : staticSheets[0].id;
}
