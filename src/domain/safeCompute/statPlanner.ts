export type ColumnProfile = {
  name: string;
  type: 'numeric' | 'binary_categorical' | 'multi_categorical' | 'date' | 'unsupported';
  uniqueValues: any[];
  missingCount: number;
  sampleSize: number;
  isPII: boolean;
  isConstant: boolean;
};

export type StatisticalMethod =
  | 'Pearson'
  | 'Spearman'
  | 'Point-Biserial'
  | 'ANOVA'
  | 'Cramer\'s V'
  | 'Chi-Square';

export function profileColumn(name: string, rows: any[]): ColumnProfile {
  const sampleRows = rows.length > 2000 ? rows.slice(0, 2000) : rows;
  const sampleSize = sampleRows.length;
  let missingCount = 0;
  const uniqueSet = new Set<any>();
  let numericValids = 0;
  let dateValids = 0;

  // Simple PII heuristical scanners
  const nameLower = name.toLowerCase();
  const isPIIName = /email|phone|phone_number|mobile|ssn|aadhaar|pan_card|passport|first_name|last_name|fullname|username|address|ip_address|password|secret|key|token/.test(nameLower);

  sampleRows.forEach(r => {
    const val = r[name];
    if (val === null || val === undefined || val === '') {
      missingCount++;
      return;
    }

    uniqueSet.add(val);

    // Numeric check
    if (typeof val === 'number' && !isNaN(val)) {
      numericValids++;
    } else if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
      numericValids++;
    }

    // Date check
    if (typeof val === 'string' && val.trim() !== '') {
      const dateParsed = Date.parse(val);
      if (!isNaN(dateParsed) && isNaN(Number(val)) && val.includes('-') || val.includes('/')) {
        dateValids++;
      }
    }
  });

  const validCount = sampleSize - missingCount;
  const uniqueValues = Array.from(uniqueSet);

  let type: 'numeric' | 'binary_categorical' | 'multi_categorical' | 'date' | 'unsupported' = 'unsupported';

  if (validCount > 0) {
    if (numericValids / validCount > 0.8) {
      type = 'numeric';
    } else if (dateValids / validCount > 0.8) {
      type = 'date';
    } else if (uniqueValues.length === 2) {
      type = 'binary_categorical';
    } else if (uniqueValues.length > 2 && uniqueValues.length <= Math.max(15, sampleSize * 0.15)) {
      type = 'multi_categorical';
    } else {
      type = 'unsupported';
    }
  }

  // Treat index/ID columns as unsupported/identifiers
  if (nameLower === 'id' || nameLower === 'index' || nameLower === 'row_id' || nameLower === 'serial') {
    type = 'unsupported';
  }

  return {
    name,
    type,
    uniqueValues,
    missingCount,
    sampleSize,
    isPII: isPIIName,
    isConstant: uniqueValues.length <= 1
  };
}

export function selectStatisticalMethod(
  target: ColumnProfile,
  feature: ColumnProfile
): StatisticalMethod | 'unsupported' {
  if (target.type === 'unsupported' || feature.type === 'unsupported') {
    return 'unsupported';
  }

  // Method 1: Numeric vs Numeric -> Pearson/Spearman (default Pearson)
  if (target.type === 'numeric' && feature.type === 'numeric') {
    return 'Pearson';
  }

  // Method 2: Binary Categorical vs Numeric (either direction) -> Point-Biserial
  if (
    (target.type === 'binary_categorical' && feature.type === 'numeric') ||
    (target.type === 'numeric' && feature.type === 'binary_categorical')
  ) {
    return 'Point-Biserial';
  }

  // Method 3: Binary Categorical vs Categorical -> Chi-Square / Cramer's V
  if (target.type === 'binary_categorical' && feature.type === 'binary_categorical') {
    return 'Chi-Square';
  }

  // Method 4: Multi-Category vs Numeric (either direction) -> ANOVA / Eta-Squared
  if (
    (target.type === 'multi_categorical' && feature.type === 'numeric') ||
    (target.type === 'numeric' && feature.type === 'multi_categorical')
  ) {
    return 'ANOVA';
  }

  // Method 5: Multi-Category vs Categorical (either direction) -> Cramer's V
  if (
    (target.type === 'multi_categorical' && feature.type === 'multi_categorical') ||
    (target.type === 'binary_categorical' && feature.type === 'multi_categorical') ||
    (target.type === 'multi_categorical' && feature.type === 'binary_categorical')
  ) {
    return 'Cramer\'s V';
  }

  return 'unsupported';
}
