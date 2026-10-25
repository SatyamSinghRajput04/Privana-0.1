import { FeatureImportanceExecutor } from '../executors/featureImportance';
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
  { id: 'u02', age: 16, gender: 'male',   sleep_hours: 5.5, platform_usage: 'TikTok',    stress_level: 8, anxiety_level: 7, depression_label: 'yes' },
  { id: 'u03', age: 17, gender: 'female', sleep_hours: 8.0, platform_usage: 'YouTube',   stress_level: 3, anxiety_level: 2, depression_label: 'no' },
  { id: 'u04', age: 18, gender: 'male',   sleep_hours: 6.1, platform_usage: 'Instagram', stress_level: 7, anxiety_level: 6, depression_label: 'yes' },
  { id: 'u05', age: 19, gender: 'female', sleep_hours: 9.0, platform_usage: 'YouTube',   stress_level: 2, anxiety_level: 1, depression_label: 'no' },
  { id: 'u06', age: 15, gender: 'male',   sleep_hours: 6.8, platform_usage: 'TikTok',    stress_level: 5, anxiety_level: 5, depression_label: 'no' },
  { id: 'u07', age: 16, gender: 'female', sleep_hours: 7.5, platform_usage: 'Instagram', stress_level: 4, anxiety_level: 3, depression_label: 'no' },
  { id: 'u08', age: 17, gender: 'male',   sleep_hours: 5.0, platform_usage: 'TikTok',    stress_level: 9, anxiety_level: 8, depression_label: 'yes' },
];

function runFeatureImportanceExecutorTests() {
  console.log('\n--- 🔬 Running FeatureImportanceExecutor Tests ---');

  const plan: AnalysisPlan = {
    planId: 'plan_feat_imp',
    intent: 'feature_importance',
    target: 'stress_level',
    confidence: 1.0,
    source: 'pattern'
  };

  const result = FeatureImportanceExecutor.execute(plan, SEEDED_ROWS);

  assert(result.status === 'success', 'Executor status is success');
  assert(result.rows.length > 0, 'Returns ranked feature association rows');

  // Verify that 'id' is excluded as PII
  const excluded = result.metadata?.excludedFeatures || [];
  const hasIdExclusion = excluded.some((e: any) => e.feature === 'id');
  assert(hasIdExclusion, 'Correctly excludes PII/unique-key column "id"');

  // Verify age/sleep associations are computed
  const ageRow = result.rows.find(r => r.feature === 'age');
  assert(ageRow !== undefined, 'Computes association for age');
  assert(ageRow!.method === 'Pearson', 'Infers Pearson method for age (numeric)');
}

try {
  runFeatureImportanceExecutorTests();
  console.log(`\nFeatureImportanceExecutor tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
