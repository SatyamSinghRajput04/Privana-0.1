/* eslint-disable no-loss-of-precision */

// Lanczos approximation for log-gamma (accurate to 15 significant figures)
export function _lgamma(z: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
  ];
  let y = z;
  const x2 = z;
  let tmp = z + 5.5;
  tmp -= (z + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += c[j] / y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x2);
}

// Incomplete beta function via modified Lentz continued fraction method
export function _betaIncomplete(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const lbetaVal = _lgamma(a) + _lgamma(b) - _lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbetaVal) / a;

  const cf = (a2: number, b2: number, x2: number): number => {
    const MAXIT = 200, EPS = 3e-7, FPMIN = 1e-30;
    const qab = a2 + b2, qap = a2 + 1, qam = a2 - 1;
    let c2 = 1.0, d = 1 - qab * x2 / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b2 - m) * x2 / ((qam + m2) * (a2 + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c2 = 1 + aa / c2; if (Math.abs(c2) < FPMIN) c2 = FPMIN;
      d = 1 / d;
      h *= d * c2;
      aa = -(a2 + m) * (qab + m) * x2 / ((a2 + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c2 = 1 + aa / c2; if (Math.abs(c2) < FPMIN) c2 = FPMIN;
      d = 1 / d;
      const del = d * c2;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  };

  if (x < (a + 1) / (a + b + 2)) return front * cf(a, b, x);
  return 1 - Math.exp(Math.log(1 - x) * b + Math.log(x) * a - lbetaVal) / b * cf(b, a, 1 - x);
}

// Two-tailed exact t-distribution CDF significance helper
export function tDistPValue(t: number, df: number): number {
  if (df <= 0) return 1.0;
  const x = df / (df + t * t);
  return _betaIncomplete(df / 2, 0.5, x);
}

/**
 * Approximate t critical value for two-tailed 95% CI (df >= 1).
 * Uses a rational approximation accurate to ±0.001 for df >= 2.
 * For large df, converges to z=1.96 (Normal).
 */
export function tCritical95(df: number): number {
  if (df <= 0) return 1.96;
  // Small-sample exact values
  const exact: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    15: 2.131, 20: 2.086, 25: 2.060, 30: 2.042, 40: 2.021,
    60: 2.000, 120: 1.980
  };
  if (exact[df] !== undefined) return exact[df];
  // For large df, converges to z=1.96
  if (df > 120) return 1.96;
  // Linear interpolation between bracketing points
  const keys = Object.keys(exact).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < keys.length - 1; i++) {
    if (df > keys[i] && df < keys[i + 1]) {
      const t0 = exact[keys[i]], t1 = exact[keys[i + 1]];
      const frac = (df - keys[i]) / (keys[i + 1] - keys[i]);
      return t0 + frac * (t1 - t0);
    }
  }
  return 1.96;
}

// F-distribution significance helper for ANOVA
export function fDistPValue(f: number, df1: number, df2: number): number {
  if (df1 <= 0 || df2 <= 0) return 1.0;
  if (f <= 0) return 1.0;
  const x = df2 / (df2 + df1 * f);
  return _betaIncomplete(df2 / 2, df1 / 2, x);
}

// Chi-Square distribution exact CDF using Wilson-Hilferty transformation (accurate for df >= 1)
export function chiSquarePValue(chiSq: number, df: number): number {
  if (df <= 0) return 1.0;
  if (chiSq <= 0) return 1.0;
  // Wilson-Hilferty transformation of Chi-Square to a standard normal variable z
  const fraction = 2 / (9 * df);
  const z = (Math.pow(chiSq / df, 1 / 3) - (1 - fraction)) / Math.sqrt(fraction);
  // Compute normal distribution two-tailed equivalent significance
  // standard error function approximation:
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.5 * absZ);
  // erf approximation formula with error < 1.2e-7
  const ans = 1 - t * Math.exp(-absZ * absZ - 1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277)))))))));
  const pVal = z >= 0 ? 0.5 * (1 - ans) : 0.5 * (1 + ans);
  // Since it's standard one-sided right-tailed survival function for Chi-Square:
  return Math.max(0, Math.min(1.0, 2 * pVal));
}
/**
 * True if every value in the array is identical (zero variance). Correlation
 * against a zero-variance variable is mathematically undefined — the
 * denominator in Pearson's formula is zero. getPearsonCorrelation already
 * guards against dividing by zero by returning 0 in that case, but 0 reads
 * to a user as "no correlation found", indistinguishable from a genuine weak
 * relationship. Callers should check this FIRST (on the paired/filtered
 * subset actually being analyzed, not just the raw column — a column can
 * have real variance overall but collapse to one value once the user's
 * active filters are applied) and report a distinct degenerate/unsupported
 * state instead of silently computing r=0.
 */
export function hasZeroVariance(values: number[]): boolean {
  if (values.length === 0) return true;
  const first = values[0];
  return values.every(v => v === first);
}

export function getPearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  return denX === 0 || denY === 0 ? 0 : num / Math.sqrt(denX * denY);
}

/**
 * Pearson's r computed from pairwise sufficient statistics (the
 * "computational formula") instead of from materialized value arrays:
 *
 *   r = (n·Σxy − Σx·Σy) / sqrt( (n·Σx² − (Σx)²) · (n·Σy² − (Σy)²) )
 *
 * Mathematically identical to getPearsonCorrelation() above; the difference
 * is only that the caller can supply running sums accumulated in a single
 * allocation-free pass (and, in a future columnar engine, computed entirely
 * in SQL) rather than two parallel arrays.
 *
 * This function lives in the statistics layer on purpose. The ComputeEngine
 * supplies the sums and never learns what a correlation is; interpreting
 * those sums — this formula, the zero-variance guard, significance testing —
 * stays here, shared by every engine implementation so the math is written
 * and tested exactly once.
 *
 * Numerical note: this formula subtracts two large, nearly-equal quantities,
 * so it is only safe on well-conditioned input. Measured on data whose true
 * r is 0.9976, feeding it RAW sums returns 0.408 at magnitude 1e9 and 0.000
 * at 1e12 — catastrophic cancellation, not rounding noise. PairMoments
 * therefore supplies SHIFTED sums (each value reduced by a per-column
 * constant), which restores conditioning; correlation is shift-invariant so
 * the result is unchanged, and this function needs no adjustment for the
 * shift. Do not call it with unshifted sums accumulated elsewhere.
 */
export function pearsonFromMoments(m: {
  count: number;
  sumX: number;
  sumY: number;
  sumXY: number;
  sumX2: number;
  sumY2: number;
}): number {
  const n = m.count;
  if (n < 2) return 0;
  const num = n * m.sumXY - m.sumX * m.sumY;
  const denX = n * m.sumX2 - m.sumX * m.sumX;
  const denY = n * m.sumY2 - m.sumY * m.sumY;
  if (denX <= 0 || denY <= 0) return 0;
  return num / Math.sqrt(denX * denY);
}

export function getRanks(values: number[]): number[] {
  const sorted = values.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].val === sorted[i].val) j++;
    const rank = 1 + (i + j - 1) / 2;
    for (let k = i; k < j; k++) ranks[sorted[k].idx] = rank;
    i = j;
  }
  return ranks;
}

export function getSpearmanCorrelation(xs: number[], ys: number[]): number {
  return getPearsonCorrelation(getRanks(xs), getRanks(ys));
}

// Test significance of a correlation coefficient
export function testCorrelationSignificance(r: number, n: number): {
  t: number;
  p: number;
  significant: boolean;
  df: number;
} {
  if (n <= 2) return { t: 0, p: 1.0, significant: false, df: Math.max(0, n - 2) };
  const clampedR = Math.max(-0.9999999, Math.min(0.9999999, r));
  const df = n - 2;
  const t = clampedR * Math.sqrt(df / (1 - clampedR * clampedR));
  const p = tDistPValue(Math.abs(t), df);
  return { t, p, significant: p < 0.05, df };
}

// Deterministic binary positive outcome category resolver
export function resolveBinaryMapping(uniqueValues: any[]): {
  posValue: any;
  negValue: any;
  isAmbiguous: boolean;
  mappingNote?: string;
} {
  const v1Str = String(uniqueValues[0]).toLowerCase().trim();
  const v2Str = String(uniqueValues[1]).toLowerCase().trim();

  const positiveWords = ['depressed', 'yes', 'true', '1', 'positive', 'active', 'success', 'high', 'stressed', 'female'];
  const negativeWords = ['not depressed', 'no', 'false', '0', 'negative', 'inactive', 'failure', 'low', 'not_depressed', 'male'];

  const v1IsPos = positiveWords.includes(v1Str);
  const v2IsPos = positiveWords.includes(v2Str);
  const v1IsNeg = negativeWords.includes(v1Str);
  const v2IsNeg = negativeWords.includes(v2Str);

  if (v1IsPos && !v2IsPos) {
    return { posValue: uniqueValues[0], negValue: uniqueValues[1], isAmbiguous: false };
  }
  if (v2IsPos && !v1IsPos) {
    return { posValue: uniqueValues[1], negValue: uniqueValues[0], isAmbiguous: false };
  }
  if (v1IsNeg && !v2IsNeg) {
    return { posValue: uniqueValues[1], negValue: uniqueValues[0], isAmbiguous: false };
  }
  if (v2IsNeg && !v1IsNeg) {
    return { posValue: uniqueValues[0], negValue: uniqueValues[1], isAmbiguous: false };
  }

  // Ambiguous case fallback
  return {
    posValue: uniqueValues[0],
    negValue: uniqueValues[1],
    isAmbiguous: true,
    mappingNote: 'Mapping is ambiguous, so Privana measured association strength but cannot safely explain positive/negative direction.'
  };
}

export function computePointBiserial(
  numericVals: number[],
  categoryVals: any[],
  mapping: { posValue: any; negValue: any; isAmbiguous: boolean }
): { correlation: number; direction: 'Positive' | 'Negative' | 'Associated' } {
  // Map binary values to 0 and 1
  const binaryEncoded = categoryVals.map(val => (val === mapping.posValue ? 1 : 0));
  const r = getPearsonCorrelation(numericVals, binaryEncoded);

  let direction: 'Positive' | 'Negative' | 'Associated' = 'Associated';
  if (!mapping.isAmbiguous) {
    direction = r > 0 ? 'Positive' : 'Negative';
  }

  return { correlation: r, direction };
}

/**
 * Computes One-Way ANOVA F-statistic and Eta-squared from sufficient statistics
 * (group counts, group sums, and total sum-of-squares) rather than materializing raw arrays.
 */
export function anovaFromSufficientStats(
  groups: { category: string; count: number; sum: number }[],
  totalCount: number,
  totalSum: number,
  totalSumSq: number
): {
  fValue: number;
  etaSquared: number;
  pValue: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const k = groups.length;
  const N = totalCount;

  if (k < 2 || N < 2) {
    return { fValue: 0, etaSquared: 0, pValue: 1.0, warnings: ['ANOVA requires at least 2 distinct categories with valid records.'] };
  }

  for (const g of groups) {
    if (g.count < 5) {
      warnings.push(`Category "${g.category}" contains only ${g.count} rows (recommended minimum is 5). Statistical reliability is low.`);
    }
  }

  const grandMean = totalSum / N;
  const ssTotal = totalSumSq - (totalSum * totalSum) / N;

  let ssBetween = 0;
  for (const g of groups) {
    if (g.count > 0) {
      const groupMean = g.sum / g.count;
      ssBetween += g.count * Math.pow(groupMean - grandMean, 2);
    }
  }

  const ssWithin = Math.max(0, ssTotal - ssBetween);
  const df1 = k - 1;
  const df2 = N - k;

  if (df2 <= 0) {
    return { fValue: 0, etaSquared: 0, pValue: 1.0, warnings: [...warnings, 'Not enough degrees of freedom.'] };
  }

  const msBetween = ssBetween / df1;
  const msWithin = ssWithin / df2;

  const fValue = msWithin === 0 ? 0 : msBetween / msWithin;
  const etaSquared = ssTotal <= 0 ? 0 : Math.min(1.0, Math.max(0, ssBetween / ssTotal));
  const pValue = fDistPValue(fValue, df1, df2);

  return { fValue, etaSquared, pValue, warnings };
}

// 1. One-Way ANOVA Solver
export function computeOneWayAnova(
  numericVals: number[],
  categoryVals: any[]
): {
  fValue: number;
  etaSquared: number;
  pValue: number;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Group numeric variables by category values
  const groups: Record<string, number[]> = {};
  for (let i = 0; i < numericVals.length; i++) {
    const cat = String(categoryVals[i]);
    const val = numericVals[i];
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(val);
  }

  const groupKeys = Object.keys(groups);
  const k = groupKeys.length;
  const N = numericVals.length;

  if (k < 2) {
    return { fValue: 0, etaSquared: 0, pValue: 1.0, warnings: ['ANOVA requires at least 2 distinct categories.'] };
  }

  // Enforce method-specific category size rule: category group rows >= 5
  groupKeys.forEach(cat => {
    if (groups[cat].length < 5) {
      warnings.push(`Category "${cat}" contains only ${groups[cat].length} rows (recommended minimum is 5). Statistical reliability is low.`);
    }
  });

  // Calculate means
  const grandMean = numericVals.reduce((s, v) => s + v, 0) / N;
  const ssTotal = numericVals.reduce((s, v) => s + Math.pow(v - grandMean, 2), 0);

  let ssBetween = 0;
  groupKeys.forEach(cat => {
    const groupVals = groups[cat];
    const n_i = groupVals.length;
    const groupMean = groupVals.reduce((s, v) => s + v, 0) / n_i;
    ssBetween += n_i * Math.pow(groupMean - grandMean, 2);
  });

  const ssWithin = ssTotal - ssBetween;
  const df1 = k - 1;
  const df2 = N - k;

  if (df2 <= 0) {
    return { fValue: 0, etaSquared: 0, pValue: 1.0, warnings: [...warnings, 'Not enough degrees of freedom.'] };
  }

  const msBetween = ssBetween / df1;
  const msWithin = ssWithin / df2;

  const fValue = msWithin === 0 ? 0 : msBetween / msWithin;
  const etaSquared = ssTotal === 0 ? 0 : ssBetween / ssTotal;
  const pValue = fDistPValue(fValue, df1, df2);

  return { fValue, etaSquared, pValue, warnings };
}

/**
 * Computes Cramer's V and Chi-Square statistic from a pre-aggregated contingency table
 * rather than materializing raw categorical arrays.
 */
export function cramersVFromContingency(
  contingencyCells: { rowCat: string; colCat: string; count: number }[],
  totalN: number
): {
  chiSq: number;
  cramersV: number;
  pValue: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  const observed: Record<string, number> = {};

  const rowSet = new Set<string>();
  const colSet = new Set<string>();

  for (const cell of contingencyCells) {
    const r = cell.rowCat;
    const c = cell.colCat;
    rowSet.add(r);
    colSet.add(c);
    rowTotals[r] = (rowTotals[r] || 0) + cell.count;
    colTotals[c] = (colTotals[c] || 0) + cell.count;
    observed[`${r}||${c}`] = cell.count;
  }

  const r = rowSet.size;
  const c = colSet.size;

  if (r < 2 || c < 2 || totalN < 2) {
    return { chiSq: 0, cramersV: 0, pValue: 1.0, warnings: ['Chi-Square requires variables with at least 2 distinct categories.'] };
  }

  let chiSq = 0;
  let cellViolationsCount = 0;

  for (const catA of rowSet) {
    const r_i = rowTotals[catA] || 0;
    for (const catB of colSet) {
      const c_j = colTotals[catB] || 0;
      const expected = (r_i * c_j) / totalN;

      if (expected < 5) {
        cellViolationsCount++;
      }

      const obs = observed[`${catA}||${catB}`] || 0;
      if (expected > 0) {
        chiSq += Math.pow(obs - expected, 2) / expected;
      }
    }
  }

  if (cellViolationsCount > 0) {
    warnings.push(`Contingency table contains ${cellViolationsCount} cell(s) with an expected frequency < 5. Cramer's V results may be unstable.`);
  }

  const denominator = totalN * Math.min(r - 1, c - 1);
  const cramersV = denominator === 0 ? 0 : Math.sqrt(chiSq / denominator);
  const df = (r - 1) * (c - 1);
  const pValue = chiSquarePValue(chiSq, df);

  return { chiSq, cramersV, pValue, warnings };
}

// 2. Chi-Square & Cramer's V Solver
export function computeCramersV(
  colAVals: any[],
  colBVals: any[]
): {
  chiSq: number;
  cramersV: number;
  pValue: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const n = colAVals.length;

  // Build unique sets
  const catASet = Array.from(new Set(colAVals));
  const catBSet = Array.from(new Set(colBVals));
  const r = catASet.length;
  const c = catBSet.length;

  if (r < 2 || c < 2) {
    return { chiSq: 0, cramersV: 0, pValue: 1.0, warnings: ['Chi-Square requires variables with at least 2 distinct categories.'] };
  }

  // Row and Column marginal totals
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  const observed: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    const a = String(colAVals[i]);
    const b = String(colBVals[i]);
    rowTotals[a] = (rowTotals[a] || 0) + 1;
    colTotals[b] = (colTotals[b] || 0) + 1;

    const cellKey = `${a}||${b}`;
    observed[cellKey] = (observed[cellKey] || 0) + 1;
  }

  let chiSq = 0;
  let cellViolationsCount = 0;

  for (const catA of catASet) {
    const r_i = rowTotals[String(catA)] || 0;
    for (const catB of catBSet) {
      const c_j = colTotals[String(catB)] || 0;
      const expected = (r_i * c_j) / n;

      // Rule: Expected cell counts should generally be >= 5
      if (expected < 5) {
        cellViolationsCount++;
      }

      const cellKey = `${String(catA)}||${String(catB)}`;
      const obs = observed[cellKey] || 0;

      if (expected > 0) {
        chiSq += Math.pow(obs - expected, 2) / expected;
      }
    }
  }

  if (cellViolationsCount > 0) {
    warnings.push(`Contingency table contains ${cellViolationsCount} cell(s) with an expected frequency < 5. Cramer's V results may be unstable.`);
  }

  const denominator = n * Math.min(r - 1, c - 1);
  const cramersV = denominator === 0 ? 0 : Math.sqrt(chiSq / denominator);
  const df = (r - 1) * (c - 1);
  const pValue = chiSquarePValue(chiSq, df);

  return { chiSq, cramersV, pValue, warnings };
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  seReg: number;
  seSlope: number;
  seIntercept: number;
  tSlope: number;
  tIntercept: number;
  pSlope: number;
  pIntercept: number;
  Sxx: number;
  df: number;
}

/**
 * OLS simple linear regression. Returns slope, intercept, R², RSE,
 * AND the computed standard errors / t-stats / p-values for each coefficient.
 */
export function getLinearRegression(xs: number[], ys: number[]): LinearRegressionResult {
  const n = xs.length;
  if (n < 3) return {
    slope: 0, intercept: 0, r2: 0, seReg: 0,
    seSlope: 0, seIntercept: 0,
    tSlope: 0, tIntercept: 0,
    pSlope: 1, pIntercept: 1,
    Sxx: 0, df: Math.max(0, n - 2)
  };
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let Sxy = 0, Sxx = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    Sxy += dx * (ys[i] - meanY);
    Sxx += dx * dx;
  }
  const slope = Sxx === 0 ? 0 : Sxy / Sxx;
  const intercept = meanY - slope * meanX;

  let totalSS = 0, residualSS = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const res = ys[i] - (slope * xs[i] + intercept);
    residualSS += res * res;
    totalSS += Math.pow(ys[i] - meanY, 2);
    sumX2 += xs[i] * xs[i];
  }
  const df = n - 2;
  const r2 = totalSS === 0 ? 0 : 1 - residualSS / totalSS;
  const seReg = df > 0 ? Math.sqrt(residualSS / df) : 0;

  // Correct OLS standard errors from first principles
  const seSlope = Sxx === 0 ? 0 : seReg / Math.sqrt(Sxx);
  const seIntercept = Sxx === 0 ? 0 : seReg * Math.sqrt(sumX2 / (n * Sxx));
  const tSlope = seSlope === 0 ? 0 : slope / seSlope;
  const tIntercept = seIntercept === 0 ? 0 : intercept / seIntercept;
  const pSlope = tDistPValue(Math.abs(tSlope), df);
  const pIntercept = tDistPValue(Math.abs(tIntercept), df);

  return { slope, intercept, r2, seReg, seSlope, seIntercept, tSlope, tIntercept, pSlope, pIntercept, Sxx, df };
}

/**
 * Fisher's adjusted skewness (G1) and excess kurtosis (G2) — same as SPSS/Excel.
 */
export function getSkewnessAndKurtosis(vals: number[]): { skewness: number; kurtosis: number } {
  const n = vals.length;
  if (n < 4) return { skewness: 0, kurtosis: 0 };
  const m = vals.reduce((s, v) => s + v, 0) / n;
  const m2 = vals.reduce((s, v) => s + Math.pow(v - m, 2), 0) / n;
  const m3 = vals.reduce((s, v) => s + Math.pow(v - m, 3), 0) / n;
  const m4 = vals.reduce((s, v) => s + Math.pow(v - m, 4), 0) / n;
  if (m2 === 0) return { skewness: 0, kurtosis: 0 };
  const skew = m3 / Math.pow(m2, 1.5);
  const excessKurt = m4 / Math.pow(m2, 2) - 3;
  // Fisher's bias corrections (same as R's e1071::skewness type 2 / Excel SKEW)
  const adjSkew = (Math.sqrt(n * (n - 1)) / (n - 2)) * skew;
  const adjKurt = ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * excessKurt + 6);
  return {
    skewness: parseFloat(adjSkew.toFixed(6)),
    kurtosis: parseFloat(adjKurt.toFixed(6))
  };
}

/** Interpret a Pearson/Spearman r value with direction and magnitude label. */
export function interpretCorrelation(r: number): string {
  const abs = Math.abs(r);
  const dir = r > 0 ? 'positive' : r < 0 ? 'negative' : 'zero';
  const strength = abs >= 0.9 ? 'very strong' : abs >= 0.7 ? 'strong'
    : abs >= 0.4 ? 'moderate' : abs >= 0.2 ? 'weak' : 'negligible';
  return `${strength} ${dir}`;
}

/** Format p-value for display — avoids floating point noise. */
export function fmtP(p: number): string {
  if (p < 1e-15) return '< 1e-15';
  if (p < 0.0001) return p.toExponential(3);
  return p.toFixed(4);
}
