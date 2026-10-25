import { DistributionExecutor } from '../executors/distribution';
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
  { id: 'u02', age: 16, gender: 'male' },
  { id: 'u03', age: 25, gender: 'female' },
  { id: 'u04', age: 30, gender: 'male' },
  { id: 'u05', age: 35, gender: 'female' }
];

function runDistributionExecutorTests() {
  console.log('\n--- 🔬 Running DistributionExecutor Tests ---');

  // Test 1: Categorical column (gender)
  const planCat: AnalysisPlan = {
    planId: 'plan_dist_cat',
    intent: 'distribution',
    metric: 'gender',
    confidence: 1.0,
    source: 'pattern'
  };
  const resCat = DistributionExecutor.execute(planCat, SEEDED_ROWS);
  assert(resCat.status === 'success', 'Categorical status is success');
  assert(resCat.metadata?.isNumeric === false, 'Correctly identifies non-numeric');
  
  const femaleRow = resCat.rows.find(r => r.category_label === 'female');
  assert(femaleRow !== undefined && femaleRow.count === 3, 'Correctly counts 3 females');
  
  const maleRow = resCat.rows.find(r => r.category_label === 'male');
  assert(maleRow !== undefined && maleRow.count === 2, 'Correctly counts 2 males');

  // Test 2: Numeric column (age)
  const planNum: AnalysisPlan = {
    planId: 'plan_dist_num',
    intent: 'distribution',
    metric: 'age',
    confidence: 1.0,
    source: 'pattern'
  };
  const resNum = DistributionExecutor.execute(planNum, SEEDED_ROWS);
  assert(resNum.status === 'success', 'Numeric status is success');
  assert(resNum.metadata?.isNumeric === true, 'Correctly identifies numeric');
  assert(resNum.rows.length > 0, 'Computes histogram bins');
  
  const totalCount = resNum.rows.reduce((acc, curr) => acc + curr.count, 0);
  assert(totalCount === 5, 'Sum of bin counts matches row count');
}

try {
  runDistributionExecutorTests();
  console.log(`\nDistributionExecutor tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
