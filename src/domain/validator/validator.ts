import { DatasetProfile, ColumnProfile, QualityMetrics, PiiFlag } from '../types/dataset';

/**
 * Generate a simple hash from string content for cache keys
 */
export function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return 'viq_hash_' + Math.abs(hash).toString(16);
}

/**
 * Clean cell values from common encoding artifacts and strip whitespace
 */
function cleanValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const cleaned = val.trim();
    if (cleaned === '' || cleaned.toLowerCase() === 'null' || cleaned === 'NaN') return null;
    return cleaned;
  }
  return val;
}

export const DatasetValidator = {
  profile(rows: any[], filename: string): DatasetProfile {
    const profiledAt = new Date().toISOString();
    const profilerVersion = '1.0.1';
    const datasetHash = generateHash(filename + '_' + rows.length + '_' + JSON.stringify(rows.slice(0, 10)));

    // 1. Basic Shape Validations
    if (!rows || rows.length === 0) {
      return {
        datasetHash,
        rowCount: 0,
        columnCount: 0,
        shape: 'empty',
        columns: [],
        qualityMetrics: { missingValuesPct: 100, duplicatesCount: 0, criticalIssuesCount: 1, criticalIssues: ['Dataset is empty'] },
        piiFlags: [],
        profiledAt,
        profilerVersion
      };
    }

    // Extract headers (keys from first object)
    const rawHeaders = Object.keys(rows[0] || {});
    const columnsCount = rawHeaders.length;

    // Filter headers to remove empty or control strings
    const headers = rawHeaders.filter(h => h && h.trim().length > 0);

    if (headers.length === 0) {
      return {
        datasetHash,
        rowCount: rows.length,
        columnCount: 0,
        shape: 'corrupted',
        columns: [],
        qualityMetrics: { missingValuesPct: 100, duplicatesCount: 0, criticalIssuesCount: 1, criticalIssues: ['No valid column headers found'] },
        piiFlags: [],
        profiledAt,
        profilerVersion
      };
    }

    // 2. Detect JSON-LD Metadata and schema descriptors
    // Detect keys starting with @ (context, type, graph) or standard descriptor tags
    const METADATA_KEYS = ['@context', '@type', '@graph', '@id', 'license', 'creator', 'publisher', 'dateModified', 'measurementTechnique', 'variableMeasured', 'isBasedOn'];
    const hasDirectMetadataKeys = headers.some(h => METADATA_KEYS.includes(h) || h.startsWith('@'));

    let isMetadataShape = hasDirectMetadataKeys;
    if (!isMetadataShape && rows.length < 8) {
      let keyValLikeCount = 0;
      rows.forEach(r => {
        const values = Object.values(r);
        values.forEach(v => {
          if (typeof v === 'string' && (v.includes(':') || v.toLowerCase().includes('created') || v.toLowerCase().includes('dataset'))) {
            keyValLikeCount++;
          }
        });
      });
      // If we have key-value strings in a small file, it's metadata
      if (keyValLikeCount >= 2) {
        isMetadataShape = true;
      }
    }

    if (isMetadataShape) {
      return {
        datasetHash,
        rowCount: rows.length,
        columnCount: columnsCount,
        shape: 'metadata',
        columns: [],
        qualityMetrics: { missingValuesPct: 0, duplicatesCount: 0, criticalIssuesCount: 1, criticalIssues: ['File is structured as metadata descriptors rather than tabular rows'] },
        piiFlags: [],
        profiledAt,
        profilerVersion
      };
    }

    // 3. Columns Analysis
    const columnProfiles: ColumnProfile[] = [];
    const piiFlags: PiiFlag[] = [];
    const criticalIssues: string[] = [];
    let totalCells = 0;
    let nullCells = 0;

    // Common PII Header keywords
    const piiNameKeywords = ['name', 'full_name', 'firstname', 'lastname', 'owner', 'student_name', 'employee_name'];
    const piiEmailKeywords = ['email', 'mail', 'e-mail'];
    const piiPhoneKeywords = ['phone', 'tel', 'mobile', 'contact_no', 'telephone'];
    const piiNationalIdKeywords = ['ssn', 'national_id', 'passport', 'tax_id', 'aadhaar', 'sin'];

    // Regex scanners
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/;

    headers.forEach(colName => {
      let nulls = 0;
      let numbersCount = 0;
      let booleansCount = 0;
      let datesCount = 0;
      let stringsCount = 0;
      const uniqueValuesSet = new Set<any>();

      // PII Heuristics
      const isPiiName = piiNameKeywords.some(kw => colName.toLowerCase().includes(kw));
      let isPiiEmail = piiEmailKeywords.some(kw => colName.toLowerCase().includes(kw));
      let isPiiPhone = piiPhoneKeywords.some(kw => colName.toLowerCase().includes(kw));
      let isPiiNationalId = piiNationalIdKeywords.some(kw => colName.toLowerCase().includes(kw));

      rows.forEach(row => {
        const rawVal = row[colName];
        const val = cleanValue(rawVal);
        totalCells++;

        if (val === null) {
          nulls++;
          nullCells++;
          return;
        }

        uniqueValuesSet.add(val);

        // Analyze value type
        const strVal = String(val).trim();
        const numVal = Number(val);

        // 1. Check boolean
        if (strVal.toLowerCase() === 'true' || strVal.toLowerCase() === 'false' || val === true || val === false) {
          booleansCount++;
        }
        // 2. Check numeric
        else if (!isNaN(numVal) && isFinite(numVal)) {
          numbersCount++;
        }
        // 3. Check date
        else if (isNaN(numVal) && !isNaN(Date.parse(strVal)) && strVal.length > 5 && (strVal.includes('-') || strVal.includes('/') || strVal.includes(':'))) {
          datesCount++;
        }
        // 4. Fallback text
        else {
          stringsCount++;
        }

        // PII content regex scans
        if (!isPiiEmail && emailRegex.test(strVal)) isPiiEmail = true;
        if (!isPiiPhone && phoneRegex.test(strVal)) isPiiPhone = true;
        if (!isPiiNationalId && ssnRegex.test(strVal)) isPiiNationalId = true;
      });

      const nonNullCount = rows.length - nulls;
      const nullPct = nonNullCount === 0 ? 100 : (nulls / rows.length) * 100;

      // Classify column type
      let inferredType: 'numeric' | 'category' | 'date' | 'text' | 'boolean' | 'identifier' = 'text';

      if (nonNullCount > 0) {
        if (booleansCount / nonNullCount > 0.8) {
          inferredType = 'boolean';
        } else if (numbersCount / nonNullCount > 0.8) {
          // Check if unique identifier (e.g. 100% unique sequence of integers like IDs)
          const isUniqueSeq = uniqueValuesSet.size === nonNullCount && 
            (colName.toLowerCase().includes('id') || colName.toLowerCase().includes('key') || colName.toLowerCase().includes('code'));
          inferredType = isUniqueSeq ? 'identifier' : 'numeric';
        } else if (datesCount / nonNullCount > 0.8) {
          inferredType = 'date';
        } else {
          // Check high distinct cardinality to separate category from text
          const cardinalityRatio = uniqueValuesSet.size / nonNullCount;
          if (cardinalityRatio < 0.25 || uniqueValuesSet.size <= 25) {
            inferredType = 'category';
          } else if (uniqueValuesSet.size === nonNullCount && (colName.toLowerCase().includes('id') || colName.toLowerCase().includes('key'))) {
            inferredType = 'identifier';
          } else {
            inferredType = 'text';
          }
        }
      }

      // Check mixed types in numeric
      if (inferredType === 'numeric' && stringsCount > 0) {
        criticalIssues.push(`Column "${colName}" is classified as numeric but contains ${stringsCount} string values.`);
      }

      // Register PII Flags
      if (isPiiEmail) {
        piiFlags.push({ columnName: colName, piiType: 'email' });
      } else if (isPiiPhone) {
        piiFlags.push({ columnName: colName, piiType: 'phone' });
      } else if (isPiiNationalId) {
        piiFlags.push({ columnName: colName, piiType: 'national_id' });
      } else if (isPiiName) {
        piiFlags.push({ columnName: colName, piiType: 'name' });
      }

      columnProfiles.push({
        name: colName,
        type: inferredType,
        nullPct: parseFloat(nullPct.toFixed(2)),
        uniqueValues: Array.from(uniqueValuesSet).slice(0, 20) // cache sample unique values
      });
    });

    // 4. Quality Metrics
    // Calculate duplicate rows
    const rowStrings = rows.map(r => JSON.stringify(r));
    const uniqueRowsSet = new Set(rowStrings);
    const duplicatesCount = rows.length - uniqueRowsSet.size;

    const missingValuesPct = totalCells === 0 ? 100 : (nullCells / totalCells) * 100;

    const qualityMetrics: QualityMetrics = {
      missingValuesPct: parseFloat(missingValuesPct.toFixed(2)),
      duplicatesCount,
      criticalIssuesCount: criticalIssues.length,
      criticalIssues
    };

    return {
      datasetHash,
      rowCount: rows.length,
      columnCount: columnsCount,
      shape: 'tabular',
      columns: columnProfiles,
      qualityMetrics,
      piiFlags,
      profiledAt,
      profilerVersion
    };
  }
};
