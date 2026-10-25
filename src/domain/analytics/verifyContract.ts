// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/verifyContract.ts
// Verifier gate for VisualContracts — ensures zero NaN/Infinity reaches UI renderers.
// ─────────────────────────────────────────────────────────────────────────────

import { VisualContract } from './types';

export function verifyContract(vc: VisualContract): VisualContract {
  if (!vc) {
    return Object.freeze({ kind: 'empty', schemaVersion: 1, reason: 'Null visual contract provided.' } as VisualContract);
  }

  if (vc.kind === 'empty') {
    return Object.freeze(vc);
  }

  const data = (vc as any).data;
  if (!data || !Array.isArray(data) || data.length === 0) {
    // For correlation summary or table rows, empty data is valid if explicit empty or zero count
    if (vc.kind !== 'tableRows' && vc.kind !== 'correlationSummary') {
      return Object.freeze({ kind: 'empty', schemaVersion: 1, reason: 'Contract produced no renderable series data.' } as VisualContract);
    }
  }

  // Deep-clone data rows before sanitizing to avoid mutating frozen input
  let needsClone = false;
  if (Array.isArray(data)) {
    for (const row of data) {
      if (row && typeof row === 'object') {
        for (const val of Object.values(row)) {
          if (typeof val === 'number' && !Number.isFinite(val)) {
            needsClone = true;
            break;
          }
        }
      }
      if (needsClone) break;
    }
  }

  if (needsClone) {
    const cleanData = data.map((row: any) => {
      if (!row || typeof row !== 'object') return row;
      const clone = { ...row };
      for (const [key, val] of Object.entries(clone)) {
        if (typeof val === 'number' && !Number.isFinite(val)) {
          clone[key] = 0;
        }
      }
      return clone;
    });
    const cleaned = { ...vc, data: cleanData } as VisualContract;
    return Object.freeze(cleaned);
  }

  return Object.freeze(vc);
}

