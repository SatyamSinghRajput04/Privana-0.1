// ─────────────────────────────────────────────────────────────────────────────
// src/domain/safeCompute/__tests__/math_parity.test.ts
// Phase 2 Step 2: Statistical Domain Parity Test Suite
//
// Verifies all 12 mathematical routines consolidated into relationshipRanker.ts:
// _lgamma, _betaIncomplete, tDistPValue, tCritical95, getPearsonCorrelation,
// getRanks, getSpearmanCorrelation, testCorrelationSignificance,
// getLinearRegression, getSkewnessAndKurtosis, interpretCorrelation, fmtP.
//
// Parity Standards:
// - Float tolerance <= 1e-7 (or 1e-12 for _lgamma, 1e-6 for skew/kurt)
// - Exact discrete matches for strings, rankings, and booleans
// - Comprehensive boundary and degenerate edge cases
// ─────────────────────────────────────────────────────────────────────────────

import {
  _lgamma,
  _betaIncomplete,
  tDistPValue,
  tCritical95,
  getPearsonCorrelation,
  getRanks,
  getSpearmanCorrelation,
  testCorrelationSignificance,
  getLinearRegression,
  getSkewnessAndKurtosis,
  interpretCorrelation,
  fmtP
} from '../relationshipRanker';

function isClose(a: number, b: number, tol = 1e-7): boolean {
  if (isNaN(a) && isNaN(b)) return true;
  return Math.abs(a - b) <= tol;
}

export function runMathParityTests() {
  console.log('\n--- 🧮 Running Statistical Math Domain Parity Tests ---');
  let passed = 0;
  let failed = 0;

  function testAssert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  \x1b[32m[PASS]\x1b[0m ${desc}`);
      passed++;
    } else {
      console.error(`  \x1b[31m[FAIL]\x1b[0m ${desc}`);
      failed++;
    }
  }

  // 1. _lgamma
  testAssert(isClose(_lgamma(1), 0, 1e-12), '_lgamma(1) === 0 (exact log(1))');
  testAssert(isClose(_lgamma(2), 0, 1e-12), '_lgamma(2) === 0 (exact log(1!))');
  testAssert(isClose(_lgamma(3), Math.log(2), 1e-12), '_lgamma(3) === log(2)');
  testAssert(isClose(_lgamma(4), Math.log(6), 1e-12), '_lgamma(4) === log(6)');
  testAssert(isClose(_lgamma(0.5), Math.log(Math.sqrt(Math.PI)), 1e-12), '_lgamma(0.5) === log(sqrt(pi))');
  testAssert(isClose(_lgamma(10), Math.log(362880), 1e-10), '_lgamma(10) === log(9!)');

  // 2. _betaIncomplete
  testAssert(_betaIncomplete(2, 2, 0) === 0, '_betaIncomplete(2, 2, 0) === 0');
  testAssert(_betaIncomplete(2, 2, 1) === 1, '_betaIncomplete(2, 2, 1) === 1');
  testAssert(_betaIncomplete(2, 2, -0.5) === 0, '_betaIncomplete with x < 0 clamped to 0');
  testAssert(_betaIncomplete(2, 2, 1.5) === 1, '_betaIncomplete with x > 1 clamped to 1');
  testAssert(isClose(_betaIncomplete(1, 1, 0.5), 0.5, 1e-7), '_betaIncomplete(1, 1, 0.5) === 0.5');
  testAssert(isClose(_betaIncomplete(0.5, 0.5, 0.5), 0.5, 1e-7), '_betaIncomplete(0.5, 0.5, 0.5) === 0.5');
  // Symmetry: I_x(a, b) + I_{1-x}(b, a) = 1
  const symCheck = _betaIncomplete(2, 5, 0.3) + _betaIncomplete(5, 2, 0.7);
  testAssert(isClose(symCheck, 1.0, 1e-7), 'Beta incomplete symmetry property holds');

  // 3. tDistPValue
  testAssert(tDistPValue(2.0, 0) === 1.0, 'tDistPValue with df <= 0 returns 1.0');
  testAssert(isClose(tDistPValue(0, 10), 1.0, 1e-7), 'tDistPValue(t=0, df=10) === 1.0');
  testAssert(isClose(tDistPValue(1.0, 1), 0.5, 1e-7), 'tDistPValue(t=1, df=1) === 0.5 (Cauchy)');
  testAssert(isClose(tDistPValue(2.000, 60), 0.05, 0.005), 'tDistPValue(t=2, df=60) ≈ 0.05');
  testAssert(tDistPValue(100, 10) < 1e-10, 'tDistPValue(t=100) approaches 0');

  // 4. tCritical95
  testAssert(tCritical95(0) === 1.96, 'tCritical95(df <= 0) returns 1.96');
  testAssert(tCritical95(1) === 12.706, 'tCritical95(1) exact key match');
  testAssert(tCritical95(2) === 4.303, 'tCritical95(2) exact key match');
  testAssert(tCritical95(10) === 2.228, 'tCritical95(10) exact key match');
  testAssert(tCritical95(60) === 2.000, 'tCritical95(60) exact key match');
  testAssert(tCritical95(120) === 1.980, 'tCritical95(120) exact key match');
  testAssert(tCritical95(200) === 1.96, 'tCritical95(df > 120) returns 1.96');
  // Interpolation: df=50 is halfway between 40 (2.021) and 60 (2.000) -> 2.0105
  testAssert(isClose(tCritical95(50), 2.0105, 1e-4), 'tCritical95(50) linear interpolation matches');

  // 5. getPearsonCorrelation
  testAssert(getPearsonCorrelation([1], [2]) === 0, 'getPearsonCorrelation N < 2 returns 0');
  testAssert(getPearsonCorrelation([1, 1, 1], [2, 3, 4]) === 0, 'getPearsonCorrelation zero-variance X returns 0');
  testAssert(getPearsonCorrelation([1, 2, 3], [5, 5, 5]) === 0, 'getPearsonCorrelation zero-variance Y returns 0');
  const xsLinear = [1, 2, 3, 4, 5];
  const ysLinearPos = [2, 4, 6, 8, 10];
  const ysLinearNeg = [10, 8, 6, 4, 2];
  testAssert(isClose(getPearsonCorrelation(xsLinear, ysLinearPos), 1.0, 1e-7), 'Perfect positive correlation === 1.0');
  testAssert(isClose(getPearsonCorrelation(xsLinear, ysLinearNeg), -1.0, 1e-7), 'Perfect negative correlation === -1.0');

  // 6. getRanks
  const ranks1 = getRanks([10, 20, 30]);
  testAssert(ranks1.length === 3 && ranks1[0] === 1 && ranks1[1] === 2 && ranks1[2] === 3, 'getRanks simple unique values');
  const ranksTies = getRanks([10, 20, 20, 30]);
  testAssert(ranksTies[0] === 1 && ranksTies[1] === 2.5 && ranksTies[2] === 2.5 && ranksTies[3] === 4, 'getRanks tied midpoint ranks');
  const ranksAllTied = getRanks([7, 7, 7, 7]);
  testAssert(ranksAllTied.every(r => r === 2.5), 'getRanks all identical values');

  // 7. getSpearmanCorrelation
  const xsNonLinear = [1, 2, 3, 4, 5];
  const ysNonLinear = [1, 10, 100, 1000, 10000];
  testAssert(isClose(getSpearmanCorrelation(xsNonLinear, ysNonLinear), 1.0, 1e-7), 'Spearman detects non-linear monotonic data as 1.0');

  // 8. testCorrelationSignificance
  const sigSmallN = testCorrelationSignificance(0.8, 2);
  testAssert(sigSmallN.p === 1.0 && !sigSmallN.significant && sigSmallN.df === 0, 'testCorrelationSignificance N <= 2 safe fallback');
  const sigPerfectR = testCorrelationSignificance(1.0, 30);
  testAssert(sigPerfectR.significant && sigPerfectR.p < 1e-6, 'testCorrelationSignificance r = 1.0 clamped without divide-by-zero');
  const sigWeak = testCorrelationSignificance(0.05, 20);
  testAssert(!sigWeak.significant && sigWeak.p > 0.05, 'testCorrelationSignificance weak r is not significant');

  // 9. getLinearRegression
  const regSmall = getLinearRegression([1, 2], [3, 4]);
  testAssert(regSmall.slope === 0 && regSmall.r2 === 0, 'getLinearRegression N < 3 returns safe zeros');
  const regPerfect = getLinearRegression([1, 2, 3, 4, 5], [3, 5, 7, 9, 11]);
  testAssert(isClose(regPerfect.slope, 2.0, 1e-7), 'Linear regression slope === 2.0');
  testAssert(isClose(regPerfect.intercept, 1.0, 1e-7), 'Linear regression intercept === 1.0');
  testAssert(isClose(regPerfect.r2, 1.0, 1e-7), 'Linear regression r2 === 1.0');
  testAssert(isClose(regPerfect.seReg, 0, 1e-7), 'Linear regression seReg === 0 for perfect line');

  // 10. getSkewnessAndKurtosis
  const skewSmall = getSkewnessAndKurtosis([1, 2, 3]);
  testAssert(skewSmall.skewness === 0 && skewSmall.kurtosis === 0, 'Skewness/kurtosis N < 4 returns 0');
  const skewZeroVar = getSkewnessAndKurtosis([5, 5, 5, 5]);
  testAssert(skewZeroVar.skewness === 0 && skewZeroVar.kurtosis === 0, 'Skewness/kurtosis zero-variance returns 0');
  const skewSymmetric = getSkewnessAndKurtosis([1, 2, 3, 4, 5]);
  testAssert(isClose(skewSymmetric.skewness, 0, 1e-6), 'Skewness symmetric data === 0');

  // 11. interpretCorrelation
  testAssert(interpretCorrelation(0.95) === 'very strong positive', 'interpretCorrelation 0.95');
  testAssert(interpretCorrelation(-0.95) === 'very strong negative', 'interpretCorrelation -0.95');
  testAssert(interpretCorrelation(0.75) === 'strong positive', 'interpretCorrelation 0.75');
  testAssert(interpretCorrelation(-0.45) === 'moderate negative', 'interpretCorrelation -0.45');
  testAssert(interpretCorrelation(0.25) === 'weak positive', 'interpretCorrelation 0.25');
  testAssert(interpretCorrelation(-0.05) === 'negligible negative', 'interpretCorrelation -0.05');
  testAssert(interpretCorrelation(0) === 'negligible zero', 'interpretCorrelation 0');

  // 12. fmtP
  testAssert(fmtP(1e-16) === '< 1e-15', 'fmtP underflow < 1e-15');
  testAssert(fmtP(0.000025) === (0.000025).toExponential(3), 'fmtP small exponential notation');
  testAssert(fmtP(0.04567) === '0.0457', 'fmtP 4 decimals standard display');

  console.log(`\x1b[36m--- Math Parity Complete: ${passed} passed, ${failed} failed ---\x1b[0m\n`);
  if (failed > 0) {
    throw new Error(`Math parity tests failed: ${failed} failures`);
  }
}

// Self-invoking execution if run directly via tsx
if (typeof process !== 'undefined' && process.argv[1]?.includes('math_parity.test')) {
  try {
    runMathParityTests();
    process.exit(0);
  } catch (e: any) {
    console.error(e.message);
    process.exit(1);
  }
}
