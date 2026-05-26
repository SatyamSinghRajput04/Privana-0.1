// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/schemaIntelligence.ts
// S4 SCHEMA INTELLIGENCE — Alias map, role inference, and question suggestions.
// ─────────────────────────────────────────────────────────────────────────────

import { ColumnResolver } from '../resolver/resolver';
import { DatasetProfile } from '../types/dataset';
import { ColumnMatch, ColumnRole, AnalysisIntent } from './types';

export const SchemaIntelligence = {
  /**
   * Resolves a raw user phrase to a matching column in the dataset profile,
   * returning ranked confidence and a default role.
   */
  resolveColumn(phrase: string, profile: DatasetProfile): ColumnMatch | null {
    if (!profile || !profile.columns) return null;

    const match = ColumnResolver.resolve(phrase, profile);
    if (!match) return null;

    // Infer default role based on column type
    let role: ColumnRole = 'metric';
    const colName = match.columnName.toLowerCase();

    if (colName === 'id' || colName.endsWith('_id') || colName === 'uid') {
      role = 'id';
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
   * Infers the role of a column given the analysis intent.
   */
  inferRole(columnName: string, intent: AnalysisIntent, profile?: DatasetProfile): ColumnRole {
    const colName = columnName.toLowerCase();
    
    if (colName === 'id' || colName.endsWith('_id') || colName === 'uid') {
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
        'Show the distribution of depression_label',
        'Which social media platform has the highest average anxiety_level?',
        'Calculate Pearson correlation between sleep_hours and stress_level',
      ];
    }

    const columns = profile.columns;
    const numericCols = columns.filter(c => c.type === 'numeric').map(c => c.name);
    const catCols = columns.filter(c => c.type !== 'numeric' && c.name.toLowerCase() !== 'id').map(c => c.name);

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
    const depressionCol = columns.find(c => c.name.toLowerCase().includes('depression') || c.name.toLowerCase().includes('stress'));
    if (depressionCol) {
      suggestions.push(`What features best predict ${depressionCol.name}?`);
    } else if (numericCols.length > 0) {
      suggestions.push(`What features best predict ${numericCols[0]}?`);
    }

    // 5. Ranking suggestion
    if (catCols.length > 0 && numericCols.length > 0) {
      const catCol = catCols[0];
      const numCol = numericCols[0];
      suggestions.push(`Top 5 ${catCol}s by average ${numCol}`);
    }

    // Fallback if list is too short
    while (suggestions.length < 3) {
      suggestions.push('Show the distribution of depression_label');
      suggestions.push('Which social media platform has the highest average anxiety_level?');
    }

    return suggestions.slice(0, 4); // return top 4 suggestions
  },
};
