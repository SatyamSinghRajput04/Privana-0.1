import 'fake-indexeddb/auto';
import { runAnalyticsQuestion } from '../../src/domain/analytics/runAnalyticsQuestion';
import { DatasetValidator } from '../../src/domain/validator/validator';

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

// ─────────────────────────────────────────────────────────────────────────────
// SEEDED DETERMINISTIC FIXTURE
// Used for running all acceptance tests.
// ─────────────────────────────────────────────────────────────────────────────
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

const SEEDED_DATASET_NAME = 'real_questions_fixture.csv';

const profile = DatasetValidator.profile(SEEDED_ROWS, SEEDED_DATASET_NAME);

const context = {
  tableName: SEEDED_DATASET_NAME,
  rows: SEEDED_ROWS,
  profile: profile,
};

const TEST_CASES = [
  {
    question: 'Show the distribution of depression_label',
    expectedIntent: 'distribution',
    expectedStatus: 'computed',
  },
  {
    question: 'Which social media platform has the highest average anxiety_level?',
    expectedIntent: 'grouped_average',
    expectedStatus: 'computed',
  },
  {
    question: 'Calculate Pearson correlation between sleep_hours and stress_level',
    expectedIntent: 'correlation',
    expectedStatus: 'computed',
  },
  {
    question: 'What features best predict depression_label?',
    expectedIntent: 'feature_importance',
    expectedStatus: 'computed',
  },
  {
    question: 'Top 5 platforms by average stress_level',
    expectedIntent: 'ranking',
    expectedStatus: 'computed',
  },
  {
    question: 'Show users with anxiety_level above 7',
    expectedIntent: 'filter',
    expectedStatus: 'computed',
  },
  {
    question: 'Compare anxiety between Instagram and TikTok users',
    expectedIntent: 'comparison',
    expectedStatus: 'computed',
  },
  {
    question: 'Show a trend of stress over time',
    expectedIntent: 'unsupported',
    expectedStatus: 'unsupported',
  },
];

async function runAcceptanceTests() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║    ACCEPTANCE GATE: realQuestions.test.ts             ║');
  console.log('║    Verifies target Q&A pipeline capabilities          ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  for (const tc of TEST_CASES) {
    try {
      console.log(`\nQuery: "${tc.question}"`);
      const result = await runAnalyticsQuestion(tc.question, context);

      // Verify status matches
      assert(result.status === tc.expectedStatus, `Expected status: "${tc.expectedStatus}", got: "${result.status}"`);

      // Verify intent matches (for computed/partial status)
      if (result.status === 'computed' || result.status === 'partial') {
        assert(result.plan.intent === tc.expectedIntent, `Expected intent: "${tc.expectedIntent}", got: "${result.plan.intent}"`);

        // Forbidden fallback substring assertion
        assert(!result.narrative.includes("didn't find specific"), 'Narrative must never contain legacy fallback substring');
      } else if (result.status === 'unsupported') {
        assert(result.explanation !== undefined, 'Unsupported result includes explanation narrative');
        assert(Array.isArray(result.suggestedQuestions), 'Unsupported result includes suggestion chips');
      }
    } catch (e: any) {
      console.error(`\x1b[31m[FAIL]\x1b[0m Exception running query "${tc.question}":`, e.message);
      failed++;
    }
  }
}

(async () => {
  try {
    await runAcceptanceTests();
    console.log('\n=== Acceptance Gate Complete ===');
    console.log(`Passed: ${passed}  |  Failed: ${failed}\n`);
    if (failed > 0) {
      console.error('⛔ ACCEPTANCE FAILURE: One or more target capabilities failed. Gate is closed.\n');
      process.exit(1);
    } else {
      console.log('✅ All acceptance criteria met. Gate is open.\n');
      process.exit(0);
    }
  } catch (e: any) {
    console.error('Fatal acceptance test failure:', e.message);
    process.exit(1);
  }
})();
