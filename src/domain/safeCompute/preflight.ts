export type BlockReason = {
  reason: string;
  nextSteps: string[];
  bypassAllowed?: boolean;
};

export const METADATA_SIGNALS = [
  '@context',
  '@type',
  'license',
  'creator',
  'publisher',
  'dateModified',
  'dateCreated',
  'isBasedOn',
  'measurementTechnique',
  'variableMeasured',
  'sameAs'
];

export function validateDatasetSafety(
  rows: any[],
  tableName: string,
  options?: { allowMetadataBypass?: boolean }
): BlockReason | null {
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
  if (!options?.allowMetadataBypass) {
    const firstRow = rows[0];
    if (firstRow && typeof firstRow === 'object') {
      const keys = Object.keys(firstRow);
      const foundSignals = METADATA_SIGNALS.filter(sig => keys.includes(sig));
      if (foundSignals.length >= 2) {
        return {
          reason: `"${tableName}" appears to be a dataset metadata/schema descriptor file (detected signals: ${foundSignals.slice(0, 4).join(', ')}).`,
          bypassAllowed: true,
          nextSteps: [
            'If this is the correct data, click "Analyze Anyway".',
            'Otherwise, upload the actual respondent table.'
          ]
        };
      }
    }
  }

  // Guard 3: Schema column sanity check (no columns)
  const firstRow = rows[0];
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
