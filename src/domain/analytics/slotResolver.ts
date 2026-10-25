// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/slotResolver.ts
// S7 SLOT RESOLVER — Extract metric, groupBy, filters, and target (Layer 2).
// ─────────────────────────────────────────────────────────────────────────────

import { DatasetProfile } from '../types/dataset';
import { SemanticResolver } from './semanticResolver';
import { AnalysisIntent, Filter, AnalysisPlan } from './types';

export const SlotResolver = {
  /**
   * Resolves slots (metric, groupBy, filters, target) from the query for a given intent.
   */
  resolve(question: string, intent: AnalysisIntent, profile: DatasetProfile): Partial<AnalysisPlan> {
    const resolvedCols = SemanticResolver.resolve(question, profile);

    const result: Partial<AnalysisPlan> = {
      filters: []
    };

    // 1. Resolve Filters from the query text
    const cleanQ = question.toLowerCase();
    const filterList: Filter[] = [];
    const topLimitMatch = cleanQ.match(/\b(?:top|first)\s+(\d{1,2})\b/);
    const bottomLimitMatch = cleanQ.match(/\bbottom\s+(\d{1,2})\b/);
    const requestedLimit = topLimitMatch?.[1] || bottomLimitMatch?.[1];

    if (requestedLimit) {
      result.limit = Math.min(Math.max(parseInt(requestedLimit, 10), 1), 50);
    }

    // Pattern 1: [column] above/greater than [value]
    const aboveRegex = /(\b[a-z0-9_]+\b)\s*(?:above|greater than|>)\s*(\d+(?:\.\d+)?)/g;
    let match;
    while ((match = aboveRegex.exec(cleanQ)) !== null) {
      const resolved = SemanticResolver.resolve(match[1], profile);
      if (resolved.length > 0) {
        filterList.push({
          column: resolved[0].columnName,
          operator: '>',
          value: parseFloat(match[2])
        });
      }
    }

    // Pattern 2: [column] below/less than [value]
    const belowRegex = /(\b[a-z0-9_]+\b)\s*(?:below|less than|<)\s*(\d+(?:\.\d+)?)/g;
    while ((match = belowRegex.exec(cleanQ)) !== null) {
      const resolved = SemanticResolver.resolve(match[1], profile);
      if (resolved.length > 0) {
        filterList.push({
          column: resolved[0].columnName,
          operator: '<',
          value: parseFloat(match[2])
        });
      }
    }

    // Pattern 3: [column] equals/is [string value] (e.g. "gender equals female", "platform is Instagram")
    const equalRegex = /(\b[a-z0-9_]+\b)\s*(?:equals|equal to|is|=)\s*['"]?([a-z0-9_]+)['"]?/g;
    while ((match = equalRegex.exec(cleanQ)) !== null) {
      const colTerm = match[1];
      const valTerm = match[2];

      // Avoid matching operators/conjunctions as string values
      if (['above', 'below', 'greater', 'less', 'than'].includes(valTerm)) continue;

      const resolved = SemanticResolver.resolve(colTerm, profile);
      if (resolved.length > 0) {
        // Find if the valTerm matches a unique category value in that column (if category)
        const colName = resolved[0].columnName;
        filterList.push({
          column: colName,
          operator: '=',
          value: valTerm
        });
      }
    }

    result.filters = filterList;

    // Filter out columns that are already used in filters to avoid slot collision
    const filterColumns = new Set(filterList.map(f => f.column));
    const availableCols = resolvedCols.filter(c => !filterColumns.has(c.columnName));

    // 2. Intent-Specific Slot Filling
    if (intent === 'feature_importance') {
      // In feature importance, the primary resolved column is the target outcome
      if (availableCols.length > 0) {
        result.target = availableCols[0].columnName;
      }
    } else if (intent === 'correlation') {
      // Correlation needs two numeric metrics
      const numerics = availableCols.filter(c => c.role === 'metric');
      if (numerics.length >= 2) {
        result.metric = numerics[0].columnName;
        result.target = numerics[1].columnName;
      } else if (numerics.length === 1) {
        result.metric = numerics[0].columnName;
      }
    } else if (intent === 'grouped_average' || intent === 'comparison') {
      // Grouped average/comparison needs a metric (numeric) and a groupBy (categorical)
      const numeric = availableCols.find(c => c.role === 'metric');
      const categorical = availableCols.find(c => c.role === 'groupBy');

      if (numeric) {
        result.metric = numeric.columnName;
      }
      if (categorical) {
        result.groupBy = [categorical.columnName];
      }
    } else if (intent === 'ranking') {
      // Ranking needs a metric and a group
      const numeric = availableCols.find(c => c.role === 'metric');
      const categorical = availableCols.find(c => c.role === 'groupBy');

      if (numeric) result.metric = numeric.columnName;
      if (categorical) result.groupBy = [categorical.columnName];
    } else if (intent === 'distribution') {
      // Distribution needs a single column
      if (availableCols.length > 0) {
        result.metric = availableCols[0].columnName;
      }
    } else if (intent === 'filter') {
      // Filter intent's main column
      if (availableCols.length > 0) {
        result.metric = availableCols[0].columnName;
      }
    }

    return result;
  }
};
