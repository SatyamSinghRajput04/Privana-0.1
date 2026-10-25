export type FeatureImportanceRow = {
  rank: number;
  feature: string;
  method: 'Pearson' | 'Spearman' | 'Point-Biserial' | 'ANOVA' | 'Cramer\'s V' | 'Chi-Square';
  score: number;                    // Absolute value of correlation / association
  rawPValue: number | null;
  adjustedPValue: number | null;
  strength: 'Strong' | 'Moderate' | 'Weak' | 'None';
  direction: 'Positive' | 'Negative' | 'Associated' | 'None';
  sampleSize: number;
};

export type ExcludedFeature = {
  feature: string;
  reason: string;
};

export type SafeComputeInput = {
  question: string;
  tableName: string;
  rows: any[];
};

export type SafeComputeResult =
  | { 
      status: 'computed'; 
      answer: string;               // Rich, statistically sound Markdown analysis
      rows: FeatureImportanceRow[];  // Ranked feature rows
      excludedFeatures: ExcludedFeature[]; // Detailed reason why features were skipped
      confidence: 'High confidence' | 'Medium confidence' | 'Low confidence';
      warnings: string[];           // Low-sample, high-missingness, or ambiguous mapping warnings
      targetSummary?: {
        target: string;
        detectedType: 'numeric' | 'binary_categorical' | 'multi_categorical' | 'date' | 'unsupported';
        sampleSize: number;
        missingCount: number;
        uniqueCount: number;
        positiveClass?: string;
        mappingNote?: string;
      };
      chartSpec?: {
        type: 'feature_importance' | 'correlation' | 'regression' | 'histogram' | 'bins' | 'percentage';
        xKey: string;
        yKey: string;
      };
      audit: {
        sampleSize: number;
        excludedFeaturesCount: number;
        correctionMethod: 'Bonferroni' | 'Benjamini-Hochberg' | 'None';
        methodBreakdown: {
          method: string;
          featureCount: number;
        }[];
        runtimeMs: number;
      };
    }
  | { 
      status: 'blocked'; 
      reason: string;               // Clear, human-readable reason (e.g. "Descriptor file detected")
      nextSteps: string[];          // Guided list of valid actions for the user
      confidence: 'Blocked';
    }
  | { 
      status: 'unsupported'; 
      reason: string;               // Explanation of why the statistical path is unavailable
      suggestedQuestions: string[];  // List of alternative safe questions based on schema
      confidence: 'Low confidence';
    };
