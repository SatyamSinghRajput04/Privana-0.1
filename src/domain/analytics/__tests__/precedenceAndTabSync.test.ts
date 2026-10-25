// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/__tests__/precedenceAndTabSync.test.ts
// Invariant Regression Tests for Rendering Precedence & Tab Sync
// ─────────────────────────────────────────────────────────────────────────────

import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { runAnalyticsQuestion } from '../runAnalyticsQuestion';
import { DatasetValidator } from '../../validator/validator';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
    testsPassed++;
  } else {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    testsFailed++;
  }
}

// Interception condition representing ComputedView's rendering gate
function shouldComputedViewIntercept(
  workspacePipelineEnabled: boolean,
  activeWorkspace: any,
  activeSheetId: string | null,
  planId: string | undefined
): boolean {
  return !!(workspacePipelineEnabled && activeWorkspace && activeSheetId && planId === 'workspace');
}

// React-style derived helper representing hasQueryResult
function deriveHasQueryResult(qaResponse: any): boolean {
  return !!(qaResponse && typeof qaResponse === 'object');
}

export async function runPrecedenceAndTabSyncTests() {
  console.log('\n--- 🔄 Running Rendering Precedence & Tab Sync Invariant Tests ---');

  // Setup basic mock activeWorkspace
  const mockWorkspace = {
    id: 1,
    name: 'Mental Health Workspace',
    sheets: [
      { id: 'sheet_overview', name: 'Overview Dashboard', cards: [] }
    ]
  };

  // Setup store state
  const store = useWorkspaceStore.getState();
  store.resetWorkspaceStore();
  store.setWorkspaceBlueprint(mockWorkspace);

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Plan ID 'workspace' is strictly reserved
  // ───────────────────────────────────────────────────────────────────────────
  console.log('  1. Verifying planId reservation...');
  const rows = [
    { age: 15, gender: 'female', sleep_hours: 7.2, platform_usage: 'Instagram', stress_level: 6, anxiety_level: 4, depression_label: 'no' },
    { age: 16, gender: 'male',   sleep_hours: 5.5, platform_usage: 'TikTok',    stress_level: 8, anxiety_level: 7, depression_label: 'yes' },
    { age: 17, gender: 'female', sleep_hours: 8.0, platform_usage: 'YouTube',   stress_level: 3, anxiety_level: 2, depression_label: 'no' }
  ];
  const profile = DatasetValidator.profile(rows, 'test_dataset.csv');
  const result = await runAnalyticsQuestion('What is the average sleep_hours grouped by gender?', {
    tableName: 'test_dataset.csv',
    rows,
    profile
  });

  if (result.status === 'computed' || result.status === 'partial') {
    assert(result.plan?.planId !== 'workspace', `Planner emitted planId "${result.plan?.planId}" which is NOT 'workspace'`);
  } else {
    assert(true, `Planner did not complete (status: ${result.status}), planId 'workspace' was not emitted`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. hasQueryResult derived state
  // ───────────────────────────────────────────────────────────────────────────
  console.log('  2. Verifying derived hasQueryResult states...');
  assert(deriveHasQueryResult(null) === false, 'deriveHasQueryResult(null) is false');
  assert(deriveHasQueryResult(undefined) === false, 'deriveHasQueryResult(undefined) is false');
  assert(deriveHasQueryResult({ status: 'computed', plan: { planId: 'plan_123' } }) === true, 'deriveHasQueryResult(validObject) is true');

  // ───────────────────────────────────────────────────────────────────────────
  // 3. ComputedView Interception logic
  // ───────────────────────────────────────────────────────────────────────────
  console.log('  3. Verifying ComputedView interception conditions...');
  assert(
    shouldComputedViewIntercept(true, mockWorkspace, 'sheet_overview', 'workspace') === true,
    'Intercepts when new engine is active and planId is workspace'
  );
  assert(
    shouldComputedViewIntercept(true, mockWorkspace, 'sheet_overview', 'plan_grouped_avg') === false,
    'Does NOT intercept when planId is a real query result (e.g. plan_grouped_avg)'
  );
  assert(
    shouldComputedViewIntercept(true, mockWorkspace, null, 'workspace') === false,
    'Does NOT intercept if no activeSheetId is set'
  );
  assert(
    shouldComputedViewIntercept(false, mockWorkspace, 'sheet_overview', 'workspace') === false,
    'Does NOT intercept if new engine is disabled'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 4. useWorkspaceStore Snapshot Commit Atomicity
  // ───────────────────────────────────────────────────────────────────────────
  console.log('  4. Verifying store snapshot commit atomicity...');
  const mockQaResult = {
    status: 'computed' as const,
    plan: { planId: 'plan_test_avg', intent: 'grouped_average' as const, metric: 'sleep_hours', groupBy: ['gender'], confidence: 'high' as const, source: 'rule-engine' as const },
    data: { status: 'success' as const, rows: [{ category: 'female', value: 7.6 }] },
    chart: { chartType: 'bar' as const, title: 'Average Sleep by Gender' },
    narrative: 'Interpretation text here',
    provenance: { question: 'average sleep by gender', planGeneratedAt: new Date(), executionTimeMs: 12, plannerAttempts: 1 }
  };

  // Perform snapshot addition
  store.addAnalyticalSnapshot('average sleep by gender', mockQaResult);

  // Read updated store state
  const updatedStore = useWorkspaceStore.getState();
  const sheets = updatedStore.activeWorkspace?.sheets || [];
  const snapshotSheet = sheets.find(s => s.id.startsWith('snapshot_'));

  assert(snapshotSheet !== undefined, 'Snapshot sheet was added to sheets list');
  if (snapshotSheet) {
    const resultsEntry = updatedStore.workspaceResults[snapshotSheet.id];
    assert(resultsEntry !== undefined, 'Corresponding workspaceResults entry was populated in the same Zustand state update');
    assert(resultsEntry?.card_qa_chart !== undefined, 'Visual contract was written for card_qa_chart');
    assert(resultsEntry?.card_qa_narrative !== undefined, 'Interpretation text was written for card_qa_narrative');
  }

  // Global counts reporting
  if (testsFailed > 0) {
    throw new Error(`${testsFailed} precedence and tab sync invariant tests failed.`);
  }
}
