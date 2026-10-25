import { PlanValidator } from '../planValidator';
import { DatasetValidator } from '../../validator/validator';
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
  { id: 'u01', age: 15, gender: 'female', sleep_hours: 7.2, platform_usage: 'Instagram', stress_level: 6, anxiety_level: 4, depression_label: 'no' },
];

const profile = DatasetValidator.profile(SEEDED_ROWS, 'test_dataset.csv');

function runPlanValidatorTests() {
  console.log('\n--- 🔬 Running PlanValidator Tests ---');

  // Test 1: Valid Plan passes with no errors
  const validPlan: AnalysisPlan = {
    planId: 'plan_1',
    intent: 'grouped_average',
    metric: 'stress_level',
    groupBy: ['platform_usage'],
    filters: [
      { column: 'gender', operator: '=', value: 'female' }
    ],
    confidence: 0.90,
    source: 'pattern'
  };
  const e1 = PlanValidator.validate(validPlan, profile);
  assert(e1.length === 0, 'Valid plan returns 0 errors');

  // Test 2: Non-existent metric column
  const badMetricPlan: AnalysisPlan = {
    planId: 'plan_2',
    intent: 'distribution',
    metric: 'non_existent_column',
    confidence: 0.95,
    source: 'pattern'
  };
  const e2 = PlanValidator.validate(badMetricPlan, profile);
  assert(e2.length === 1 && e2[0].includes('metric'), 'Catches non-existent metric column error');

  // Test 3: Non-existent groupBy column
  const badGroupByPlan: AnalysisPlan = {
    planId: 'plan_3',
    intent: 'grouped_average',
    metric: 'stress_level',
    groupBy: ['non_existent_group'],
    confidence: 0.95,
    source: 'pattern'
  };
  const e3 = PlanValidator.validate(badGroupByPlan, profile);
  assert(e3.length === 1 && e3[0].includes('grouping'), 'Catches non-existent groupBy column error');

  // Test 4: Missing target in feature_importance
  const missingTargetPlan: AnalysisPlan = {
    planId: 'plan_4',
    intent: 'feature_importance',
    confidence: 0.95,
    source: 'pattern'
  };
  const e4 = PlanValidator.validate(missingTargetPlan, profile);
  assert(e4.length === 1 && e4[0].includes('target outcome'), 'Catches missing target error for feature_importance');
}

try {
  runPlanValidatorTests();
  console.log(`\nPlanValidator tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
