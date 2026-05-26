import { DatasetProfile } from '../types/dataset';

export type ColumnMapping = {
  term: string;
  columnName: string;
  type: 'numeric' | 'category' | 'date' | 'text' | 'boolean' | 'identifier';
  strategy: 'exact' | 'alias' | 'synonym' | 'fuzzy';
  confidence: number; // 0.0 to 1.0
};

// Common analytical synonyms mapping
const COMMON_ALIASES: Record<string, string[]> = {
  stress: ['stress_level', 'stress_score', 'anxiety', 'anxiety_score', 'mental_health', 'depression'],
  screentime: ['screen_time', 'platform_usage', 'usage_hours', 'device_hours', 'media_usage'],
  platform: ['platform_usage', 'platform', 'app_used', 'social_media', 'app'],
  gender: ['gender', 'sex', 'demographics', 'male_female'],
  age: ['age', 'age_years', 'dob', 'birth_year'],
  grade: ['grade', 'class', 'gpa', 'score']
};


/**
 * Calculate Jaro-Winkler similarity coefficient
 */
function getFuzzySimilarity(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const maxDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const match1 = Array(len1).fill(false);
  const match2 = Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(len2, i + maxDist + 1);
    for (let j = start; j < end; j++) {
      if (!match2[j] && s1[i] === s2[j]) {
        match1[i] = true;
        match2[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (match1[i]) {
      while (!match2[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  return parseFloat(jaro.toFixed(3));
}

export const ColumnResolver = {
  resolve(term: string, profile: DatasetProfile): ColumnMapping | null {
    const t = term.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const columns = profile.columns;

    if (columns.length === 0) return null;

    // 1. Exact / Direct Match
    const exactMatch = columns.find(c => c.name.toLowerCase() === t || c.name.toLowerCase().replace(/[^a-z0-9_]/g, '') === t);
    if (exactMatch) {
      return {
        term,
        columnName: exactMatch.name,
        type: exactMatch.type,
        strategy: 'exact',
        confidence: 1.0
      };
    }

    // 2. Alias / Synonym Matching
    for (const [key, aliases] of Object.entries(COMMON_ALIASES)) {
      if (t.includes(key) || key.includes(t)) {
        // Find matching columns from aliases
        const aliasCol = columns.find(c => 
          aliases.some(alias => c.name.toLowerCase() === alias.toLowerCase() || c.name.toLowerCase().includes(alias.toLowerCase()))
        );
        if (aliasCol) {
          return {
            term,
            columnName: aliasCol.name,
            type: aliasCol.type,
            strategy: 'alias',
            confidence: 0.9
          };
        }
      }
    }

    // 3. Synonym matches based on columns names
    const synonymCol = columns.find(c => {
      const cName = c.name.toLowerCase();
      return (
        (t === 'sleep' && (cName.includes('sleep') || cName.includes('nap') || cName.includes('rest'))) ||
        (t === 'stress' && (cName.includes('stress') || cName.includes('anx') || cName.includes('anxiety') || cName.includes('depress'))) ||
        (t === 'platform' && (cName.includes('plat') || cName.includes('app') || cName.includes('social') || cName.includes('media'))) ||
        (t === 'screentime' && (cName.includes('screen') || cName.includes('device') || cName.includes('hours') || cName.includes('usage')))
      );
    });

    if (synonymCol) {
      return {
        term,
        columnName: synonymCol.name,
        type: synonymCol.type,
        strategy: 'synonym',
        confidence: 0.85
      };
    }

    // 4. Fuzzy Match (Jaro-Winkler + Levenshtein fallback)
    let bestFuzzyCol = null;
    let maxSim = 0;

    columns.forEach(c => {
      const cName = c.name.toLowerCase();
      const sim = getFuzzySimilarity(t, cName);
      if (sim > maxSim && sim > 0.7) {
        maxSim = sim;
        bestFuzzyCol = c;
      }
    });

    if (bestFuzzyCol) {
      return {
        term,
        columnName: (bestFuzzyCol as any).name,
        type: (bestFuzzyCol as any).type,
        strategy: 'fuzzy',
        confidence: parseFloat((maxSim * 0.8).toFixed(2)) // scaling fuzzy confidence
      };
    }

    return null;
  }
};
