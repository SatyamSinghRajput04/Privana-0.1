/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/types.ts
// S1 SCAFFOLD STUB — Full contracts added in Step S2.
// Every type is `any` until S2 replaces this file completely.
// Do NOT depend on these types in production code until after Step S2.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_INTENTS = [] as const;

export type SupportedIntent = (typeof SUPPORTED_INTENTS)[number];
export type AnalysisIntent   = any;
export type ColumnRole       = any;
export type ColumnMatch      = any;
export type Filter           = any;
export type AnalysisPlan     = any;
export type Provenance       = any;
export type ExecutorResult   = any;
export type ChartSpec        = any;
export type Clarification    = any;
export type AnalyticsResult  = any;
