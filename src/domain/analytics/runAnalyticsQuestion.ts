// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/runAnalyticsQuestion.ts
// S9 ORCHESTRATOR — Main pipeline planning, validation, execution & narative compiler.
// ─────────────────────────────────────────────────────────────────────────────

import { validateDatasetSafety } from '../safeCompute/preflight';
import { IntentPlanner } from './intentPlanner';
import { SlotResolver } from './slotResolver';
import { PlanValidator } from './planValidator';
import { SchemaIntelligence } from './schemaIntelligence';
import { SemanticResolver } from './semanticResolver';
import { AnalyticsResult, AnalysisPlan, ExecutorResult, ChartSpec, ClarificationChoice, SUPPORTED_INTENTS } from './types';

// Executors
import { SummaryExecutor } from './executors/summary';
import { DistributionExecutor } from './executors/distribution';
import { GroupedAverageExecutor } from './executors/groupedAverage';
import { CorrelationExecutor } from './executors/correlation';
import { FeatureImportanceExecutor } from './executors/featureImportance';
import { RankingExecutor } from './executors/ranking';
import { FilterExecutor } from './executors/filter';
import { ComparisonExecutor } from './executors/comparison';

interface AnalyticsContext {
  tableName: string;
  rows: any[];
  profile: any;
}

/**
 * Orchestrator entry point that routes a user question to the correct terminal state.
 */
export async function runAnalyticsQuestion(question: string, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const startTime = Date.now();
  const tableName = ctx.tableName;
  const rows = ctx.rows;
  const profile = ctx.profile;

  const buildProvenance = () => ({
    question,
    planGeneratedAt: new Date(),
    executionTimeMs: Date.now() - startTime,
    plannerAttempts: 1,
  });

  // 1. Run Preflight Safety Checks
  const safetyBlock = validateDatasetSafety(rows, tableName);
  if (safetyBlock) {
    return {
      status: 'blocked',
      reason: safetyBlock.reason,
      provenance: buildProvenance(),
    };
  }

  try {
    // 1.5 Advanced Unsupported Intent Check (Layer A)
    const qLower = question.toLowerCase();
    const advancedKeywords = [
      'logistic regression', 'clustering', 'cluster', 'anomaly detection', 'anomalies',
      'heatmap', 'correlation matrix', 'probability prediction', 'actionable insights'
    ];
    const matchedKeyword = advancedKeywords.find(kw => qLower.includes(kw));
    if (matchedKeyword) {
      return {
        status: 'unsupported',
        explanation: `Privana does not support ${matchedKeyword} in this MVP yet. I can compute feature importance, correlations, distributions, rankings, and grouped averages.`,
        suggestedQuestions: SchemaIntelligence.suggestQuestions(profile),
        provenance: buildProvenance(),
      };
    }

    // 2. Classify Intent (Layer 1)
    const plannedIntent = IntentPlanner.plan(question, profile);

    // 3. Resolve Slots (Layer 2)
    const resolvedSlots = SlotResolver.resolve(question, plannedIntent.intent, profile);

    // 4. Compile Analysis Plan
    const plan: AnalysisPlan = {
      planId: `plan_${plannedIntent.intent}_${Date.now()}`,
      intent: plannedIntent.intent,
      metric: resolvedSlots.metric,
      groupBy: resolvedSlots.groupBy,
      filters: resolvedSlots.filters,
      target: resolvedSlots.target,
      limit: resolvedSlots.limit,
      confidence: plannedIntent.confidence,
      source: 'pattern',
    };

    // 4.5 Validate resolved intent is in SUPPORTED_INTENTS (Layer B allowlist enforcement)
    if (!SUPPORTED_INTENTS.includes(plan.intent)) {
      return {
        status: 'unsupported',
        explanation: `I couldn't identify a supported query format for "${question}". Try asking about distributions, averages, or correlations.`,
        suggestedQuestions: SchemaIntelligence.suggestQuestions(profile),
        provenance: buildProvenance(),
      };
    }

    // 5. Validate Plan Schema
    const validationErrors = PlanValidator.validate(plan, profile);
    if (validationErrors.length > 0) {
      const missingColumns = SemanticResolver.findMissingColumns(question, profile);
      if (missingColumns.length > 0) {
        const allSuggestions: string[] = [];
        for (const missingCol of missingColumns) {
          const colSugs = SchemaIntelligence.getSimilarColumns(missingCol, profile);
          allSuggestions.push(...colSugs);
        }
        const uniqueSuggestions = Array.from(new Set(allSuggestions));

        return {
          status: 'refused',
          errors: validationErrors,
          reason: 'missing_column',
          missing: missingColumns,
          message: `Missing column: ${missingColumns.join(', ')}. This column is not present in the loaded dataset.`,
          suggestions: uniqueSuggestions,
          provenance: buildProvenance(),
        };
      }
      return {
        status: 'refused',
        errors: validationErrors,
        provenance: buildProvenance(),
      };
    }

    // 6. Route by Planner Confidence
    if (plan.confidence < 0.60) {
      return {
        status: 'unsupported',
        explanation: `I couldn't identify a supported query format for "${question}". Try asking about distributions, averages, or correlations.`,
        suggestedQuestions: SchemaIntelligence.suggestQuestions(profile),
        provenance: buildProvenance(),
      };
    }

    if (plan.confidence >= 0.60 && plan.confidence < 0.85) {
      // Clarify state
      const choices: ClarificationChoice[] = [
        {
          label: `Compute distribution of ${plan.metric || 'depression_label'}`,
          plan: { ...plan, intent: 'distribution' as const, confidence: 0.95 },
          question: `Show the distribution of ${plan.metric || 'depression_label'}`,
        },
      ];
      if (plan.metric && plan.groupBy && plan.groupBy.length > 0) {
        choices.push({
          label: `Calculate average ${plan.metric} grouped by ${plan.groupBy[0]}`,
          plan: { ...plan, intent: 'grouped_average' as const, confidence: 0.95 },
          question: `Which ${plan.groupBy[0]} has the highest average ${plan.metric}?`,
        });
      }
      return {
        status: 'clarify',
        clarification: {
          message: 'I can analyze this in a few ways. Please select a path below:',
          choices,
        },
        provenance: buildProvenance(),
      };
    }

    // 7. Dispatch to Executor
    let execResult: ExecutorResult;

    switch (plan.intent) {
      case 'summary':
        execResult = SummaryExecutor.execute(plan, rows);
        break;
      case 'distribution':
        execResult = DistributionExecutor.execute(plan, rows);
        break;
      case 'grouped_average':
        execResult = GroupedAverageExecutor.execute(plan, rows);
        break;
      case 'correlation':
        execResult = CorrelationExecutor.execute(plan, rows);
        break;
      case 'feature_importance':
        execResult = FeatureImportanceExecutor.execute(plan, rows);
        break;
      case 'ranking':
        execResult = RankingExecutor.execute(plan, rows);
        break;
      case 'filter':
        execResult = FilterExecutor.execute(plan, rows);
        break;
      case 'comparison':
        execResult = ComparisonExecutor.execute(plan, rows);
        break;
      default:
        return {
          status: 'unsupported',
          explanation: `The intent "${plan.intent}" is not supported.`,
          suggestedQuestions: SchemaIntelligence.suggestQuestions(profile),
          provenance: buildProvenance(),
        };
    }

    if (execResult.status === 'partial_missing') {
      return {
        status: 'blocked',
        reason: execResult.metadata?.reason || 'The query could not be executed due to missing or invalid data records.',
        provenance: buildProvenance(),
      };
    }

    // 8. Compile Narrative & Chart Spec
    const chartSpec: ChartSpec = { chartType: 'none' };
    let narrative = '';

    if (plan.intent === 'distribution') {
      chartSpec.chartType = 'bar';
      chartSpec.xAxisKey = execResult.metadata?.isNumeric ? 'binLabel' : 'category_label';
      chartSpec.yAxisKey = 'count';
      chartSpec.title = `Distribution of ${plan.metric}`;

      const total = execResult.rows.reduce((sum, r) => sum + r.count, 0);
      narrative = `Here is the distribution of **${plan.metric}** across ${total} total records. `;
      if (execResult.metadata?.isNumeric) {
        narrative += `The values range from ${execResult.rows[0]?.minVal} to ${execResult.rows[execResult.rows.length - 1]?.maxVal}.`;
      } else {
        const topCat = [...execResult.rows].sort((a, b) => b.count - a.count)[0];
        if (topCat) {
          narrative += `The most frequent category is **${topCat.category_label}** with ${topCat.count} occurrences.`;
        }
      }
    } else if (plan.intent === 'grouped_average') {
      chartSpec.chartType = 'bar';
      chartSpec.xAxisKey = 'category_label';
      chartSpec.yAxisKey = 'average_value';
      chartSpec.title = `Average ${plan.metric} by ${plan.groupBy?.[0]}`;

      const topGroup = execResult.rows[0];
      if (topGroup) {
        narrative = `Calculated average **${plan.metric}** grouped by **${plan.groupBy?.[0]}**. **${topGroup.category_label}** has the highest average value of **${topGroup.average_value.toFixed(2)}** (n = ${topGroup.count}).`;
      } else {
        narrative = `Calculated average **${plan.metric}** grouped by **${plan.groupBy?.[0]}**.`;
      }
    } else if (plan.intent === 'correlation') {
      const stats = execResult.rows[0];
      chartSpec.chartType = stats?.method === 'Point-Biserial' ? 'bar' : 'scatter';
      chartSpec.xAxisKey = plan.metric;
      chartSpec.yAxisKey = plan.target;
      chartSpec.title = `${stats?.method} Correlation`;

      if (stats) {
        const correlationStr = stats.r.toFixed(3);
        const strength = Math.abs(stats.r) > 0.7 ? 'strong' : Math.abs(stats.r) > 0.4 ? 'moderate' : 'weak';
        const direction = stats.r > 0 ? 'positive' : 'negative';
        narrative = `Computed **${stats.method}** correlation between **${plan.metric}** and **${plan.target}**. Found a **${strength} ${direction} correlation** of **${correlationStr}** (p = ${stats.pValue.toFixed(4)}, sample size = ${stats.sampleSize}).`;
      }
    } else if (plan.intent === 'feature_importance') {
      chartSpec.chartType = 'bar';
      chartSpec.xAxisKey = 'feature';
      chartSpec.yAxisKey = 'association';
      chartSpec.title = `Feature Associations with ${plan.target}`;

      const topPred = execResult.rows[0];
      if (topPred) {
        narrative = `Computed ranked associations with target outcome **${plan.target}**. The strongest predictor is **${topPred.feature}** with a association strength of **${topPred.association.toFixed(3)}** using method ${topPred.method}.`;
      } else {
        narrative = `Computed ranked associations with target outcome **${plan.target}**.`;
      }
    } else if (plan.intent === 'ranking') {
      const limit = execResult.metadata?.limit || plan.limit || 5;
      chartSpec.chartType = 'bar';
      chartSpec.xAxisKey = execResult.metadata?.isGrouped ? 'category_label' : 'rank_label';
      chartSpec.yAxisKey = execResult.metadata?.isGrouped ? 'average_value' : 'metric_value';
      chartSpec.title = `Top ${limit} ranking of ${plan.metric}`;

      narrative = `Here are the top ${limit} ranked entries by **${plan.metric}**. `;
      if (execResult.rows[0]) {
        const topLabel = execResult.metadata?.isGrouped
          ? execResult.rows[0].category_label
          : execResult.rows[0].id || execResult.rows[0].rank_label || `${plan.metric} = ${execResult.rows[0].metric_value}`;
        narrative += `The top rank belongs to **${topLabel}**.`;
      }
    } else if (plan.intent === 'filter') {
      chartSpec.chartType = 'none';
      narrative = `Applied filter criteria. Found **${execResult.rows.length}** records matching the criteria.`;
    } else if (plan.intent === 'comparison') {
      chartSpec.chartType = 'bar';
      chartSpec.xAxisKey = 'group_label';
      chartSpec.yAxisKey = 'mean';
      chartSpec.title = `Comparison of ${plan.metric} across ${plan.groupBy?.[0]}`;

      narrative = `Compared **${plan.metric}** across categories of **${plan.groupBy?.[0]}**. `;
      const sorted = [...execResult.rows].sort((a, b) => b.mean - a.mean);
      if (sorted.length >= 2) {
        const diff = sorted[0].mean - sorted[sorted.length - 1].mean;
        narrative += `**${sorted[0].group_label}** averages **${sorted[0].mean.toFixed(2)}** vs **${sorted[sorted.length - 1].group_label}** at **${sorted[sorted.length - 1].mean.toFixed(2)}** (difference of **${diff.toFixed(2)}**).`;
      }
    } else {
      narrative = `Successfully compiled descriptive statistics overview.`;
    }

    const finalStatus = execResult.status === 'partial_small_n' ? 'partial' : 'computed';

    if (finalStatus === 'partial') {
      return {
        status: 'partial',
        plan,
        data: execResult,
        chart: chartSpec,
        narrative,
        reasons: ['Some groups contain fewer than 5 records. Frequencies or statistics for these groups might be suppressed or unreliable.'],
        provenance: buildProvenance(),
      };
    }

    return {
      status: 'computed',
      plan,
      data: execResult,
      chart: chartSpec,
      narrative,
      provenance: buildProvenance(),
    };

  } catch (err: any) {
    return {
      status: 'error',
      message: err.message || 'An internal pipeline panic occurred.',
      debugId: `err_${Date.now()}`,
      provenance: buildProvenance(),
    };
  }
}
