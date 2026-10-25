// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/schemaLookup.ts
// Single source of truth for column type and label resolution in visualization.
// ─────────────────────────────────────────────────────────────────────────────

import { SCHEMA_PROFILES } from '../../lib/sqlEngine';
import { DatasetProfile } from '../types/dataset';

export type VizType = 'numeric' | 'category' | 'date';

export function formatFieldName(name: string): string {
  if (!name) return '';
  return String(name)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

export function toVizType(typeStr: string): VizType {
  const t = String(typeStr || '').toLowerCase();
  if (t === 'number' || t === 'integer' || t === 'numeric' || t === 'decimal') {
    return 'numeric';
  }
  if (t === 'date' || t === 'timestamp' || t === 'time') {
    return 'date';
  }
  return 'category';
}

export interface ResolvedColumn {
  key: string;
  label: string;
  vizType: VizType;
  cardinality?: number;
}

export function resolveColumns(tableName?: string, profile?: DatasetProfile): ResolvedColumn[] {
  if (tableName) {
    const contract = SCHEMA_PROFILES[tableName];
    if (contract && contract.columns && contract.columns.length > 0) {
      return contract.columns.map(c => ({
        key: c.name,
        label: formatFieldName(c.name),
        vizType: toVizType(c.type),
        cardinality: c.cardinality,
      }));
    }
  }

  if (profile && profile.columns && profile.columns.length > 0) {
    return profile.columns.map(c => ({
      key: c.name,
      label: formatFieldName(c.name),
      vizType: toVizType(c.type),
      cardinality: c.uniqueValues ? c.uniqueValues.length : undefined,
    }));
  }

  return [];
}
