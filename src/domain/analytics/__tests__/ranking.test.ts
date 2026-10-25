import { RankingExecutor } from '../executors/ranking';
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
  { id: 'u01', age: 15, gender: 'female', sleep_hours: 8.0 },
  { id: 'u02', age: 20, gender: 'male',   sleep_hours: 6.0 },
  { id: 'u03', age: 25, gender: 'female', sleep_hours: 7.0 },
  { id: 'u04', age: 30, gender: 'male',   sleep_hours: 5.0 },
  { id: 'u05', age: 35, gender: 'female', sleep_hours: 9.0 }
];

function runRankingExecutorTests() {
  console.log('\n--- 🔬 Running RankingExecutor Tests ---');

  // Test 1: Individual record ranking
  const planIndiv: AnalysisPlan = {
    planId: 'plan_ranking_3', // top 3
    intent: 'ranking',
    metric: 'sleep_hours',
    confidence: 1.0,
    source: 'pattern'
  };

  const resIndiv = RankingExecutor.execute(planIndiv, SEEDED_ROWS);
  assert(resIndiv.status === 'success', 'Individual status is success');
  assert(resIndiv.rows.length === 3, 'Returns exactly top 3 rows');
  assert(resIndiv.rows[0].id === 'u05' && resIndiv.rows[0].sleep_hours === 9.0, 'Top sleep hours is 9.0 (u05)');
  assert(resIndiv.rows[1].id === 'u01' && resIndiv.rows[1].sleep_hours === 8.0, 'Second sleep hours is 8.0 (u01)');

  // Test 2: Grouped average ranking
  const planGrouped: AnalysisPlan = {
    planId: 'plan_ranking_top_1_grouped',
    intent: 'ranking',
    metric: 'age',
    groupBy: ['gender'],
    confidence: 1.0,
    source: 'pattern'
  };
  const resGrouped = RankingExecutor.execute(planGrouped, SEEDED_ROWS);
  // Status is partial_small_n because of small group sizes
  assert(resGrouped.status === 'partial_small_n', 'Grouped ranking status correctly flagged');
  assert(resGrouped.rows.length === 1, 'Grouped ranking limited to top 1 group');
}

try {
  runRankingExecutorTests();
  console.log(`\nRankingExecutor tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
