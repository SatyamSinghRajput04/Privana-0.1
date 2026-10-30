// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/schemaIntelligence.ts
// S4 SCHEMA INTELLIGENCE — Alias map, role inference, and question suggestions.
// ─────────────────────────────────────────────────────────────────────────────

import { ColumnResolver } from '../resolver/resolver';
import { DatasetProfile } from '../types/dataset';
import { ColumnMatch, ColumnRole, AnalysisIntent } from './types';

function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

export const SchemaIntelligence = {
  /**
   * Resolves a raw user phrase to a matching column in the dataset profile,
   * returning ranked confidence and a default role.
   */
  resolveColumn(phrase: string, profile: DatasetProfile): ColumnMatch | null {
    if (!profile || !profile.columns) return null;

    const match = ColumnResolver.resolve(phrase, profile);
    if (!match) return null;

    // Gate fuzzy matches
    if (match.strategy === 'fuzzy') {
      const tClean = phrase.toLowerCase().replace(/[^a-z0-9_]/g, '');
      const colClean = match.columnName.toLowerCase().replace(/[^a-z0-9_]/g, '');

      // Allow if the term is a direct prefix of the column name (e.g. "anxiety" → "anxiety_level")
      // This handles the very common {term}_{suffix} column naming pattern.
      const isDirectPrefix = colClean === tClean || colClean.startsWith(tClean + '_');
      if (isDirectPrefix) {
        // Direct prefix: allow with full confidence
      } else {
        const tTokens = tClean.split(/[\s_]+/);
        const colTokens = colClean.split(/[\s_]+/);
        const prefixMatch = tTokens[0].startsWith(colTokens[0].slice(0, 3)) || colTokens[0].startsWith(tTokens[0].slice(0, 3));

        const dist = getLevenshteinDistance(tClean, colClean);
        const maxDist = Math.max(1, Math.floor(tClean.length / 5));

        if (dist > maxDist || !prefixMatch) {
          return null; // Reject fuzzy matches that are too distant or prefix-mismatched
        }
      }
    }

    // Infer default role based on column type
    let role: ColumnRole = 'metric';
    const colName = match.columnName.toLowerCase();

    if (colName === 'id' || colName.endsWith('_id') || colName === 'uid') {
      const colProf = profile?.columns?.find(c => c.name.toLowerCase() === colName);
      const card = colProf?.cardinality ?? (colProf?.uniqueValues?.length || 0);
      role = (card > 0 && card <= 50) ? 'groupBy' : 'id';
    } else if (colName === 'date' || colName === 'timestamp' || colName === 'time' || colName === 'year') {
      role = 'time';
    } else if (match.type === 'numeric') {
      role = 'metric';
    } else {
      role = 'groupBy';
    }

    return {
      columnName: match.columnName,
      confidence: match.confidence,
      role,
    };
  },

  /**
   * Generates similar column suggestions for a missing term.
   */
  getSimilarColumns(missingTerm: string, profile: DatasetProfile): string[] {
    if (!profile || !profile.columns || profile.columns.length === 0) return [];
    const cleanTerm = missingTerm.toLowerCase().replace(/[^a-z0-9_]/g, '');

    // Rank all dataset columns dynamically by relevance to the missing term
    const scoredCols = profile.columns.map(col => {
      const colName = col.name;
      const cleanCol = colName.toLowerCase().replace(/[^a-z0-9_]/g, '');
      const dist = getLevenshteinDistance(cleanTerm, cleanCol);
      const hasOverlap = cleanCol.includes(cleanTerm) || cleanTerm.includes(cleanCol);
      return { colName, dist, hasOverlap };
    });

    // Sort by overlap priority, then Levenshtein edit distance ascending
    scoredCols.sort((a, b) => {
      if (a.hasOverlap && !b.hasOverlap) return -1;
      if (!a.hasOverlap && b.hasOverlap) return 1;
      return a.dist - b.dist;
    });

    const topSuggestions = scoredCols.map(s => s.colName);
    return Array.from(new Set(topSuggestions)).slice(0, 4);
  },

  /**
   * Infers the role of a column given the analysis intent.
   */
  inferRole(columnName: string, intent: AnalysisIntent, profile?: DatasetProfile): ColumnRole {
    const colName = columnName.toLowerCase();
    
    if (colName === 'id' || colName.endsWith('_id') || colName === 'uid') {
      const colProf = profile?.columns?.find(c => c.name.toLowerCase() === colName);
      const card = colProf?.cardinality ?? (colProf?.uniqueValues?.length || 0);
      if (card > 0 && card <= 50) {
        return (intent === 'grouped_average' || intent === 'ranking' || intent === 'comparison') ? 'groupBy' : 'id';
      }
      return 'id';
    }
    if (colName === 'date' || colName === 'timestamp' || colName === 'time' || colName === 'year') {
      return 'time';
    }

    // Determine type from profile if available
    let type = 'numeric';
    if (profile && profile.columns) {
      const col = profile.columns.find(c => c.name.toLowerCase() === colName);
      if (col) {
        type = col.type;
      }
    }

    if (intent === 'feature_importance') {
      return 'target';
    }

    if (intent === 'grouped_average') {
      return type === 'numeric' ? 'metric' : 'groupBy';
    }

    if (intent === 'comparison') {
      return type === 'numeric' ? 'metric' : 'groupBy';
    }

    return type === 'numeric' ? 'metric' : 'groupBy';
  },

  /**
   * Generates suggested questions from the dataset profile.
   */
  suggestQuestions(profile: DatasetProfile): string[] {
    if (!profile || !profile.columns || profile.columns.length === 0) {
      return [
        'Upload a dataset first, then ask about distributions, averages, or correlations.',
        'Try: "Show the distribution of [column_name]"',
        'Try: "What is the average [metric] by [category]?"',
      ];
    }

    const columns = profile.columns;
    const numericCols = columns.filter(c => c.type === 'numeric').map(c => c.name);
    const isAnalyzableDimension = (c: any) => {
      if (c.type === 'numeric') return false;
      if (c.role === 'id') return false;
      const lower = (c.name || '').toLowerCase();
      if (
        lower === 'id' || lower === 'uuid' || lower.includes('guid') ||
        lower.endsWith('_id') || lower.endsWith('_uuid') || lower.endsWith('_key') || lower.endsWith('_hash')
      ) return false;
      if (c.totalCount && c.uniqueCount && c.totalCount > 50 && (c.uniqueCount / c.totalCount) > 0.90) return false;
      return true;
    };
    const catCols = columns.filter(isAnalyzableDimension).map(c => c.name);

    const suggestions: string[] = [];

    // 1. Distribution suggestion
    if (catCols.length > 0) {
      suggestions.push(`Show the distribution of ${catCols[0]}`);
    } else if (numericCols.length > 0) {
      suggestions.push(`Show the distribution of ${numericCols[0]}`);
    }

    // 2. Grouped average suggestion
    if (catCols.length > 0 && numericCols.length > 0) {
      suggestions.push(`Which ${catCols[0]} has the highest average ${numericCols[0]}?`);
    }

    // 3. Correlation suggestion
    if (numericCols.length >= 2) {
      suggestions.push(`Calculate Pearson correlation between ${numericCols[0]} and ${numericCols[1]}`);
    }

    // 4. Feature importance suggestion
    const likelyTarget = columns.find(c => {
      const name = c.name.toLowerCase();
      return name.endsWith('_level') || name.endsWith('_score') || name.endsWith('_label') || name.endsWith('_index') || name === 'target' || name === 'outcome';
    });
    const likelyTargetName = likelyTarget ? likelyTarget.name : (numericCols.length > 0 ? numericCols[numericCols.length - 1] : null);

    if (likelyTargetName) {
      suggestions.push(`What features best predict ${likelyTargetName}?`);
    } else if (numericCols.length > 0) {
      suggestions.push(`What features best predict ${numericCols[0]}?`);
    }

    // 5. Ranking suggestion
    if (catCols.length > 0 && numericCols.length > 0) {
      const catCol = catCols[0];
      const numCol = numericCols[0];
      suggestions.push(`Top 5 ${catCol}s by average ${numCol}`);
    }

    // Fallback if list is too short — use generic suggestions
    while (suggestions.length < 3) {
      if (suggestions.length === 0) suggestions.push('Try asking about a distribution of any column');
      if (suggestions.length === 1) suggestions.push('Try asking about averages grouped by a category');
      if (suggestions.length === 2) suggestions.push('Try asking about correlations between two numeric columns');
    }

    return suggestions.slice(0, 4); // return top 4 suggestions
  },
};
