import { AnalyticsResult, SUPPORTED_INTENTS } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
    passed++;
  } else {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    failed++;
  }
}

const mockProvenance = {
  question: 'Test question?',
  planGeneratedAt: new Date(),
  executionTimeMs: 15,
  plannerAttempts: 1,
};

const mockPlan = {
  planId: 'plan_1',
  intent: 'summary' as const,
  confidence: 0.95,
  source: 'pattern' as const,
};

const mockExecutorResult = {
  status: 'success' as const,
  rows: [{ count: 100 }],
};

const mockChart = {
  chartType: 'none' as const,
};

function runTypesTests() {
  console.log('\n--- 📝 Running Analytics Q&A Contract Types Tests ---');

  // Verify supported intents array
  assert(SUPPORTED_INTENTS.includes('summary'), 'SUPPORTED_INTENTS contains "summary"');
  assert(SUPPORTED_INTENTS.includes('distribution'), 'SUPPORTED_INTENTS contains "distribution"');
  assert(SUPPORTED_INTENTS.includes('grouped_average'), 'SUPPORTED_INTENTS contains "grouped_average"');
  assert(SUPPORTED_INTENTS.includes('correlation'), 'SUPPORTED_INTENTS contains "correlation"');
  assert(SUPPORTED_INTENTS.includes('feature_importance'), 'SUPPORTED_INTENTS contains "feature_importance"');
  assert(SUPPORTED_INTENTS.includes('ranking'), 'SUPPORTED_INTENTS contains "ranking"');
  assert(SUPPORTED_INTENTS.includes('filter'), 'SUPPORTED_INTENTS contains "filter"');
  assert(SUPPORTED_INTENTS.includes('comparison'), 'SUPPORTED_INTENTS contains "comparison"');
  assert(SUPPORTED_INTENTS.length === 8, 'SUPPORTED_INTENTS length is 8');

  // Computed result
  const computedRes: AnalyticsResult = {
    status: 'computed',
    plan: mockPlan,
    data: mockExecutorResult,
    chart: mockChart,
    narrative: 'Found 100 records.',
    provenance: mockProvenance,
  };
  assert(computedRes.status === 'computed', 'Can construct a valid computed result');

  // Partial result
  const partialRes: AnalyticsResult = {
    status: 'partial',
    plan: mockPlan,
    data: {
      status: 'partial_small_n',
      rows: [{ count: 4 }],
    },
    chart: mockChart,
    narrative: 'Result computed with limited sample size.',
    reasons: ['Sample size is small (n < 5)'],
    provenance: mockProvenance,
  };
  assert(partialRes.status === 'partial' && partialRes.reasons[0].includes('small'), 'Can construct a valid partial result');

  // Clarify result
  const clarifyRes: AnalyticsResult = {
    status: 'clarify',
    clarification: {
      message: 'I can analyze this in multiple ways.',
      choices: [
        {
          label: 'Analyze sleep hours',
          plan: { ...mockPlan, metric: 'sleep_hours' },
          question: 'Average sleep hours?',
        },
      ],
    },
    provenance: mockProvenance,
  };
  assert(clarifyRes.status === 'clarify' && clarifyRes.clarification.choices[0].label === 'Analyze sleep hours', 'Can construct a valid clarify result');

  // Blocked result
  const blockedRes: AnalyticsResult = {
    status: 'blocked',
    reason: 'Dataset is empty.',
    provenance: mockProvenance,
  };
  assert(blockedRes.status === 'blocked' && blockedRes.reason.includes('empty'), 'Can construct a valid blocked result');

  // Unsupported result
  const unsupportedRes: AnalyticsResult = {
    status: 'unsupported',
    explanation: 'Timeseries trend analysis is not supported.',
    suggestedQuestions: ['What platform is most popular?'],
    provenance: mockProvenance,
  };
  assert(unsupportedRes.status === 'unsupported' && unsupportedRes.suggestedQuestions.length === 1, 'Can construct a valid unsupported result');

  // Refused result
  const refusedRes: AnalyticsResult = {
    status: 'refused',
    errors: ['Column "stress" does not exist in dataset.'],
    provenance: mockProvenance,
  };
  assert(refusedRes.status === 'refused' && refusedRes.errors[0].includes('exist'), 'Can construct a valid refused result');

  // Error result
  const errorRes: AnalyticsResult = {
    status: 'error',
    message: 'Failed due to internal logic error.',
    debugId: 'dbg_999',
    provenance: mockProvenance,
  };
  assert(errorRes.status === 'error' && errorRes.debugId === 'dbg_999', 'Can construct a valid error result');
}

try {
  runTypesTests();
  console.log(`\nTypes tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
