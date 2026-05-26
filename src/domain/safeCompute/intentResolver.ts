export type ResolvedQATarget = {
  intent: 'correlation' | 'regression' | 'distribution' | 'feature_importance' | 'unsupported';
  target: string | null;
};

type SchemaColumn = {
  name: string;
  type: 'numeric' | 'category' | 'date' | 'text' | 'boolean' | 'identifier';
};

// Levenshtein distance algorithm for robust fuzzy column matching
function getLevenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // Deletion
          dp[i][j - 1] + 1,    // Insertion
          dp[i - 1][j - 1] + 1 // Substitution
        );
      }
    }
  }
  return dp[m][n];
}

function getFuzzySimilarity(s1: string, s2: string): number {
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;
  const dist = getLevenshteinDistance(s1, s2);
  return 1.0 - dist / maxLength;
}

export function resolveQATarget(question: string, schema: SchemaColumn[]): ResolvedQATarget {
  const ql = question.toLowerCase();

  // 1. Intent Detection
  let intent: 'correlation' | 'regression' | 'distribution' | 'feature_importance' | 'unsupported' = 'unsupported';

  if (/strongest\s+relationship|relationship\s+with|most\s+related|feature\s+importance|which\s+feature/.test(ql)) {
    intent = 'feature_importance';
  } else if (/correlat|scatter|relationship|related|vs\s|versus/.test(ql)) {
    intent = 'correlation';
  } else if (/regression|linear\s+model|fit\s+a\s+line|predict/.test(ql)) {
    // Note: predict goes to regression in standard OLS Q&A path
    intent = 'regression';
  } else if (/histogram|distribution\s+of|frequency|spread|percentile|quartile|median/.test(ql)) {
    intent = 'distribution';
  } else {
    // If it's a generic word like "average" or "count", map to unsupported for special statistical compute, 
    // letting the main generator handle standard aggregate queries, OR map as correlation MVP fallback
    intent = 'unsupported';
  }

  // 2. Target Column Fuzzy Resolution
  let target: string | null = null;
  let bestScore = 0;

  // Split question into words and clean them
  const words = ql.split(/[^a-z0-9_]+/).map(w => w.trim()).filter(Boolean);

  for (const col of schema) {
    const colLower = col.name.toLowerCase();

    // Exact word match checks (enforcing word boundaries to avoid substring false positives like "id" matching "identify")
    const wordBoundaryRegex = new RegExp('\\b' + colLower.replace(/_/g, '[_ ]') + '\\b', 'i');
    if (words.includes(colLower) || wordBoundaryRegex.test(question)) {
      target = col.name;
      break; // Exact match found, stop searching
    }

    // Levenshtein fuzzy matching on individual query words to find approximate column mentions
    for (const word of words) {
      if (word.length >= 3) {
        const sim = getFuzzySimilarity(word, colLower);
        if (sim > bestScore && sim > 0.8) {
          bestScore = sim;
          target = col.name;
        }
      }
    }
  }

  // If no target resolved but target outcomes like depression or anxiety are in the schema, use them as defaults
  if (!target) {
    const defaultTargets = ['depression_label', 'stress_level', 'anxiety_level', 'sleep_hours'];
    for (const defT of defaultTargets) {
      const found = schema.find(c => c.name.toLowerCase() === defT);
      if (found) {
        target = found.name;
        break;
      }
    }
  }

  // Final fallback to first numeric column if still not resolved
  if (!target && schema.length > 0) {
    const numericCol = schema.find(c => c.type === 'numeric');
    if (numericCol) {
      target = numericCol.name;
    } else {
      target = schema[0].name;
    }
  }

  return { intent, target };
}
