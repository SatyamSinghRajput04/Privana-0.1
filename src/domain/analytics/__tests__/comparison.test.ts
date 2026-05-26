import { ComparisonExecutor } from '../executors/comparison';
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

function runComparisonExecutorTests() {
  console.log('\n--- 🔬 Running ComparisonExecutor Tests ---');

  const plan: AnalysisPlan = {
    planId: 'plan_compare',
    intent: 'comparison',
    metric: 'age',
    groupBy: ['gender'],
    confidence: 1.0,
    source: 'pattern'
  };

  const result = ComparisonExecutor.execute(plan, SEEDED_ROWS);

  assert(result.status === 'partial_small_n', 'Status correctly flagged as partial_small_n');
  assert(result.rows.length === 2, 'Two distinct groups computed');

  const femaleRow = result.rows.find(r => r.group_label === 'female');
  assert(femaleRow !== undefined, 'Female group exists');
  assert(femaleRow!.mean === 25, 'Female average age is 25');
  assert(femaleRow!.min === 15 && femaleRow!.max === 35, 'Female min age 15, max age 35');
  assert(femaleRow!.count === 3, 'Female count is 3');

  const maleRow = result.rows.find(r => r.group_label === 'male');
  assert(maleRow !== undefined, 'Male group exists');
  assert(maleRow!.mean === 25, 'Male average age is 25');
  assert(maleRow!.min === 20 && maleRow!.max === 30, 'Male min age 20, max age 30');
  assert(maleRow!.count === 2, 'Male count is 2');
}

try {
  runComparisonExecutorTests();
  console.log(`\nComparisonExecutor tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
