import { GroupedAverageExecutor } from '../executors/groupedAverage';
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

const SEEDED_ROWS = [
  { id: 'u01', age: 15, gender: 'female' },
  { id: 'u02', age: 20, gender: 'male' },
  { id: 'u03', age: 25, gender: 'female' },
  { id: 'u04', age: 30, gender: 'male' },
  { id: 'u05', age: 35, gender: 'female' }
];

function runGroupedAverageExecutorTests() {
  console.log('\n--- 🔬 Running GroupedAverageExecutor Tests ---');

  const plan: AnalysisPlan = {
    planId: 'plan_grouped_avg',
    intent: 'grouped_average',
    metric: 'age',
    groupBy: ['gender'],
    confidence: 1.0,
    source: 'pattern'
  };

  const result = GroupedAverageExecutor.execute(plan, SEEDED_ROWS);

  // Status should be partial_small_n because group counts are < 5
  assert(result.status === 'partial_small_n', 'Status correctly flagged as partial_small_n');
  assert(result.rows.length === 2, 'Two distinct groups computed');

  const femaleRow = result.rows.find(r => r.category_label === 'female');
  assert(femaleRow !== undefined, 'Female group exists');
  // (15 + 25 + 35) / 3 = 25
  assert(femaleRow!.average_value === 25, 'Female average age is 25');
  assert(femaleRow!.count === 3, 'Female count is 3');

  const maleRow = result.rows.find(r => r.category_label === 'male');
  assert(maleRow !== undefined, 'Male group exists');
  // (20 + 30) / 2 = 25
  assert(maleRow!.average_value === 25, 'Male average age is 25');
  assert(maleRow!.count === 2, 'Male count is 2');
}

try {
  runGroupedAverageExecutorTests();
  console.log(`\nGroupedAverageExecutor tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
