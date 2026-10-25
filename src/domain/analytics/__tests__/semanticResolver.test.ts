import { SemanticResolver } from '../semanticResolver';
import { DatasetValidator } from '../../validator/validator';

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

function runSemanticResolverTests() {
  console.log('\n--- 🔍 Running SemanticResolver Tests ---');

  // Test 1: Extract single column from simple question
  const r1 = SemanticResolver.resolve('Show the distribution of depression_label', profile);
  assert(r1.length > 0, 'Extracts at least one resolved column');
  assert(r1.some(c => c.columnName === 'depression_label'), 'Successfully resolves "depression_label" from distribution query');

  // Test 2: Extract multi-word synonym column ("sleep hours")
  const r2 = SemanticResolver.resolve('Calculate average sleep hours across gender', profile);
  assert(r2.some(c => c.columnName === 'sleep_hours'), 'Successfully resolves "sleep hours" synonym as "sleep_hours"');
  assert(r2.some(c => c.columnName === 'gender'), 'Successfully resolves "gender" from query');

  // Test 3: Extract columns with typos/fuzzy matches
  const r3 = SemanticResolver.resolve('Show users with anxiety_lvl above 7', profile);
  assert(r3.some(c => c.columnName === 'anxiety_level'), 'Resolves fuzzy column "anxiety_lvl" to "anxiety_level"');

  // Test 4: Verify confidence ordering
  const r4 = SemanticResolver.resolve('Compare stress_level and platform', profile);
  const stressMatch = r4.find(c => c.columnName === 'stress_level');
  const platformMatch = r4.find(c => c.columnName === 'platform_usage');
  assert(stressMatch !== undefined && platformMatch !== undefined, 'Both columns resolved');
  assert(stressMatch!.confidence === 1.0, 'Exact match "stress_level" has confidence 1.0');
  assert(platformMatch!.confidence < 1.0, 'Alias match "platform" has confidence < 1.0');
}

try {
  runSemanticResolverTests();
  console.log(`\nSemanticResolver tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
