import { SlotResolver } from '../slotResolver';
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

function runSlotResolverTests() {
  console.log('\n--- 🔬 Running SlotResolver Tests ---');

  // Test 1: Resolve slots for grouped_average
  const s1 = SlotResolver.resolve('Which platform has the highest average anxiety_level?', 'grouped_average', profile);
  assert(s1.metric === 'anxiety_level', 'Resolves metric to anxiety_level');
  assert(s1.groupBy !== undefined && s1.groupBy[0] === 'platform_usage', 'Resolves groupBy to platform_usage');

  // Test 2: Resolve slots for correlation
  const s2 = SlotResolver.resolve('Calculate Pearson correlation between sleep_hours and stress_level', 'correlation', profile);
  assert(s2.metric === 'sleep_hours', 'Resolves metric to sleep_hours');
  assert(s2.target === 'stress_level', 'Resolves target to stress_level');

  // Test 3: Resolve slots with filter above
  const s3 = SlotResolver.resolve('Show users with anxiety_level above 7', 'filter', profile);
  assert(s3.filters !== undefined && s3.filters.length === 1, 'Resolves exactly one filter');
  assert(s3.filters![0].column === 'anxiety_level', 'Filter column is anxiety_level');
  assert(s3.filters![0].operator === '>', 'Filter operator is ">"');
  assert(s3.filters![0].value === 7, 'Filter value is 7');

  // Test 4: Resolve slots with string filter equals
  const s4 = SlotResolver.resolve('Show users where gender is female', 'filter', profile);
  assert(s4.filters !== undefined && s4.filters.length === 1, 'Resolves equality filter');
  assert(s4.filters![0].column === 'gender', 'Filter column is gender');
  assert(s4.filters![0].operator === '=', 'Filter operator is "="');
  assert(s4.filters![0].value === 'female', 'Filter value is "female"');
}

try {
  runSlotResolverTests();
  console.log(`\nSlotResolver tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
