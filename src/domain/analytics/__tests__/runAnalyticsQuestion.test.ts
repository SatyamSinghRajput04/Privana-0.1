// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/__tests__/runAnalyticsQuestion.test.ts
// S1 SCAFFOLD STUB — Step S9.
// ─────────────────────────────────────────────────────────────────────────────

import { runAnalyticsQuestion, METADATA_BYPASS_WARNING } from '../runAnalyticsQuestion';
import { DatasetValidator } from '../../validator/validator';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
    testsPassed++;
  } else {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    testsFailed++;
  }
}

export async function runOrchestratorSafetyTests() {
  console.log('\n--- 🛡️ Running runAnalyticsQuestion Safety & Bypass Tests ---');

  // Seed standard tabular row for fallback / setup
  const validRow = { age: 15, gender: 'female', sleep_hours: 7.2, platform_usage: 'Instagram', stress_level: 6, anxiety_level: 4, depression_label: 'no' };

  // 1. A 2-row metadata file fires the metadata block before the row-floor block (ordering check)
  // Query: correlation needs 3 rows. But since it's metadata, it should block on metadata first.
  const metadataRows = [
    { '@context': 'http://schema.org', '@type': 'Dataset', name: 'Survey' },
    { '@context': 'http://schema.org', '@type': 'Dataset', name: 'Survey' }
  ];
  const metadataProfile = DatasetValidator.profile(metadataRows, 'metadata_2_rows.csv');
  const metadataContext = {
    tableName: 'metadata_2_rows.csv',
    rows: metadataRows,
    profile: metadataProfile
  };

  const result1 = await runAnalyticsQuestion('Calculate Pearson correlation between sleep_hours and stress_level', metadataContext);
  assert(result1.status === 'blocked', 'Ordering check: 2-row metadata file is blocked');
  assert(result1.status === 'blocked' && result1.bypassAllowed === true, 'Ordering check: metadata block takes precedence and allows bypass');
  assert(result1.status === 'blocked' && result1.reason.includes('metadata/schema'), 'Ordering check: blocked reason contains metadata message');

  // 2. A bypassed metadata file returns partial with METADATA_BYPASS_WARNING, not blocked
  // Query: correlation needs 3 rows, so let's provide 3 metadata rows
  const metadataRows3 = [
    { '@context': 'http://schema.org', '@type': 'Dataset', name: 'Survey', sleep_hours: 8, stress_level: 5 },
    { '@context': 'http://schema.org', '@type': 'Dataset', name: 'Survey', sleep_hours: 7, stress_level: 4 },
    { '@context': 'http://schema.org', '@type': 'Dataset', name: 'Survey', sleep_hours: 6, stress_level: 3 }
  ];
  const metadataProfile3 = DatasetValidator.profile(metadataRows3, 'metadata_3_rows.csv');
  const metadataContext3Bypassed = {
    tableName: 'metadata_3_rows.csv',
    rows: metadataRows3,
    profile: metadataProfile3,
    bypassMetadataCheck: true
  };

  const result2 = await runAnalyticsQuestion('Calculate Pearson correlation between sleep_hours and stress_level', metadataContext3Bypassed);
  assert(result2.status === 'partial', 'Bypassed metadata check: 3-row bypassed metadata file executes and returns partial');
  assert(result2.status === 'partial' && result2.reasons.includes(METADATA_BYPASS_WARNING), 'Bypassed metadata check: warning contains METADATA_BYPASS_WARNING');

  // 3. A bypassed zero-column file returns blocked (Step 5a beats 5b)
  // Provide 3 rows but with zero numeric and zero categorical columns (e.g. only ID or empty fields)
  // Let's create columns with invalid types or empty schema
  const zeroColRows = [
    { id: '1' },
    { id: '2' },
    { id: '3' }
  ];
  const zeroColProfile = DatasetValidator.profile(zeroColRows, 'zero_cols.csv');
  // Explicitly force columns to be non-analyzable (all roles ID/empty or untyped)
  zeroColProfile.columns = [{ name: 'id', type: 'id' }];

  const zeroColContextBypassed = {
    tableName: 'zero_cols.csv',
    rows: zeroColRows,
    profile: zeroColProfile,
    bypassMetadataCheck: true
  };

  const result3 = await runAnalyticsQuestion('Calculate Pearson correlation between sleep_hours and stress_level', zeroColContextBypassed);
  assert(result3.status === 'blocked', 'Bypassed zero-column check: blocked status returned');
  assert(result3.status === 'blocked' && result3.reason.includes('contain any analyzable'), 'Bypassed zero-column check: reason points to lack of columns');

  // 4. The floor check is raise-only (Math.max), and the math-floor block carries no bypassAllowed
  const normalRows2 = [
    validRow,
    validRow
  ];
  const normalProfile2 = DatasetValidator.profile(normalRows2, 'normal_2_rows.csv');
  const normalContext2 = {
    tableName: 'normal_2_rows.csv',
    rows: normalRows2,
    profile: normalProfile2
  };
  const result4 = await runAnalyticsQuestion('Calculate Pearson correlation between sleep_hours and stress_level', normalContext2);
  assert(result4.status === 'blocked', 'Floor check: normal 2-row dataset is blocked for correlation (needs 3)');
  assert(result4.status === 'blocked' && !result4.bypassAllowed, 'Floor check: math floor does not allow bypass');

  // Test raise-only floor via minRowCount
  const normalContext3Raised = {
    tableName: 'normal_3_rows.csv',
    rows: [validRow, validRow, validRow],
    profile: DatasetValidator.profile([validRow, validRow, validRow], 'normal_3_rows.csv'),
    minRowCount: 5
  };
  const result5 = await runAnalyticsQuestion('Calculate Pearson correlation between sleep_hours and stress_level', normalContext3Raised);
  assert(result5.status === 'blocked', 'Floor check: raised minimum row count blocks 3-row dataset (minRowCount: 5)');
  assert(result5.status === 'blocked' && !result5.bypassAllowed, 'Floor check: raised floor check does not allow bypass');

  // Global counts reporting
  if (testsFailed > 0) {
    throw new Error(`${testsFailed} safety & bypass test assertions failed.`);
  }
}
