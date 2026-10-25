import { SafeComputeInput, SafeComputeResult, FeatureImportanceRow, ExcludedFeature } from './types';
import { validateDatasetSafety } from './preflight';
import { resolveQATarget } from './intentResolver';
import { profileColumn, selectStatisticalMethod } from './statPlanner';
import {
  getPearsonCorrelation,
  testCorrelationSignificance,
  resolveBinaryMapping,
  computePointBiserial,
  computeOneWayAnova,
  anovaFromSufficientStats,
  computeCramersV,
  cramersVFromContingency,
  hasZeroVariance
} from './relationshipRanker';
import { applyBenjaminiHochberg } from './corrections';

// Helper to map score to standard strength labels
function getStrengthLabel(score: number): 'Strong' | 'Moderate' | 'Weak' | 'None' {
  const abs = Math.abs(score);
  if (abs >= 0.5) return 'Strong';
  if (abs >= 0.3) return 'Moderate';
  if (abs >= 0.1) return 'Weak';
  return 'None';
}

export function runSafeCompute(input: SafeComputeInput): SafeComputeResult {
  const startTime = Date.now();
  const { question, tableName, rows } = input;

  // 1. Run Pre-flight Blocks
  const preflightBlock = validateDatasetSafety(rows, tableName);
  if (preflightBlock) {
    return {
      status: 'blocked',
      reason: preflightBlock.reason,
      nextSteps: preflightBlock.nextSteps,
      confidence: 'Blocked'
    };
  }

  // 2. Profile Columns in Dataset
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  const profiles = keys.map(k => profileColumn(k, rows));

  // 3. Resolve Target and Intent
  const resolved = resolveQATarget(question, profiles.map(p => {
    let resolvedType: 'numeric' | 'category' | 'date' | 'text' | 'boolean' | 'identifier' = 'category';
    if (p.type === 'numeric') resolvedType = 'numeric';
    else if (p.type === 'date') resolvedType = 'date';
    else if (p.type === 'unsupported') resolvedType = 'text';
    return { name: p.name, type: resolvedType };
  }));

  if (resolved.intent === 'unsupported' || !resolved.target) {
    const suggestedQuestions = [
      `Calculate Pearson correlation matrix between all numeric columns`,
      `Which feature has the strongest relationship with stress_level?`,
      `Show frequency distribution histogram of sleep_hours`
    ];
    return {
      status: 'unsupported',
      reason: `The query "${question}" does not match statistical Q&A triggers or no target outcome column was detected.`,
      suggestedQuestions,
      confidence: 'Low confidence'
    };
  }

  const targetProfile = profiles.find(p => p.name === resolved.target);
  if (!targetProfile) {
    return {
      status: 'unsupported',
      reason: `Target outcome column "${resolved.target}" not found in dataset schema.`,
      suggestedQuestions: [`Which feature has the strongest relationship with ${keys[0]}?`],
      confidence: 'Low confidence'
    };
  }

  if (targetProfile.isConstant || targetProfile.type === 'unsupported' || targetProfile.isPII) {
    return {
      status: 'unsupported',
      reason: `Target column "${targetProfile.name}" is constant, contains PII, or has an unsupported format for relationship analysis.`,
      suggestedQuestions: [`Which feature has the strongest relationship with other variables?`],
      confidence: 'Low confidence'
    };
  }

  // 4. Compute Associations & Exclusions Loop
  const computedRows: FeatureImportanceRow[] = [];
  const excludedFeatures: ExcludedFeature[] = [];
  const warnings: string[] = [];
  const methodCounts: Record<string, number> = {};

  profiles.forEach(featProfile => {
    // Exclude target itself
    if (featProfile.name === targetProfile.name) return;

    // Check preflight exclusions
    if (featProfile.isConstant) {
      excludedFeatures.push({ feature: featProfile.name, reason: 'Constant value (zero variance)' });
      return;
    }
    if (featProfile.isPII) {
      excludedFeatures.push({ feature: featProfile.name, reason: 'PII / unique identifier key' });
      return;
    }
    const missingness = featProfile.missingCount / featProfile.sampleSize;
    if (missingness > 0.6) {
      excludedFeatures.push({ feature: featProfile.name, reason: `High missingness: ${(missingness * 100).toFixed(1)}% values missing (threshold is 60%)` });
      return;
    }
    if (featProfile.type === 'unsupported') {
      excludedFeatures.push({ feature: featProfile.name, reason: 'Unsupported free-text / high-cardinality format' });
      return;
    }

    // Select Method
    const method = selectStatisticalMethod(targetProfile, featProfile);
    if (method === 'unsupported') {
      excludedFeatures.push({ feature: featProfile.name, reason: 'Incompatible column datatypes' });
      return;
    }

    // Align paired rows (omit records where either field is null/empty/NaN)
    const pairs = rows
      .map(r => ({
        x: r[targetProfile.name],
        y: r[featProfile.name]
      }))
      .filter(p => {
        if (p.x === null || p.x === undefined || p.x === '') return false;
        if (p.y === null || p.y === undefined || p.y === '') return false;
        if (typeof p.x === 'number' && isNaN(p.x)) return false;
        if (typeof p.y === 'number' && isNaN(p.y)) return false;
        return true;
      });

    const N = pairs.length;
    if (N < 3) {
      excludedFeatures.push({ feature: featProfile.name, reason: `Insufficient overlapping paired records (n = ${N} < 3 minimum)` });
      return;
    }

    let score = 0;
    let rawPValue = 1.0;
    let direction: 'Positive' | 'Negative' | 'Associated' | 'None' = 'None';
    let computedMethod: 'Pearson' | 'Spearman' | 'Point-Biserial' | 'ANOVA' | 'Cramer\'s V' | 'Chi-Square' = 'Pearson';

    // 1. Numeric vs Numeric
    if (targetProfile.type === 'numeric' && featProfile.type === 'numeric') {
      computedMethod = 'Pearson';
      const xs = pairs.map(p => Number(p.x));
      const ys = pairs.map(p => Number(p.y));

      // Zero variance in the PAIRED subset (not just the raw column — active
      // filters can collapse an otherwise-varying column to one value) makes
      // Pearson mathematically undefined. Exclude explicitly rather than
      // silently reporting r=0, which reads as "no relationship" when the
      // real answer is "this can't be computed on the current filtered data."
      if (hasZeroVariance(xs) || hasZeroVariance(ys)) {
        const zeroVarCol = hasZeroVariance(xs) ? targetProfile.name : featProfile.name;
        excludedFeatures.push({
          feature: featProfile.name,
          reason: `Zero variance in "${zeroVarCol}" for the current filtered records (every value is identical) — correlation is mathematically undefined here, not zero.`
        });
        return;
      }

      const r = getPearsonCorrelation(xs, ys);
      const sig = testCorrelationSignificance(r, N);

      score = Math.abs(r);
      rawPValue = sig.p;
      direction = r > 0 ? 'Positive' : 'Negative';

      if (N < 10) {
        warnings.push(`Small paired sample size (n = ${N}) for numeric correlation with "${featProfile.name}". Raw patterns may be unstable.`);
      }
    }

    // 2. Point-Biserial (Binary vs Numeric)
    else if (
      (targetProfile.type === 'binary_categorical' && featProfile.type === 'numeric') ||
      (targetProfile.type === 'numeric' && featProfile.type === 'binary_categorical')
    ) {
      computedMethod = 'Point-Biserial';
      const isTargetBinary = targetProfile.type === 'binary_categorical';
      const binaryProfile = isTargetBinary ? targetProfile : featProfile;

      const mapping = resolveBinaryMapping(binaryProfile.uniqueValues);
      if (mapping.isAmbiguous) {
        warnings.push(`Ambiguous binary mapping for "${binaryProfile.name}". Directionality is hidden.`);
      }

      const numericVals = pairs.map(p => Number(isTargetBinary ? p.y : p.x));
      const categoryVals = pairs.map(p => (isTargetBinary ? p.x : p.y));

      // Assert group sizes: both groups must contain at least 5 rows
      const g1Count = categoryVals.filter(v => v === mapping.posValue).length;
      const g2Count = categoryVals.filter(v => v === mapping.negValue).length;

      if (g1Count < 5 || g2Count < 5) {
        warnings.push(`Low subgroup counts for Point-Biserial correlation on "${featProfile.name}" (pos: ${g1Count}, neg: ${g2Count}). Minimum is 5 per group.`);
      }

      // Same zero-variance guard as the numeric-vs-numeric branch: if the
      // current filters have collapsed either side to a single value
      // (numeric variable constant, or every paired record landing in one
      // category), Point-Biserial is undefined — exclude explicitly.
      if (hasZeroVariance(numericVals) || g1Count === 0 || g2Count === 0) {
        excludedFeatures.push({
          feature: featProfile.name,
          reason: `Zero variance for the current filtered records (${hasZeroVariance(numericVals) ? `"${featProfile.name}"` : `"${binaryProfile.name}"`} is constant) — Point-Biserial correlation is mathematically undefined here, not zero.`
        });
        return;
      }

      const pbRes = computePointBiserial(numericVals, categoryVals, mapping);
      const sig = testCorrelationSignificance(pbRes.correlation, N);

      score = Math.abs(pbRes.correlation);
      rawPValue = sig.p;
      direction = pbRes.direction;
    }

    // 3. ANOVA / Eta-Squared (Multi-Category vs Numeric)
    else if (
      (targetProfile.type === 'multi_categorical' && featProfile.type === 'numeric') ||
      (targetProfile.type === 'numeric' && featProfile.type === 'multi_categorical')
    ) {
      computedMethod = 'ANOVA';
      const isTargetNumeric = targetProfile.type === 'numeric';
      const numericVals = pairs.map(p => Number(isTargetNumeric ? p.x : p.y));
      const categoryVals = pairs.map(p => (isTargetNumeric ? p.y : p.x));

      const anovaRes = computeOneWayAnova(numericVals, categoryVals);
      anovaRes.warnings.forEach(w => warnings.push(w));

      score = Math.sqrt(anovaRes.etaSquared); // Eta coefficient (scales 0 to 1)
      rawPValue = anovaRes.pValue;
      direction = 'Associated';
    }

    // 4. Cramer's V / Chi-Square (Categorical vs Categorical)
    else {
      computedMethod = 'Cramer\'s V';
      const colAVals = pairs.map(p => p.x);
      const colBVals = pairs.map(p => p.y);

      const cramerRes = computeCramersV(colAVals, colBVals);
      cramerRes.warnings.forEach(w => warnings.push(w));

      score = cramerRes.cramersV;
      rawPValue = cramerRes.pValue;
      direction = 'Associated';
    }

    // Exclude potential leakages (r > 0.99)
    if (score > 0.99) {
      excludedFeatures.push({ feature: featProfile.name, reason: 'Potential leakage / duplicate signal (score > 0.99)' });
      return;
    }

    methodCounts[computedMethod] = (methodCounts[computedMethod] || 0) + 1;

    computedRows.push({
      rank: 0, // Assigned after sorting
      feature: featProfile.name,
      method: computedMethod,
      score,
      rawPValue,
      adjustedPValue: null, // Assigned after multiple-comparison correction
      strength: getStrengthLabel(score),
      direction,
      sampleSize: N
    });
  });

  // 5. Apply Benjamini-Hochberg FDR Multiple-Comparison Correction
  const rawPValues = computedRows.map(r => r.rawPValue);
  const adjustedPValues = applyBenjaminiHochberg(rawPValues);
  computedRows.forEach((r, idx) => {
    r.adjustedPValue = adjustedPValues[idx];
  });

  // 6. Rank Rows by descending correlation strength
  computedRows.sort((a, b) => b.score - a.score);
  computedRows.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  // 7. Define Target Summary
  const isTargetBinary = targetProfile.type === 'binary_categorical';
  let positiveClass: string | undefined;
  let mappingNote: string | undefined;

  if (isTargetBinary) {
    const mapping = resolveBinaryMapping(targetProfile.uniqueValues);
    positiveClass = String(mapping.posValue);
    mappingNote = mapping.isAmbiguous
      ? mapping.mappingNote
      : `Deterministic encoding: "${mapping.posValue}" mapped to 1, "${mapping.negValue}" mapped to 0.`;
  }

  const targetSummary = {
    target: targetProfile.name,
    detectedType: targetProfile.type,
    sampleSize: targetProfile.sampleSize - targetProfile.missingCount,
    missingCount: targetProfile.missingCount,
    uniqueCount: targetProfile.uniqueValues.length,
    positiveClass,
    mappingNote
  };

  // 8. Calculate Overall Reliability Confidence Label
  let confidence: 'High confidence' | 'Medium confidence' | 'Low confidence' = 'High confidence';
  const validSampleSize = targetSummary.sampleSize;

  if (validSampleSize < 10 || warnings.length > 2) {
    confidence = 'Low confidence';
  } else if (validSampleSize < 30 || targetProfile.missingCount / targetProfile.sampleSize > 0.3) {
    confidence = 'Medium confidence';
  }

  // 9. Format Rich Markdown Analysis Text
  let answer = `### 📊 Statistical Feature Importance: Predictors of \`${targetProfile.name}\`\n`;
  answer += `*Ranked by normalized association strength, not direct causal importance.*\n\n`;
  answer += `> **⚠️ This ranking shows statistical association, not causal proof.** Correlation does not imply causation.\n\n`;

  if (isTargetBinary) {
    answer += `#### 🛡️ Categorical Variable Encoding\n`;
    answer += `* **Target Column:** \`${targetProfile.name}\` (binary categorical)\n`;
    answer += `* **Positive Class:** \`${targetSummary.positiveClass}\` (encoded as \`1\`)\n`;
    if (targetSummary.mappingNote) {
      answer += `* **Mapping Rule:** ${targetSummary.mappingNote}\n`;
    }
    answer += `\n`;
  }

  answer += `#### 📈 Ranked Feature Relationship Table\n`;
  answer += `| Rank | Feature | Method | Score (Effect Size) | Raw p-value | Adjusted p-value (FDR) | Strength | Direction | n |\n`;
  answer += `| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;

  computedRows.forEach(r => {
    const rawP = r.rawPValue === null ? 'N/A' : r.rawPValue < 0.0001 ? r.rawPValue.toExponential(3) : r.rawPValue.toFixed(4);
    const adjP = r.adjustedPValue === null ? 'N/A' : r.adjustedPValue < 0.0001 ? r.adjustedPValue.toExponential(3) : r.adjustedPValue.toFixed(4);
    const sign = r.direction === 'Positive' ? '🟢 Positive' : r.direction === 'Negative' ? '🔴 Negative' : '🔵 Associated';

    answer += `| **#${r.rank}** | \`${r.feature}\` | ${r.method} | \`${r.score.toFixed(4)}\` | \`${rawP}\` | \`${adjP}\` | ${r.strength} | ${sign} | ${r.sampleSize} |\n`;
  });

  if (computedRows.length === 0) {
    answer += `*(No features survived safe-compute exclusions. Try uploading a dataset with more variables.)*\n`;
  }

  if (excludedFeatures.length > 0) {
    answer += `\n#### 🛡️ Excluded Columns (Safe Exclusions)\n`;
    excludedFeatures.forEach(ex => {
      answer += `* \`${ex.feature}\` — *Skipped: ${ex.reason}*\n`;
    });
  }

  if (warnings.length > 0) {
    answer += `\n#### ⚠️ Statistical Reliability Warnings\n`;
    warnings.forEach(w => {
      answer += `* ${w}\n`;
    });
  }

  const methodBreakdown = Object.entries(methodCounts).map(([methodName, count]) => ({
    method: methodName,
    featureCount: count
  }));

  const runtimeMs = Date.now() - startTime;

  return {
    status: 'computed',
    answer,
    rows: computedRows,
    excludedFeatures,
    confidence,
    warnings,
    targetSummary,
    chartSpec: computedRows.length > 0 ? {
      type: 'feature_importance',
      xKey: 'feature',
      yKey: 'score'
    } : undefined,
    audit: {
      sampleSize: validSampleSize,
      excludedFeaturesCount: excludedFeatures.length,
      correctionMethod: 'Benjamini-Hochberg',
      methodBreakdown,
      runtimeMs
    }
  };
}
