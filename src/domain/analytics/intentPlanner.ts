// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/intentPlanner.ts
// S5 PATTERN PLANNER — Deterministic regex/keyword intent compiler (Layer 1).
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisIntent } from './types';
import { DatasetProfile } from '../types/dataset';

export interface PlannedIntent {
  intent: AnalysisIntent;
  confidence: number;
}

const INTENT_SYNONYMS: Record<AnalysisIntent, string[]> = {
  grouped_average: [
    'breakdown', 'varies', 'varies between', 'looks like across',
    'differ between', 'split by', 'per category', 'across groups',
    'segmented by', 'grouped by', 'by each', 'compare across',
    'broken down by', 'separated by', 'divided by',
  ],
  distribution: [
    'spread', 'range', 'pattern', 'dispersion', 'variety',
    'how varied', 'how spread', 'frequencies', 'histogram of',
  ],
  correlation: [
    'relationship', 'related to', 'linked', 'associated with',
    'connection between', 'affect', 'impact on', 'influence on',
    'predict', 'explain',
  ],
  ranking: [
    'most', 'least', 'best', 'worst', 'leaders',
    'leading', 'trailing', 'dominant', 'extreme',
  ],
  summary: [
    'summary', 'summarize', 'overview', 'count', 'how many', 'total'
  ],
  comparison: [
    'compare', 'comparison', 'difference between', 'versus', ' vs '
  ],
  feature_importance: [
    'strongest relationship', 'relationship with', 'most related', 'feature importance',
    'which feature', 'best predict', 'predicts', 'predicting', 'predictor'
  ],
  filter: [
    'show users', 'show records', 'filter by', 'above', 'below',
    'greater than', 'less than', 'equal to', 'where'
  ]
};

function synonymMatch(q: string): { intent: AnalysisIntent; confidence: number } | null {
  const lower = q.toLowerCase();
  for (const [intent, synonyms] of Object.entries(INTENT_SYNONYMS)) {
    if (synonyms.some(s => lower.includes(s))) {
      return { intent: intent as AnalysisIntent, confidence: 0.82 };
    }
  }
  return null;
}

function structuralFallback(
  resolvedCols: any[] | undefined,
  profile: DatasetProfile | undefined
): { intent: AnalysisIntent; confidence: number } {
  if (!profile || !profile.columns || !resolvedCols) {
    return { intent: 'summary', confidence: 0.62 };
  }

  const numeric = resolvedCols.filter(c => {
    const col = profile.columns.find(col => col.name === c.columnName);
    return col?.type === 'numeric';
  });

  const categ = resolvedCols.filter(c => {
    const col = profile.columns.find(col => col.name === c.columnName);
    return col?.type === 'category';
  });

  // 1 numeric + 1 categorical → almost certainly grouped_average
  if (numeric.length >= 1 && categ.length >= 1) {
    return { intent: 'grouped_average', confidence: 0.72 }; // → clarify, not unsupported
  }

  // 2 numerics → probably correlation
  if (numeric.length >= 2) {
    return { intent: 'correlation', confidence: 0.68 };
  }

  // 1 numeric alone → distribution
  if (numeric.length === 1) {
    return { intent: 'distribution', confidence: 0.65 };
  }

  // True last resort — confidence floor raised so it goes to clarify, not unsupported
  return { intent: 'summary', confidence: 0.62 };
}

export const IntentPlanner = {
  /**
   * Converts a query into a raw intent using regex/keyword matching (Layer 1).
   */
  plan(question: string, profile?: DatasetProfile, resolvedCols?: any[]): PlannedIntent {
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
        if (/\btop[_\s]*\d+/.test(q) || /\bbottom[_\s]*\d+/.test(q) || q.includes('top 5') || q.includes('top 10')) {
          return { intent: 'ranking', confidence: 0.90 };
        }
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

    // 9. Synonym pass
    const synResult = synonymMatch(q);
    if (synResult) return synResult;

    // 10. Structural Fallback signal
    if (resolvedCols && profile) {
      return structuralFallback(resolvedCols, profile);
    }

    // Default fallback to summary with lower confidence
    return { intent: 'summary', confidence: 0.50 };
  }
};
