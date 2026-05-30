// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/semanticResolver.ts
// S6 SEMANTIC RESOLVER — Column mapping and confidence scoring (Layer 2).
// ─────────────────────────────────────────────────────────────────────────────

import { ColumnResolver } from '../resolver/resolver';
import { DatasetProfile } from '../types/dataset';
import { SchemaIntelligence } from './schemaIntelligence';
import { ColumnMatch } from './types';

export interface ResolvedColumn {
  term: string;
  columnName: string;
  confidence: number;
  role: string;
}

export const SemanticResolver = {
  /**
   * Extracts candidate phrases from the question and resolves them to columns
   * with confidence scores. Supports multi-word n-grams.
   */
  resolve(question: string, profile: DatasetProfile): ResolvedColumn[] {
    if (!profile || !profile.columns || profile.columns.length === 0) {
      return [];
    }

    // Clean question: lowercase and strip punctuation.
    // IMPORTANT: do NOT strip underscores (_) here — column names like physical_activity
    // use underscores and must survive as single tokens for schema matching.
    const cleanQ = question.toLowerCase().replace(/[?.,/#!$%^&*;:{}=\-`~()]/g, ' ');
    const words = cleanQ.split(/\s+/).filter(w => w.length > 0);

    const resolved: ResolvedColumn[] = [];
    const matchedCols = new Set<string>();

    // Helper to add a match if it's new or has higher confidence
    const addMatch = (term: string, match: ColumnMatch) => {
      const existingIdx = resolved.findIndex(r => r.columnName === match.columnName);
      if (existingIdx !== -1) {
        if (match.confidence > resolved[existingIdx].confidence) {
          resolved[existingIdx] = {
            term,
            columnName: match.columnName,
            confidence: match.confidence,
            role: match.role,
          };
        }
      } else {
        resolved.push({
          term,
          columnName: match.columnName,
          confidence: match.confidence,
          role: match.role,
        });
        matchedCols.add(match.columnName);
      }
    };

    // 1. Generate N-Grams (up to trigrams) to support multi-word columns (e.g. "sleep hours", "stress level")
    // Try larger n-grams first to prioritize greedy matches
    for (let n = Math.min(3, words.length); n >= 1; n--) {
      for (let i = 0; i <= words.length - n; i++) {
        const term = words.slice(i, i + n).join(' ');
        const match = SchemaIntelligence.resolveColumn(term, profile);
        if (match) {
          addMatch(term, match);
        }
      }
    }

    // 2. Also try joining adjacent words with underscores to catch patterns like
    //    "physical activity" → "physical_activity" (typed with a space instead of underscore).
    //    This covers the case where the user writes column names with spaces.
    for (let n = Math.min(3, words.length); n >= 1; n--) {
      for (let i = 0; i <= words.length - n; i++) {
        const underscoredTerm = words.slice(i, i + n).join('_');
        // Skip if it's the same as the space-joined term (already matched above)
        const spacedTerm = words.slice(i, i + n).join(' ');
        if (underscoredTerm === spacedTerm) continue;
        const match = SchemaIntelligence.resolveColumn(underscoredTerm, profile);
        if (match) {
          addMatch(spacedTerm, match);
        }
      }
    }

    // 3. Value-based column resolution (e.g. "Instagram" -> platform_usage)
    for (const col of profile.columns) {
      if (col.uniqueValues) {
        for (const val of col.uniqueValues) {
          const valStr = String(val).toLowerCase().trim();
          const escapedVal = valStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const wordRegex = new RegExp(`\\b${escapedVal}\\b`, 'i');
          if (valStr.length > 0 && wordRegex.test(cleanQ)) {
            addMatch(valStr, {
              columnName: col.name,
              confidence: 0.90,
              role: col.type === 'numeric' ? 'metric' : 'groupBy'
            });
          }
        }
      }
    }

    // Sort by confidence descending
    return resolved.sort((a, b) => b.confidence - a.confidence);
  },

  /**
   * Identifies candidate terms in the question that look like columns but failed to resolve.
   */
  findMissingColumns(question: string, profile: DatasetProfile): string[] {
    if (!profile || !profile.columns || profile.columns.length === 0) {
      return [];
    }

    const resolvedCols = new Set(this.resolve(question, profile).map(r => r.columnName.toLowerCase()));

    // Consistent with resolve(): do NOT strip underscores so column names survive intact.
    const cleanQ = question.toLowerCase().replace(/[?.,/#!$%^&*;:{}=\-`~()]/g, ' ');
    const words = cleanQ.split(/\s+/).filter(w => w.length > 0);
    const missing: string[] = [];

    // Helper to see if a term matches something but is gated
    const checkTerm = (term: string) => {
      const rawMatch = ColumnResolver.resolve(term, profile);
      if (rawMatch && rawMatch.strategy === 'fuzzy') {
        if (resolvedCols.has(rawMatch.columnName.toLowerCase())) {
          return;
        }
        const gatedMatch = SchemaIntelligence.resolveColumn(term, profile);
        if (!gatedMatch) {
          missing.push(term);
        }
      }
    };

    // Check N-Grams
    for (let n = Math.min(3, words.length); n >= 1; n--) {
      for (let i = 0; i <= words.length - n; i++) {
        const term = words.slice(i, i + n).join(' ');
        checkTerm(term);
      }
    }

    // Check with underscores
    for (let n = Math.min(3, words.length); n >= 1; n--) {
      for (let i = 0; i <= words.length - n; i++) {
        const term = words.slice(i, i + n).join('_');
        checkTerm(term);
      }
    }

    // Also: check for words with underscores or words ending in level/hours/label/time/usage
    // that did not resolve to any column
    const allColNames = new Set(profile.columns.map(c => c.name.toLowerCase()));
    const suffixes = ['level', 'hours', 'label', 'time', 'usage'];

    for (const word of words) {
      const cleanW = word.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleanW.includes('_') || suffixes.some(s => cleanW.endsWith(s))) {
        if (!resolvedCols.has(cleanW) && !allColNames.has(cleanW)) {
          missing.push(word);
        }
      }
    }

    // Deduplicate and filter out words that are actually resolved columns
    return Array.from(new Set(missing)).filter(m => {
      const mClean = m.toLowerCase().replace(/[^a-z0-9_]/g, '');
      return !resolvedCols.has(mClean) && !allColNames.has(mClean);
    });
  }
};
