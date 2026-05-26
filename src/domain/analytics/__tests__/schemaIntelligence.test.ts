import { SchemaIntelligence } from '../schemaIntelligence';
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

function runSchemaIntelligenceTests() {
  console.log('\n--- 🔬 Running SchemaIntelligence Tests ---');

  // Test 1: Resolve Column exact match
  const matchExact = SchemaIntelligence.resolveColumn('age', profile);
  assert(matchExact !== null && matchExact.columnName === 'age' && matchExact.role === 'metric', 
    'resolveColumn resolves "age" exactly as metric');

  // Test 2: Resolve Column synonym/alias match
  const matchAlias = SchemaIntelligence.resolveColumn('platform', profile);
  assert(matchAlias !== null && matchAlias.columnName === 'platform_usage' && matchAlias.role === 'groupBy', 
    'resolveColumn resolves "platform" alias to platform_usage as groupBy');

  // Test 3: Resolve Column non-existent
  const matchNone = SchemaIntelligence.resolveColumn('not_a_column', profile);
  assert(matchNone === null, 'resolveColumn returns null for non-existent column');

  // Test 4: Infer Role default checks
  const roleId = SchemaIntelligence.inferRole('id', 'summary');
  assert(roleId === 'id', 'inferRole infers "id" role as "id"');

  const roleTime = SchemaIntelligence.inferRole('date', 'summary');
  assert(roleTime === 'time', 'inferRole infers "date" role as "time"');

  const roleTarget = SchemaIntelligence.inferRole('stress_level', 'feature_importance', profile);
  assert(roleTarget === 'target', 'inferRole infers "stress_level" role for feature_importance as target');

  const roleGroupBy = SchemaIntelligence.inferRole('platform_usage', 'grouped_average', profile);
  assert(roleGroupBy === 'groupBy', 'inferRole infers "platform_usage" role for grouped_average as groupBy');

  const suggestions = SchemaIntelligence.suggestQuestions(profile);
  assert(suggestions.length >= 3, 'suggestQuestions generates at least 3 suggestions');
  
  // Verify that suggestions reference some actual columns from the profile
  const anyColMatch = suggestions.some(s => 
    profile.columns.some(c => c.name !== 'id' && s.includes(c.name))
  );
  assert(anyColMatch, 'suggestQuestions contains questions referencing profile columns');
}

try {
  runSchemaIntelligenceTests();
  console.log(`\nSchemaIntelligence tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
} catch (e: any) {
  console.error('Test execution failed:', e);
  process.exit(1);
}
