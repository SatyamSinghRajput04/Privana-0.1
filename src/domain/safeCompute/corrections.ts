export function applyBonferroni(rawPValues: (number | null)[]): (number | null)[] {
  const m = rawPValues.filter(p => p !== null).length;
  return rawPValues.map(p => {
    if (p === null) return null;
    return Math.min(1.0, p * m);
  });
}

export function applyBenjaminiHochberg(rawPValues: (number | null)[]): (number | null)[] {
  // Extract indices of non-null p-values
  const validIndices: { p: number; idx: number }[] = [];
  rawPValues.forEach((p, idx) => {
    if (p !== null) {
      validIndices.push({ p, idx });
    }
  });

  const m = validIndices.length;
  if (m === 0) return rawPValues;

  // Sort by p-value in ascending order
  validIndices.sort((a, b) => a.p - b.p);

  // Apply BH formula: p_adj = p * m / i
  const adjustedList: { adjP: number; idx: number }[] = [];
  for (let i = 0; i < m; i++) {
    const rank = i + 1;
    const rawP = validIndices[i].p;
    const adjP = (rawP * m) / rank;
    adjustedList.push({ adjP, idx: validIndices[i].idx });
  }

  // Ensure monotonicity from back to front
  for (let i = m - 2; i >= 0; i--) {
    adjustedList[i].adjP = Math.min(adjustedList[i].adjP, adjustedList[i + 1].adjP);
  }

  // Map back to original indices
  const result = [...rawPValues];
  adjustedList.forEach(item => {
    result[item.idx] = Math.min(1.0, Math.max(0, item.adjP));
  });

  return result;
}
