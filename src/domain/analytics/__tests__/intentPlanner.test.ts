import { IntentPlanner } from '../intentPlanner';

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

function runIntentPlannerTests() {
  console.log('\n--- 🎯 Running IntentPlanner Tests ---');

  // Test 1: feature_importance
  const f1 = IntentPlanner.plan('What features best predict depression_label?');
  assert(f1.intent === 'feature_importance' && f1.confidence >= 0.90, 'Matches predict query → feature_importance');

  const f2 = IntentPlanner.plan('Which feature has the strongest relationship with anxiety?');
  assert(f2.intent === 'feature_importance', 'Matches strongest relationship → feature_importance');

  // Test 2: correlation
  const c1 = IntentPlanner.plan('Calculate Pearson correlation between sleep_hours and stress_level');
  assert(c1.intent === 'correlation' && c1.confidence >= 0.90, 'Matches correlation query → correlation');

  // Test 3: comparison
  const comp1 = IntentPlanner.plan('Compare anxiety between Instagram and TikTok users');
  assert(comp1.intent === 'comparison', 'Matches compare query → comparison');

  // Test 4: ranking
  const r1 = IntentPlanner.plan('Top 5 platforms by average stress_level');
  // Note: Top 5 by average has both ranking and grouped_average indicators.
  // Our planner classifies "top 5 ... by average" as grouped_average (which is correct as it aggregates by group and ranks).
  assert(r1.intent === 'grouped_average' || r1.intent === 'ranking', 'Matches top 5 by average → grouped_average/ranking');

  const r2 = IntentPlanner.plan('Show the top 10 records');
  assert(r2.intent === 'ranking', 'Matches top 10 records → ranking');

  // Test 5: grouped_average
  const g1 = IntentPlanner.plan('Which platform has the highest average anxiety_level?');
  assert(g1.intent === 'grouped_average', 'Matches highest average → grouped_average');

  // Test 6: distribution
  const d1 = IntentPlanner.plan('Show the distribution of depression_label');
  assert(d1.intent === 'distribution', 'Matches distribution query → distribution');

  // Test 7: filter
  const fil1 = IntentPlanner.plan('Show users with anxiety_level above 7');
  assert(fil1.intent === 'filter', 'Matches above filter → filter');

  // Test 8: summary
  const s1 = IntentPlanner.plan('How many users are in the dataset?');
  assert(s1.intent === 'summary', 'Matches count query → summary');

  const s2 = IntentPlanner.plan('Give me a general summary');
  assert(s2.intent === 'summary', 'Matches general summary query → summary');
}

try {
  runIntentPlannerTests();
  console.log(`\nIntentPlanner tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
