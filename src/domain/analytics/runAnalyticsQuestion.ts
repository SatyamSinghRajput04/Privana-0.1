// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/runAnalyticsQuestion.ts
// S9 ORCHESTRATOR — Main pipeline planning, validation, execution & narative compiler.
// ─────────────────────────────────────────────────────────────────────────────

import { validateDatasetSafety, METADATA_SIGNALS } from '../safeCompute/preflight';
import { IntentPlanner } from './intentPlanner';
import { SlotResolver } from './slotResolver';
import { PlanValidator } from './planValidator';
import { SchemaIntelligence } from './schemaIntelligence';
import { SemanticResolver } from './semanticResolver';
import { AnalyticsResult, AnalysisPlan, ExecutorResult, ChartSpec, ClarificationChoice, SUPPORTED_INTENTS } from './types';

import { mapToVisualContract } from './resultToVisualContext';
import { useCockpitStore } from '../../store/useCockpitStore';

// Executors
import { SummaryExecutor } from './executors/summary';
import { DistributionExecutor } from './executors/distribution';
import { DataSource, computeEngine } from '../compute';
import { DUCKDB_TABLES, DUCKDB_ROW_COUNTS, getSqlTableName } from '../../lib/sqlEngine';
import { GroupedAverageExecutor } from './executors/groupedAverage';
import { CorrelationExecutor } from './executors/correlation';
import { FeatureImportanceExecutor } from './executors/featureImportance';
import { RankingExecutor } from './executors/ranking';
import { FilterExecutor } from './executors/filter';
import { ComparisonExecutor } from './executors/comparison';

export interface AnalyticsContext {
  tableName: string;
  rows: any[];
  profile: any;
  bypassMetadataCheck?: boolean;
  minRowCount?: number;
  /**
   * True row count of the dataset, when `rows` is a representative sample
   * (see getTableRows in sqlEngine.ts) rather than the full table. Used to
   * report accurate totals (e.g. summary record counts) even when the
   * pipeline computed on a sample for performance.
   */
  totalRowCount?: number;
  /**
   * Run id captured by the caller (via useCockpitStore.getState().startNewRun()) when the
   * question was dispatched. Committing with this instead of re-reading
   * currentRunId lets the store's Latest-Wins check catch a commit from a superseded run.
   */
  runId?: number;
}

/**
 * Orchestrator entry point that routes a user question to the correct terminal state.
 */
export const METADATA_BYPASS_WARNING = 'This dataset appears to be a metadata/schema descriptor file. The calculated results below might not be statistically meaningful.';

const HARD_FLOOR: Record<string, number> = {
  summary: 1,
  distribution: 1,
  grouped_average: 1,
  correlation: 3,
  feature_importance: 3,
  ranking: 1,
  filter: 1,
  comparison: 3,
};

const INTENT_LABELS: Record<string, string> = {
  summary: 'summary',
  distribution: 'distribution',
  grouped_average: 'grouped average',
  correlation: 'correlation',
  feature_importance: 'feature importance',
  ranking: 'ranking',
  filter: 'filter',
  comparison: 'comparison',
};

/**
 * Orchestrator entry point that routes a user question to the correct terminal state.
 */
export async function runAnalyticsQuestion(question: string, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const startTime = Date.now();
  const tableName = ctx.tableName;
  const rows = ctx.rows;
  const profile = ctx.profile;

  const sqlTable = tableName ? getSqlTableName(tableName) : '';
  const isDuckDB = Boolean(sqlTable && DUCKDB_TABLES.has(sqlTable));
  const totalLoaded = isDuckDB ? (DUCKDB_ROW_COUNTS.get(sqlTable) || ctx.totalRowCount || rows.length) : (ctx.totalRowCount || rows.length);

  const buildProvenance = (customStatus?: 'success' | 'partial' | 'failed', eligibleRowsCount?: number) => ({
    question,
    planGeneratedAt: new Date(),
    executionTimeMs: Date.now() - startTime,
    plannerAttempts: 1,
    engine: isDuckDB ? ('duckdb-wasm' as const) : ('in-memory' as const),
    scope: isDuckDB ? ('full-dataset' as const) : ('sampled' as const),
    datasetId: tableName,
    totalLoadedRows: totalLoaded,
    eligibleRows: eligibleRowsCount !== undefined ? eligibleRowsCount : totalLoaded,
    executedAtIso: new Date().toISOString(),
    status: customStatus || 'success'
  });

  // ─────────────────────────────────────────────────────────────
  // ORDER IS LOAD-BEARING. DO NOT REORDER THESE BLOCKS.
  //   1. preflight (metadata + non-empty)
  //   2. intent resolution
  //   3. confidence gate (clarify / unsupported)
  //   4. intent row-floor (effectiveMin)
  //   5. post-bypass:
  //      (a) zero-numeric/zero-categorical -> hard block
  //      (b) METADATA_SIGNALS re-scan -> partial warning
  //   6. try/catch { executor dispatch }
  // ─────────────────────────────────────────────────────────────

  // STEP 1 — Preflight
  const safetyBlock = validateDatasetSafety(rows, tableName, {
    allowMetadataBypass: ctx.bypassMetadataCheck
  });
  if (safetyBlock) {
    return {
      status: 'blocked',
      reason: safetyBlock.reason,
      bypassAllowed: safetyBlock.bypassAllowed ?? false,
      provenance: buildProvenance(),
    };
  }

  try {
    // 1.5 Advanced Unsupported Intent Check (Layer A)
    const qLower = question.toLowerCase();
    const advancedKeywords = [
      'logistic regression', 'clustering', 'cluster', 'anomaly detection', 'anomalies',
      'heatmap', 'correlation matrix', 'probability prediction', 'actionable insights',
      'trend', 'over time', 'time series', 'time-series', 'monthly', 'weekly', 'daily', 'yearly'
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

    // STEP 2 — Resolve Columns Semantically & Classify Intent
    const resolvedCols = SemanticResolver.resolve(question, profile);
    const plannedIntent = IntentPlanner.plan(question, profile, resolvedCols);
    const resolvedSlots = SlotResolver.resolve(question, plannedIntent.intent, profile);

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
      _originalQuestion: question,
    } as AnalysisPlan & { _originalQuestion: string };

    // STEP 3 — Confidence Gate & Validation
    if (!SUPPORTED_INTENTS.includes(plan.intent)) {
      return {
        status: 'unsupported',
        explanation: `I couldn't identify a supported query format for "${question}". Try asking about distributions, averages, or correlations.`,
        suggestedQuestions: SchemaIntelligence.suggestQuestions(profile),
        provenance: buildProvenance(),
      };
    }

    // Hoist zero-column check to run before missing columns/plan validation
    const numNumeric = profile.columns.filter((c: any) => c.type === 'numeric').length;
    const numCategorical = profile.columns.filter((c: any) => c.type === 'category' || c.type === 'text' || c.type === 'boolean').length;
    if (numNumeric === 0 && numCategorical === 0) {
      return {
        status: 'blocked',
        reason: 'This dataset does not appear to contain any analyzable numeric or categorical columns.',
        provenance: buildProvenance(),
      };
    }

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
        errors: [`Column "${missingColumns.join(', ')}" does not exist in the dataset.`],
        reason: 'missing_column',
        missing: missingColumns,
        message: `Missing column: ${missingColumns.join(', ')}. This column is not present in the loaded dataset.`,
        suggestions: uniqueSuggestions,
        provenance: buildProvenance(),
      };
    }

    const validationErrors = PlanValidator.validate(plan, profile);
    if (validationErrors.length > 0) {
      return {
        status: 'refused',
        errors: validationErrors,
        provenance: buildProvenance(),
      };
    }

    if (plan.confidence < 0.60) {
      return {
        status: 'unsupported',
        explanation: `I couldn't identify a supported query format for "${question}". Try asking about distributions, averages, or correlations.`,
        suggestedQuestions: SchemaIntelligence.suggestQuestions(profile),
        provenance: buildProvenance(),
      };
    }

    if (plan.confidence >= 0.60 && plan.confidence < 0.85) {
      // Clarify state: build dynamic choices based on what was resolved.
      // Fall back to the first numeric column in the profile (not a hardcoded field name).
      const firstNumericCol = profile?.columns?.find((c: any) => c.type === 'numeric')?.name;
      const clarifyMetric = plan.metric || firstNumericCol || 'a numeric column';
      const clarifyGroupBy = plan.groupBy?.[0] || profile?.columns?.find((c: any) => c.type === 'category' || c.type === 'text')?.name;

      const choices: ClarificationChoice[] = [
        {
          label: `Compute distribution of ${clarifyMetric}`,
          plan: { ...plan, intent: 'distribution' as const, metric: plan.metric || firstNumericCol, confidence: 0.95 },
          question: `Show the distribution of ${clarifyMetric}`,
        },
      ];
      if (clarifyMetric && clarifyGroupBy) {
        choices.push({
          label: `Calculate average ${clarifyMetric} grouped by ${clarifyGroupBy}`,
          plan: { ...plan, intent: 'grouped_average' as const, metric: plan.metric || firstNumericCol, groupBy: plan.groupBy?.length ? plan.groupBy : [clarifyGroupBy], confidence: 0.95 },
          question: `Which ${clarifyGroupBy} has the highest average ${clarifyMetric}?`,
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

    // STEP 4 — Intent-specific row floor (RAISE-ONLY: config can tighten, never breach the math floor)
    const effectiveMin = Math.max(
      HARD_FLOOR[plan.intent] ?? 1,
      ctx.minRowCount ?? 0
    );

    if (rows.length < effectiveMin) {
      const label = INTENT_LABELS[plan.intent] ?? plan.intent;
      return {
        status: 'blocked',
        reason: `This query requires at least ${effectiveMin} rows of data to perform a mathematically valid ${label} analysis. This dataset only contains ${rows.length} rows.`,
        provenance: buildProvenance(),
      };
    }

    // STEP 5 — Post-bypass checks
    let isMetadataWarningNeeded = false;
    if (ctx.bypassMetadataCheck) {
      // (a) zero-numeric/zero-categorical -> hard block
      const numNumeric = profile.columns.filter((c: any) => c.type === 'numeric').length;
      const numCategorical = profile.columns.filter((c: any) => c.type === 'category' || c.type === 'text' || c.type === 'boolean').length;
      if (numNumeric === 0 && numCategorical === 0) {
        return {
          status: 'blocked',
          reason: 'This dataset does not appear to contain any analyzable numeric or categorical columns.',
          provenance: buildProvenance(),
        };
      }

      // (b) METADATA_SIGNALS re-scan -> set warning flag
      const firstRow = rows[0];
      if (firstRow && typeof firstRow === 'object') {
        const keys = Object.keys(firstRow);
        const found = METADATA_SIGNALS.filter(sig => keys.includes(sig));
        if (found.length >= 2) {
          isMetadataWarningNeeded = true;
        }
      }
    }

    // STEP 5.5 — Intent-aware row capping.
    // Distribution/grouped_average/ranking/comparison/filter are single O(n)
    // passes and stay exact on the full dataset even at 1M+ rows — sampling
    // them trades correctness for a speedup they don't need (this is what
    // was producing "Total Records: 50000" on a 200,000-row dataset).
    // Correlation and feature_importance do per-row pairwise statistics
    // across every column and are the intents that actually caused the
    // multi-second main-thread freeze on very large datasets, so only those
    // (plus summary, which sorts every numeric column) get capped.
    const ROW_HEAVY_INTENTS = new Set(['correlation', 'feature_importance', 'summary']);
    const ANALYSIS_ROW_CAP = 50_000;
    let execRows = rows;
    if (ROW_HEAVY_INTENTS.has(plan.intent) && rows.length > ANALYSIS_ROW_CAP) {
      const reservoir = rows.slice(0, ANALYSIS_ROW_CAP);
      for (let i = ANALYSIS_ROW_CAP; i < rows.length; i++) {
        const j = Math.floor(Math.random() * (i + 1));
        if (j < ANALYSIS_ROW_CAP) reservoir[j] = rows[i];
      }
      execRows = reservoir;
    }

    // STEP 6 — Table-First / In-Memory DataSource derivation & Executor dispatch
    const sqlTable = tableName ? getSqlTableName(tableName) : '';
    const isDuckDB = sqlTable ? DUCKDB_TABLES.has(sqlTable) : false;
    const dataSource: DataSource = isDuckDB
      ? { kind: 'duckdb-table', tableName: sqlTable }
      : { kind: 'in-memory-rows', rows: execRows };

    let execResult: ExecutorResult;
    try {
      switch (plan.intent) {
        case 'summary':
          execResult = SummaryExecutor.execute(plan, execRows);
          break;
        case 'distribution':
          execResult = await DistributionExecutor.execute(plan, dataSource, computeEngine);
          break;
        case 'grouped_average':
          execResult = await GroupedAverageExecutor.execute(plan, dataSource, computeEngine);
          break;
        case 'correlation':
          execResult = await CorrelationExecutor.execute(plan, dataSource, computeEngine);
          break;
        case 'feature_importance':
          execResult = FeatureImportanceExecutor.execute(plan, execRows);
          break;
        case 'ranking':
          execResult = await RankingExecutor.execute(plan, dataSource, computeEngine);
          break;
        case 'filter':
          execResult = FilterExecutor.execute(plan, execRows);
          break;
        case 'comparison':
          execResult = ComparisonExecutor.execute(plan, execRows);
          break;
        default:
          return {
            status: 'unsupported',
            explanation: `The intent "${plan.intent}" is not supported.`,
            suggestedQuestions: SchemaIntelligence.suggestQuestions(profile),
            provenance: buildProvenance(),
          };
      }
    } catch (err: any) {
      console.error('[runAnalyticsQuestion] Executor execution failed:', err?.message || err);
      return {
        status: 'blocked',
        reason: 'This file could not be analyzed as data. Please check the columns and data rows.',
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

    // When rows is a representative sample (large dataset), report the true
    // total record count instead of the sampled length.
    if (plan.intent === 'summary' && ctx.totalRowCount !== undefined && execResult.metadata) {
      execResult.metadata.rowCount = ctx.totalRowCount;
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
    } else if (plan.intent === 'summary') {
      chartSpec.chartType = 'none';
      const metricText = plan.metric ? `**${plan.metric}**` : 'total records';
      const totalCount = (execResult.metadata?.rowCount || rows.length).toLocaleString();
      narrative = `Analyzed dataset **${tableName}**. Total count for ${metricText} is **${totalCount}**.`;
    } else {
      narrative = `Successfully compiled descriptive statistics overview.`;
    }

    const reasons: string[] = [];
    if (execResult.status === 'partial_small_n') {
      reasons.push('Some groups contain fewer than 5 records. Frequencies or statistics for these groups might be suppressed or unreliable.');
    }
    if (isMetadataWarningNeeded) {
      reasons.push(METADATA_BYPASS_WARNING);
    }

    const eligibleCount = execResult.metadata?.totalEligibleRows ?? totalLoaded;
    const finalResult: AnalyticsResult = reasons.length > 0 ? {
      status: 'partial',
      plan,
      data: execResult,
      chart: chartSpec,
      narrative,
      reasons,
      provenance: buildProvenance('partial', eligibleCount),
    } : {
      status: 'computed',
      plan,
      data: execResult,
      chart: chartSpec,
      narrative,
      provenance: buildProvenance('success', eligibleCount),
    };

    try {
      const visualContract = mapToVisualContract(finalResult);
      if (visualContract) {
        const runId = ctx.runId ?? useCockpitStore.getState().currentRunId;
        useCockpitStore.getState().commitResult(runId, visualContract, plan.planId);
      }
    } catch (commitErr) {
      console.warn('Failed to commit visual contract to cockpit store:', commitErr);
    }

    return finalResult;

  } catch (err: any) {
    return {
      status: 'error',
      message: err.message || 'An internal pipeline panic occurred.',
      debugId: `err_${Date.now()}`,
      provenance: buildProvenance(),
    };
  }
}
