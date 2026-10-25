import { FilterExecutor } from '../executors/filter';
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

function runFilterExecutorTests() {
  console.log('\n--- 🔬 Running FilterExecutor Tests ---');

  // Test 1: Numeric filter >
  const planNum: AnalysisPlan = {
    planId: 'plan_filter_num',
    intent: 'filter',
    filters: [
      { column: 'age', operator: '>', value: 20 }
    ],
    confidence: 1.0,
    source: 'pattern'
  };

  const resNum = FilterExecutor.execute(planNum, SEEDED_ROWS);
  assert(resNum.rows.length === 3, 'Returns 3 records with age > 20');
  assert(resNum.rows.every(r => r.age > 20), 'All returned records have age > 20');

  // Test 2: Categorical filter =
  const planCat: AnalysisPlan = {
    planId: 'plan_filter_cat',
    intent: 'filter',
    filters: [
      { column: 'gender', operator: '=', value: 'male' }
    ],
    confidence: 1.0,
    source: 'pattern'
  };

  const resCat = FilterExecutor.execute(planCat, SEEDED_ROWS);
  assert(resCat.rows.length === 2, 'Returns 2 male records');
  assert(resCat.rows.every(r => r.gender === 'male'), 'All returned records are male');

  // Test 3: Multiple filters (AND logic)
  const planMulti: AnalysisPlan = {
    planId: 'plan_filter_multi',
    intent: 'filter',
    filters: [
      { column: 'age', operator: '>', value: 20 },
      { column: 'gender', operator: '=', value: 'female' }
    ],
    confidence: 1.0,
    source: 'pattern'
  };

  const resMulti = FilterExecutor.execute(planMulti, SEEDED_ROWS);
  // (25, female), (35, female) -> 2 records
  assert(resMulti.rows.length === 2, 'Returns 2 records satisfying both filters');
}

try {
  runFilterExecutorTests();
  console.log(`\nFilterExecutor tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
