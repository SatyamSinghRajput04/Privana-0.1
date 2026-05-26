// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/semanticResolver.ts
// S6 SEMANTIC RESOLVER — Column mapping and confidence scoring (Layer 2).
// ─────────────────────────────────────────────────────────────────────────────

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

    // Clean question: lowercase and strip punctuation except underscores
    const cleanQ = question.toLowerCase().replace(/[?.,/#!$%^&*;:{}=\-_`~()]/g, ' ');
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

    // 2. Also try matching with underscores for words (in case user typed "sleep_hours")
    for (let n = Math.min(3, words.length); n >= 1; n--) {
      for (let i = 0; i <= words.length - n; i++) {
        const term = words.slice(i, i + n).join('_');
        const match = SchemaIntelligence.resolveColumn(term, profile);
        if (match) {
          addMatch(term.replace(/_/g, ' '), match);
        }
      }
    }

    // 3. Value-based column resolution (e.g. "Instagram" -> platform_usage)
    for (const col of profile.columns) {
      if (col.uniqueValues) {
        for (const val of col.uniqueValues) {
          const valStr = String(val).toLowerCase().trim();
          if (valStr.length > 0 && cleanQ.includes(valStr)) {
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
  }
};
