import { CorrelationExecutor } from '../executors/correlation';
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
  { id: 'u01', sleep_hours: 8.0, stress_level: 3, depression_label: 'no' },
  { id: 'u02', sleep_hours: 6.0, stress_level: 7, depression_label: 'yes' },
  { id: 'u03', sleep_hours: 7.0, stress_level: 5, depression_label: 'no' },
  { id: 'u04', sleep_hours: 5.5, stress_level: 8, depression_label: 'yes' },
  { id: 'u05', sleep_hours: 9.0, stress_level: 2, depression_label: 'no' }
];

function runCorrelationExecutorTests() {
  console.log('\n--- 🔬 Running CorrelationExecutor Tests ---');

  // Test 1: Pearson Numeric vs Numeric
  const planPearson: AnalysisPlan = {
    planId: 'plan_pearson',
    intent: 'correlation',
    metric: 'sleep_hours',
    target: 'stress_level',
    confidence: 1.0,
    source: 'pattern'
  };

  const resPearson = CorrelationExecutor.execute(planPearson, SEEDED_ROWS);
  assert(resPearson.status === 'success', 'Pearson status is success');
  assert(resPearson.rows[0].method === 'Pearson', 'Method is Pearson');
  // Strong negative correlation expected
  assert(resPearson.rows[0].r < -0.9, `Strong negative correlation computed: ${resPearson.rows[0].r}`);

  // Test 2: Spearman Numeric vs Numeric
  const planSpearman: AnalysisPlan = {
    planId: 'plan_spearman_test',
    intent: 'correlation',
    metric: 'sleep_hours',
    target: 'stress_level',
    confidence: 1.0,
    source: 'pattern'
  };

  const resSpearman = CorrelationExecutor.execute(planSpearman, SEEDED_ROWS);
  assert(resSpearman.rows[0].method === 'Spearman', 'Method is Spearman');

  // Test 3: Point-Biserial Binary vs Numeric
  const planPB: AnalysisPlan = {
    planId: 'plan_pb',
    intent: 'correlation',
    metric: 'sleep_hours',
    target: 'depression_label',
    confidence: 1.0,
    source: 'pattern'
  };

  const resPB = CorrelationExecutor.execute(planPB, SEEDED_ROWS);
  assert(resPB.status === 'success', 'Point-Biserial status is success');
  assert(resPB.rows[0].method === 'Point-Biserial', 'Method is Point-Biserial');
}

try {
  runCorrelationExecutorTests();
  console.log(`\nCorrelationExecutor tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
