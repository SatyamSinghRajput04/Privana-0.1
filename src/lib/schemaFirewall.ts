/**
 * Privana Schema Firewall Middleware
 * Obfuscates column schemas and queries before they leave the device to prevent PII/metadata leakage to cloud LLMs,
 * and reconstructs the generated SQL back to its original column schemas locally.
 */

export interface ColumnSchema {
  name: string;
  type: string;
}

export interface ObfuscationMap {
  originalToPlaceholder: Record<string, string>;
  placeholderToOriginal: Record<string, string>;
  datasetOriginal: string;
  datasetPlaceholder: string;
}

/**
 * Creates a map and obfuscates the schema structure.
 */
export function obfuscateSchema(datasetName: string, columns: ColumnSchema[]): { obfuscatedColumns: ColumnSchema[]; map: ObfuscationMap } {
  const originalToPlaceholder: Record<string, string> = {};
  const placeholderToOriginal: Record<string, string> = {};

  const datasetPlaceholder = 't0';

  const obfuscatedColumns = columns.map((col, idx) => {
    const placeholder = `c${idx}`;
    originalToPlaceholder[col.name.toLowerCase()] = placeholder;
    placeholderToOriginal[placeholder] = col.name;
    return {
      name: placeholder,
      type: col.type
    };
  });

  return {
    obfuscatedColumns,
    map: {
      originalToPlaceholder,
      placeholderToOriginal,
      datasetOriginal: datasetName,
      datasetPlaceholder
    }
  };
}

/**
 * Replaces column identifiers inside the natural language question.
 */
export function obfuscateQuestion(question: string, map: ObfuscationMap): string {
  let obfuscated = question;

  // Sort original keys by length descending to prevent substring collisions (e.g. replacing 'age' inside 'manager_age')
  const sortedOriginals = Object.keys(map.originalToPlaceholder).sort((a, b) => b.length - a.length);

  for (const original of sortedOriginals) {
    const placeholder = map.originalToPlaceholder[original];
    
    // Use word boundaries to replace the words in the natural language text
    // Handles spaces and underscores
    const esc = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\b' + esc + '\\b', 'gi');
    obfuscated = obfuscated.replace(regex, placeholder);
    
    // Also replace spaces replaced with underscores (standard column names)
    const spaced = original.replace(/_/g, ' ');
    const escSpaced = spaced.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexSpaced = new RegExp('\\b' + escSpaced + '\\b', 'gi');
    obfuscated = obfuscated.replace(regexSpaced, placeholder);
  }

  return obfuscated;
}

/**
 * Restores the original table and column names inside the generated SQL query.
 */
export function restoreSQL(generatedSql: string, map: ObfuscationMap): string {
  let restored = generatedSql;

  // Replace placeholder table back to original
  const tblRegex = new RegExp(`\\b${map.datasetPlaceholder}\\b`, 'g');
  restored = restored.replace(tblRegex, map.datasetOriginal);

  // Sort placeholders by length descending (c10, c11 before c1)
  const sortedPlaceholders = Object.keys(map.placeholderToOriginal).sort((a, b) => b.length - a.length);

  for (const placeholder of sortedPlaceholders) {
    const original = map.placeholderToOriginal[placeholder];
    
    // Replace column placeholders inside the SQL string
    // Works with backticks, double quotes, or unquoted word boundaries
    const colRegex = new RegExp(`\\b${placeholder}\\b`, 'g');
    restored = restored.replace(colRegex, original);
  }

  return restored;
}
