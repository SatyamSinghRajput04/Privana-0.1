import { QueryPlan } from '../types/plan';

export type VerificationOutcome = {
  success: boolean;
  issues: string[];
  requiresRepair: boolean;
  suppressGroups?: string[]; // Group labels that failed minimum cell size threshold (n < 5)
};

export const ResultVerifier = {
  verify(plan: QueryPlan, rows: any[]): VerificationOutcome {
    const issues: string[] = [];
    let requiresRepair = false;
    const suppressGroups: string[] = [];

    // 1. Basic check
    if (!rows || rows.length === 0) {
      return {
        success: false,
        issues: ['Query returned 0 record rows'],
        requiresRepair: false
      };
    }

    // 2. Validate row format and search for NaN / Infinity
    let nanMatches = 0;

    rows.forEach((row, idx) => {
      Object.entries(row).forEach(([col, val]) => {
        if (typeof val === 'number') {
          if (isNaN(val)) {
            nanMatches++;
            issues.push(`Row index ${idx}: Numeric column "${col}" contains NaN`);
          } else if (!isFinite(val)) {
            nanMatches++;
            issues.push(`Row index ${idx}: Numeric column "${col}" contains Infinity`);
          }
        } else if (typeof val === 'string') {
          // If string contains unparseable symbols where numeric is expected
          if ((val.toLowerCase() === 'nan' || val.toLowerCase() === 'infinity') && plan.intent !== 'unsupported') {
            nanMatches++;
            issues.push(`Row index ${idx}: String column "${col}" has value "${val}"`);
          }
        }
      });

      // 3. Enforce Invariant I6: Minimum Cell Size For Grouped Statistics (n < 5)
      // Check if row has count/frequency column
      const countVal = row.count !== undefined ? Number(row.count) : row.frequency !== undefined ? Number(row.frequency) : null;
      if (countVal !== null && countVal < 5 && countVal > 0) {
        const groupLabel = row.category_label || row.date_label || row.bin || row.id_label || `row_${idx}`;
        suppressGroups.push(String(groupLabel));
        issues.push(`Group statistic "${groupLabel}" suppressed: sample size ${countVal} is below minimum threshold of 5`);
      }
    });

    if (nanMatches > 0) {
      // Type mismatches or mathematical errors require bounded repairs
      requiresRepair = true;
    }

    // 4. Validate percentages sum for composition breakdown
    if (plan.intent === 'composition') {
      const pctSum = rows.reduce((s, r) => s + (Number(r.pct) || 0), 0);
      if (pctSum > 0 && Math.abs(pctSum - 100) > 1.5) {
        issues.push(`Composition percentages sum to ${pctSum.toFixed(2)}% (expected near 100%)`);
      }
    }

    return {
      success: issues.length === 0,
      issues,
      requiresRepair,
      suppressGroups: suppressGroups.length > 0 ? suppressGroups : undefined
    };
  }
};
