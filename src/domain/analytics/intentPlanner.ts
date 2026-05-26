// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/intentPlanner.ts
// S5 PATTERN PLANNER — Deterministic regex/keyword intent compiler (Layer 1).
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisIntent } from './types';

export interface PlannedIntent {
  intent: AnalysisIntent;
  confidence: number;
}

export const IntentPlanner = {
  /**
   * Converts a query into a raw intent using regex/keyword matching (Layer 1).
   */
  plan(question: string, _profile?: unknown): PlannedIntent {
    const q = question.toLowerCase().trim();

    // 1. Feature Importance (highly specific predictive queries)
    if (
      q.includes('strongest relationship') ||
      q.includes('relationship with') ||
      q.includes('most related') ||
      q.includes('feature importance') ||
      q.includes('which feature') ||
      q.includes('best predict') ||
      q.includes('predicts') ||
      q.includes('predicting') ||
      q.includes('predictor')
    ) {
      return { intent: 'feature_importance', confidence: 0.95 };
    }

    // 2. Correlation (specific statistical queries)
    if (
      q.includes('correlation') ||
      q.includes('pearson') ||
      q.includes('spearman') ||
      q.includes('point-biserial') ||
      q.includes('coefficient') ||
      (/\br\b/.test(q) && q.includes('value'))
    ) {
      return { intent: 'correlation', confidence: 0.95 };
    }

    // 3. Comparison
    if (
      q.includes('compare') ||
      q.includes('comparison') ||
      q.includes('difference between') ||
      q.includes('versus') ||
      q.includes(' vs ')
    ) {
      return { intent: 'comparison', confidence: 0.90 };
    }

    // 4. Ranking
    if (
      /\btop\s+\d+/.test(q) ||
      /\bbottom\s+\d+/.test(q) ||
      q.includes('highest') ||
      q.includes('lowest') ||
      q.includes('top 5') ||
      q.includes('top 10')
    ) {
      // Check if it's actually grouped average or ranking
      if (q.includes('average') || q.includes('mean') || q.includes('avg')) {
        return { intent: 'grouped_average', confidence: 0.85 };
      }
      return { intent: 'ranking', confidence: 0.90 };
    }

    // 5. Grouped Average
    if (
      (q.includes('average') || q.includes('mean') || q.includes('avg')) &&
      (q.includes('platform') || q.includes('gender') || q.includes('by') || q.includes('group') || q.includes('each'))
    ) {
      return { intent: 'grouped_average', confidence: 0.90 };
    }

    // 6. Distribution
    if (
      q.includes('distribution') ||
      q.includes('frequency') ||
      q.includes('histogram') ||
      q.includes('spread') ||
      q.includes('breakdown')
    ) {
      return { intent: 'distribution', confidence: 0.90 };
    }

    // 7. Filter
    if (
      q.includes('show users') ||
      q.includes('show records') ||
      q.includes('filter by') ||
      q.includes('above') ||
      q.includes('below') ||
      q.includes('greater than') ||
      q.includes('less than') ||
      q.includes('equal to') ||
      q.includes('where')
    ) {
      return { intent: 'filter', confidence: 0.85 };
    }

    // 8. Summary (fallback or explicit summary keywords)
    if (
      q.includes('summary') ||
      q.includes('summarize') ||
      q.includes('overview') ||
      q.includes('count') ||
      q.includes('how many') ||
      q.includes('total')
    ) {
      return { intent: 'summary', confidence: 0.85 };
    }

    // Default fallback to summary with lower confidence
    return { intent: 'summary', confidence: 0.50 };
  }
};
