import { SummaryExecutor } from '../executors/summary';
import { AnalysisPlan } from '../types';

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

const mockPlan: AnalysisPlan = {
  planId: 'plan_summary',
  intent: 'summary',
  confidence: 1.0,
  source: 'pattern'
};

const SEEDED_ROWS = [
  { id: 'u01', age: 15, gender: 'female', sleep_hours: 8.0 },
  { id: 'u02', age: 20, gender: 'male',   sleep_hours: 6.0 },
  { id: 'u03', age: 25, gender: 'female', sleep_hours: 7.0 },
  { id: 'u04', age: 30, gender: 'male',   sleep_hours: null },
  { id: 'u05', age: 35, gender: 'female', sleep_hours: 9.0 }
];

function runSummaryExecutorTests() {
  console.log('\n--- 🔬 Running SummaryExecutor Tests ---');

  const result = SummaryExecutor.execute(mockPlan, SEEDED_ROWS);

  assert(result.status === 'success', 'Executor status is success');
  assert(result.metadata?.rowCount === 5, 'Correct row count calculated');

  const ageStats = result.rows.find(r => r.columnName === 'age');
  assert(ageStats !== undefined, 'Computes stats for age column');
  assert(ageStats.type === 'numeric', 'Correctly infers numeric type for age');
  assert(ageStats.min === 15, 'Correct min calculated for age');
  assert(ageStats.max === 35, 'Correct max calculated for age');
  assert(ageStats.avg === 25, 'Correct average calculated for age');

  const genderStats = result.rows.find(r => r.columnName === 'gender');
  assert(genderStats !== undefined, 'Computes stats for gender column');
  assert(genderStats.type === 'categorical', 'Correctly infers categorical type for gender');
  assert(genderStats.uniqueCount === 2, 'Correct unique count calculated for gender');
  assert(genderStats.topValue === 'female', 'Correct top value calculated for gender');

  const sleepStats = result.rows.find(r => r.columnName === 'sleep_hours');
  assert(sleepStats !== undefined, 'Computes stats for sleep_hours');
  assert(sleepStats.missingCount === 1, 'Correctly counts missing/null value for sleep_hours');
}

try {
  runSummaryExecutorTests();
  console.log(`\nSummaryExecutor tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
