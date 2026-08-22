// ─────────────────────────────────────────────────────────────────────────────
// src/domain/compute/index.ts
// Entry point for the compute engine layer.
// ─────────────────────────────────────────────────────────────────────────────

import { ComputeEngine } from './ComputeEngine';
import { inMemoryComputeEngine } from './inMemoryComputeEngine';

export * from './ComputeEngine';
export * from './inMemoryComputeEngine';

/** Default active compute engine instance */
export const computeEngine: ComputeEngine = inMemoryComputeEngine;
