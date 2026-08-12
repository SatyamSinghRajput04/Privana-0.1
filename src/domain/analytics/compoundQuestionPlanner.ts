// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/compoundQuestionPlanner.ts
// COMPOUND QUESTION PLANNER — deterministic decomposition of broad "analyze X"
// style questions into 2-3 sub-questions, each executed through the existing,
// unmodified runAnalyticsQuestion pipeline as an independent plan. No LLM, no
// new analytics engine, no hardcoded dataset columns — purely rule-based
// pattern matching over the question text plus schema resolution against
// whatever dataset is actually loaded.
//
// SUPPORTED PATTERNS (exactly four — anything else is treated as a normal
// single-plan question):
//
//   1. analyze_and_factors        "analyze <X> and what/which factors are
//                                  associated with it" (with optional
//                                  "tell me" before what/which)
//   2. full_analysis_of           "complete/full/comprehensive/in-depth
//                                  analysis of <X>"
//   3. what_factors_affect        "what factors affect/influence/drive <X>"
//                                  / "what drives/influences <X>"
//   4. factors_associated_with    "factors associated with <X>" /
//                                  "factors that affect/affecting <X>"
//
// Each pattern extracts a target phrase, which MUST resolve to a real column
// in the active dataset (via the existing SemanticResolver) or decomposition
// is aborted — Privana never guesses a target that isn't actually there.
// ─────────────────────────────────────────────────────────────────────────────

import { DatasetProfile } from '../types/dataset';
import { SemanticResolver } from './semanticResolver';

export interface CompoundDecomposition {
  isCompound: boolean;
  subQuestions: string[];
  targetColumn?: string;
  matchedPattern?: string;
}

const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'analyze_and_factors', regex: /\banalyz(?:e|es|ing|is)\s+([a-z0-9_ ]+?)\s+and\s+(?:tell me\s+)?(?:what|which)\s+factors?/i },
  { name: 'full_analysis_of', regex: /\b(?:complete|full|comprehensive|in-depth)\s+analysis\s+of\s+([a-z0-9_ ]+)/i },
  { name: 'what_factors_affect', regex: /\bwhat\s+(?:factors?\s+(?:affect|influence|drive)s?|drives?|influences?)\s+([a-z0-9_ ]+)/i },
  { name: 'factors_associated_with', regex: /\bfactors?\s+(?:associated with|that affect|affecting)\s+([a-z0-9_ ]+)/i },
];

// Filler words stripped from an extracted target phrase before resolution —
// generic enough to help across domains without hardcoding any dataset's
// actual column vocabulary.
const FILLER_WORDS = /\b(the|a|an|customer|customers|overall|total|it|this|that)\b/gi;

function cleanTargetPhrase(raw: string): string {
  return raw.replace(FILLER_WORDS, ' ').replace(/\s+/g, ' ').trim();
}

export const CompoundQuestionPlanner = {
  /**
   * Attempts to decompose a broad question into 2-3 sub-questions using ONLY
   * the four patterns above. Returns isCompound=false (a single-item
   * subQuestions array containing the original question, unchanged) for
   * anything else — including questions that match a pattern's wording but
   * whose target phrase doesn't resolve to any real column in the active
   * dataset, since guessing would be worse than falling back.
   */
  decompose(question: string, profile: DatasetProfile): CompoundDecomposition {
    const fallback: CompoundDecomposition = { isCompound: false, subQuestions: [question] };
    if (!profile || !profile.columns || profile.columns.length === 0) return fallback;

    for (const pattern of PATTERNS) {
      const match = question.match(pattern.regex);
      if (!match || !match[1]) continue;

      const targetPhrase = cleanTargetPhrase(match[1]);
      if (!targetPhrase) continue;

      const resolved = SemanticResolver.resolve(targetPhrase, profile);
      if (resolved.length === 0) continue;

      const targetCol = profile.columns.find(c => c.name === resolved[0].columnName);
      if (!targetCol) continue;

      const subQuestions: string[] = [
        'How many total records are in the dataset',
      ];

      // Breakdown sub-plan — routes through the existing grouped_average
      // executor either way, just picking which side is the metric vs the
      // group depending on the target's own type:
      //   target is numeric      → average TARGET grouped by best categorical column
      //   target is category/bool → average best numeric column grouped by TARGET
      //     (shows how a real numeric factor varies across the target's
      //      categories — e.g. "average tenure_months by churn" — which is
      //      what the existing executor can actually compute; there is no
      //      grouped-average-of-a-categorical-target executor)
      //   no numeric column available → plain distribution of the best
      //     categorical column, as a last-resort breakdown
      const otherCols = profile.columns.filter(c => c.name !== targetCol.name);
      const bestNumeric = otherCols.find(c => c.type === 'numeric');
      const bestCategorical = otherCols.find(c => c.type === 'category' || c.type === 'boolean');

      if (targetCol.type === 'numeric' && bestCategorical) {
        subQuestions.push(`What is the average ${targetCol.name} grouped by ${bestCategorical.name}`);
      } else if (bestNumeric) {
        subQuestions.push(`What is the average ${bestNumeric.name} grouped by ${targetCol.name}`);
      } else if (bestCategorical) {
        subQuestions.push(`Show the distribution of ${bestCategorical.name}`);
      }

      // Factor/relationship sub-plan — always included for these patterns,
      // routes through the existing feature_importance executor regardless
      // of the target's type. Phrasing deliberately avoids "which feature
      // has" — the word pair "feature"+"has" false-matches unrelated numeric
      // columns in the resolver's fuzzy-match gate (e.g. tenure_months),
      // which gets flagged as a "missing column" and refuses the query.
      // "best predictor of X" hits the same feature_importance trigger
      // without tripping that collision.
      subQuestions.push(`What is the best predictor of ${targetCol.name}`);

      return {
        isCompound: true,
        subQuestions,
        targetColumn: targetCol.name,
        matchedPattern: pattern.name,
      };
    }

    return fallback;
  }
};
