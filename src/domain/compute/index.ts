// ─────────────────────────────────────────────────────────────────────────────
// src/domain/compute/index.ts
// Entry point for the compute engine layer.
// ─────────────────────────────────────────────────────────────────────────────

import { ComputeEngine } from './ComputeEngine';
import { inMemoryComputeEngine } from './inMemoryComputeEngine';
import { duckdbComputeEngine, DuckDBComputeEngine } from './duckdb/DuckDBComputeEngine';

export * from './ComputeEngine';
export * from './inMemoryComputeEngine';
export { DuckDBComputeEngine, duckdbComputeEngine } from './duckdb/DuckDBComputeEngine';

/** Feature flag controlling default engine routing */
export const useDuckDB: boolean = true;

/** Default active compute engine instance (backed by DuckDBComputeEngine with inMemory fallback) */
export const computeEngine: ComputeEngine = useDuckDB ? duckdbComputeEngine : inMemoryComputeEngine;
