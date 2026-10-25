// ─────────────────────────────────────────────────────────────────────────────
// src/domain/compute/ComputeEngine.ts
// COMPUTE ENGINE — the architectural boundary between "what statistic does
// this executor need" and "how is it actually retrieved/aggregated".
//
//   AnalysisPlan → Executor → ComputeEngine → raw statistical inputs →
//   Statistics layer (formulas, significance, zero-variance guards) →
//   AnalyticsResult
//
// A ComputeEngine implementation is DELIBERATELY dumb: it retrieves and
// aggregates data, nothing more. It never decides what a result MEANS —
// formulas (Pearson's r, ANOVA's F-statistic, Benjamini-Hochberg correction,
// zero-variance handling) stay in the executor / statistics layer, which is
// engine-agnostic and shared across every implementation of this interface.
// That split is what lets a second implementation (e.g. DuckDB-Wasm) slot in
// later without touching executor code or re-deriving/re-testing any math.
//
// Methods are added only when a specific executor migration needs them — the
// interface grows from real call sites, not speculative design.
//   Stage 2.1: groupedAggregate  (GroupedAverageExecutor, + RankingExecutor
//              by composition)
//   Stage 2.5: profilePair, moments, samplePoints  (CorrelationExecutor)
// ─────────────────────────────────────────────────────────────────────────────

export interface GroupedAggregateRow {
  category_label: string;
  average_value: number;
  count: number;
}

export interface DistributionBin {
  binRange: string;
  binLabel: string;
  count: number;
  minVal?: number;
  maxVal?: number;
  category_label?: string;
}

export interface DistributionResult {
  isNumeric: boolean;
  rows: DistributionBin[];
  totalCount: number;
}

/**
 * Declarative 0/1 encoding for a categorical column in a moments() request.
 *
 * Deliberately declarative (a value to compare against) rather than a JS
 * callback: a callback could not be pushed into SQL by a future DuckDB
 * implementation, whereas this translates directly to
 * `CASE WHEN col = ? THEN 1 ELSE 0 END`. It also keeps the caller's resolved
 * binary mapping as the single source of truth — the engine never guesses
 * how to turn a string into a number.
 */
export interface BinaryEncoding {
  /** Values matching this encode as 1; everything else 0. */
  positiveValue: any;
  /**
   * How a value is compared against positiveValue.
   *   'strict' — `raw === positiveValue` only.
   *   'loose'  — also matches when `String(raw) === String(positiveValue)`.
   *
   * Both exist because the pre-migration code was INCONSISTENT between its
   * two uses: computePointBiserial() encoded the statistic with strict
   * equality, while the scatter-point projection used the String() fallback.
   * They disagree only on mixed-type columns (e.g. a column holding both the
   * number 1 and the string "1"), where strict yields two groups and loose
   * collapses them into one. Rather than silently changing either behaviour
   * during this migration, both are preserved exactly: 'strict' for moments,
   * 'loose' for samplePoints. Worth reconciling deliberately later — flagged,
   * not fixed here.
   */
  matchMode: 'strict' | 'loose';
}

/**
 * Facts about a column pair needed to CHOOSE a statistical method, gathered
 * in one pass so the executor never has to walk rows itself. These are
 * observations about the data, not interpretations of it — the executor
 * still decides what they mean (which method applies, whether to refuse).
 */
export interface PairProfile {
  /** Rows where BOTH columns are non-null/undefined/empty-string. */
  count: number;
  /** True if every included x value satisfies !isNaN(Number(v)). */
  xAllNumeric: boolean;
  yAllNumeric: boolean;
  /**
   * Distinct raw x values in first-seen order, collected up to a small cap
   * (the cap exists because the only consumer needs to distinguish "exactly
   * 2 distinct" from "more than 2"; first-seen order is preserved because
   * binary-mapping resolution is order-sensitive).
   */
  xDistinct: any[];
  yDistinct: any[];
  /** True if the distinct list was truncated by the cap. */
  xDistinctTruncated: boolean;
  yDistinctTruncated: boolean;
}

/**
 * Pairwise sufficient statistics — everything needed to compute Pearson's r
 * (and Point-Biserial, which is Pearson over a 0/1-encoded side) without
 * materializing the value pairs in JS.
 *
 * SUMS ARE SHIFTED, NOT RAW. Every value has `shiftX`/`shiftY` subtracted
 * before accumulation, so sumX is Σ(x − shiftX), sumX2 is Σ(x − shiftX)²,
 * sumXY is Σ(x − shiftX)(y − shiftY), and so on.
 *
 * This is not a stylistic choice — it was forced by measurement. The naive
 * raw-sums form feeds a "computational formula" that subtracts two large,
 * nearly-equal quantities, and it collapses on data that is large relative
 * to its spread. Measured on 1,000 rows whose true r is 0.9976:
 *
 *   values ≈ 1e6  → raw sums give r = 0.99761  (error 1e-8, fine)
 *   values ≈ 1e9  → raw sums give r = 0.40825  (catastrophically wrong)
 *   values ≈ 1e12 → raw sums give r = 0.00000  (catastrophically wrong)
 *
 * That range is not exotic: millisecond timestamps (~1.7e12), identifier
 * columns, and monetary amounts in minor currency units all land in it.
 * Subtracting a per-column constant first restores conditioning, and
 * correlation is invariant to such a shift so the result is unchanged.
 * Crucially it also stays translatable to a single SQL query for a future
 * columnar engine — SUM((x - :shiftX) * (y - :shiftY)) — which was the whole
 * reason for preferring a sums-based form over a two-pass computation.
 *
 * Any consumer deriving a location-dependent quantity (a mean, a total)
 * rather than a shift-invariant one (correlation, variance) MUST add the
 * shift back: mean(x) = shiftX + sumX / count.
 */
export interface PairMoments {
  count: number;
  /** Constant subtracted from every x before accumulation (0 when count is 0). */
  shiftX: number;
  shiftY: number;
  sumX: number;
  sumY: number;
  sumXY: number;
  sumX2: number;
  sumY2: number;
  /**
   * True if every included x value was identical. Tracked as an explicit
   * equality flag rather than derived from the sums, because a variance
   * computed as sumX2/n - (sumX/n)^2 can land on a tiny non-zero for
   * genuinely-constant input and miss the degenerate case the caller needs
   * to detect exactly.
   */
  xAllIdentical: boolean;
  yAllIdentical: boolean;
}

export interface MomentsRequest {
  xColumn: string;
  yColumn: string;
  /** Applied to x before accumulation. Omit for a numeric column. */
  xEncoding?: BinaryEncoding;
  yEncoding?: BinaryEncoding;
}

export interface ComputeEngine {
  /**
   * Average of `metric` grouped by `groupBy`, one row per distinct group
   * value present in the (already null/non-numeric filtered) data. Row
   * order is retrieval order, not ranked — ranking/sorting is an executor
   * concern, not a data-access concern.
   */
  groupedAggregate(rows: any[], metric: string, groupBy: string): GroupedAggregateRow[];

  /**
   * One-pass scan of a column pair returning the facts needed to select a
   * statistical method. `distinctCap` bounds how many distinct values are
   * collected per column.
   */
  profilePair(rows: any[], xColumn: string, yColumn: string, distinctCap?: number): PairProfile;

  /**
   * One-pass accumulation of pairwise sufficient statistics. Rows where
   * either column is null/undefined/empty-string are excluded (the same
   * data-validity rule used by profilePair, so `count` agrees between them).
   * A column with no encoding is read via Number(); a column with a
   * BinaryEncoding is read as 1/0 against its positiveValue.
   */
  moments(rows: any[], request: MomentsRequest): PairMoments;

  /**
   * Bounded {x, y} point set for scatter rendering — NOT for statistics.
   * Uses reservoir sampling above `limit` so coverage stays uniform across
   * the whole dataset. Kept deliberately separate from moments(): the exact
   * statistic is computed on 100% of rows while the chart draws a bounded
   * sample, so visual limits never degrade statistical correctness.
   */
  samplePoints(rows: any[], request: MomentsRequest, limit: number): { x: number; y: number }[];

  /**
   * Computes histogram bins for numeric columns (via Sturges' rule) or
   * frequency distribution for categorical columns.
   */
  distribution(rows: any[], column: string): DistributionResult;
}
