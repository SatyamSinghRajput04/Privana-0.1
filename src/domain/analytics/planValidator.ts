// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/planValidator.ts
// S7 PLAN VALIDATOR — Rejects plans with nonexistent columns (Layer 2).
// ─────────────────────────────────────────────────────────────────────────────

import { DatasetProfile } from '../types/dataset';
import { AnalysisPlan } from './types';

export const PlanValidator = {
  /**
   * Validates an AnalysisPlan against the profile schema.
   * Returns a list of error strings. If the list is empty, the plan is valid.
   */
  validate(plan: AnalysisPlan, profile: DatasetProfile): string[] {
    const errors: string[] = [];
    if (!profile || !profile.columns) {
      return ['Dataset schema profile is missing or invalid.'];
    }

    const availableCols = new Set(profile.columns.map(c => c.name.toLowerCase()));

    const checkColumn = (colName: string | undefined, fieldLabel: string) => {
      if (colName && !availableCols.has(colName.toLowerCase())) {
        errors.push(`Column "${colName}" referenced in ${fieldLabel} does not exist in the dataset.`);
      }
    };

    // 1. Validate metric
    checkColumn(plan.metric, 'metric');

    // 2. Validate target
    checkColumn(plan.target, 'target outcome');

    // 3. Validate groupBy columns
    if (plan.groupBy) {
      for (const col of plan.groupBy) {
        checkColumn(col, 'grouping');
      }
    }

    // 4. Validate filters
    if (plan.filters) {
      for (const filter of plan.filters) {
        checkColumn(filter.column, `filter for column "${filter.column}"`);
      }
    }

    // 5. Intent-specific structural validation
    if (plan.intent === 'correlation') {
      if (!plan.metric && !plan.target) {
        errors.push('Correlation analysis requires at least one resolved column.');
      }
    } else if (plan.intent === 'feature_importance') {
      if (!plan.target) {
        errors.push('Feature importance analysis requires a target outcome column.');
      }
    } else if (plan.intent === 'grouped_average') {
      if (!plan.metric) {
        errors.push('Grouped average analysis requires a numeric metric.');
      }
    }

    return errors;
  }
};
