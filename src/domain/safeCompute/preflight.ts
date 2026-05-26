export type BlockReason = {
  reason: string;
  nextSteps: string[];
};

export function validateDatasetSafety(rows: any[], tableName: string): BlockReason | null {
  // Guard 1: Empty dataset or undefined rows
  if (!rows || rows.length === 0) {
    return {
      reason: `The loaded dataset "${tableName}" contains 0 rows of data.`,
      nextSteps: [
        'Go to the "Datasets" view in the left sidebar.',
        `Delete the dataset "${tableName}".`,
        'Upload the real CSV or JSON array containing actual respondent records.'
      ]
    };
  }

  // Guard 2: Metadata / Schema descriptor detection
  const firstRow = rows[0];
  if (firstRow && typeof firstRow === 'object') {
    const keys = Object.keys(firstRow);
    const METADATA_SIGNALS = [
      '@context', '@type', 'license', 'creator', 'publisher',
      'dateModified', 'dateCreated', 'isBasedOn', 'measurementTechnique',
      'variableMeasured', 'sameAs'
    ];
    const foundSignals = METADATA_SIGNALS.filter(sig => keys.includes(sig));
    if (foundSignals.length >= 2) {
      return {
        reason: `"${tableName}" appears to be a dataset metadata/schema descriptor file (detected signals: ${foundSignals.slice(0, 4).join(', ')}).`,
        nextSteps: [
          'Go to the "Datasets" view in the left sidebar.',
          `Delete the dataset "${tableName}".`,
          'Upload the actual data file (which is usually a CSV with columns like sleep_hours, stress_level, etc., with one row per respondent).'
        ]
      };
    }
  }

  // Guard 3: Minimum row count threshold (Scientific requirement: n >= 3)
  if (rows.length < 3) {
    return {
      reason: `The dataset "${tableName}" has only ${rows.length} row${rows.length === 1 ? '' : 's'}. Safe statistical computation requires at least 3 rows.`,
      nextSteps: [
        'Upload a larger version of the dataset with at least 3 respondent records.',
        'Verify that the dataset was parsed correctly and is not corrupt.'
      ]
    };
  }

  // Guard 4: Schema column sanity check (no columns)
  if (!firstRow || typeof firstRow !== 'object' || Object.keys(firstRow).length === 0) {
    return {
      reason: `The dataset "${tableName}" has a corrupted or empty schema.`,
      nextSteps: [
        'Check the file format and structure of the uploaded dataset.',
        'Re-upload a clean, comma-separated CSV or JSON data array.'
      ]
    };
  }

  return null;
}
