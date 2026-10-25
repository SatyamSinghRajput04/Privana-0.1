// ─────────────────────────────────────────────────────────────────────────────
// src/store/useAnswerWorkspaceStore.ts
// QUESTION → MULTIPLE PLANS → MULTIPLE CHARTS
//
// One user question owns exactly one questionId. That question can own one or
// more planIds/results/charts:
//
//   questionId
//     └── planId(s)
//           └── AnalyticsResult
//                 └── VisualContract / chart
//
// This is intentionally a separate, additive store from useCockpitStore's
// committedVisual/committedPlanId singleton — that mechanism is untouched.
// This one generalizes the SAME ownership idea (a chart must know which
// question+plan it belongs to) to a question owning MULTIPLE charts instead
// of exactly one.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { AnalyticsResult } from '../domain/analytics/types';

export interface AnswerEntry {
  planId: string;
  subQuestion: string;
  result: Extract<AnalyticsResult, { status: 'computed' | 'partial' }>;
  addedAt: number;
}

export interface AnswerWorkspaceState {
  questionId: string;
  question: string;
  sheetId: string;
  matchedPattern?: string;
  entries: AnswerEntry[];
  createdAt: number;
}

interface AnswerWorkspaceStore {
  activeWorkspace: AnswerWorkspaceState | null;

  // A sub-question typed into "+ Create another chart" is queued here so
  // AnalyzePage (which owns the loaded rows/profile/table) can execute it
  // through the normal pipeline, then call addEntry. Kept as a simple
  // request/response handoff so this store never needs to know how to run
  // a query itself — it only tracks question/plan ownership.
  pendingChartRequest: string | null;

  /** Starts a brand-new question, replacing any previous answer workspace outright. */
  startNewQuestion: (question: string, sheetId: string, matchedPattern?: string) => string;

  /**
   * Appends a computed/partial result as a new chart under the given
   * questionId. Ownership-guarded: silently discarded if questionId no
   * longer matches the active workspace (the user asked something new
   * before this sub-plan finished) — this is what prevents a superseded
   * question's result from ever rendering under a newer one.
   */
  addEntry: (
    questionId: string,
    planId: string,
    subQuestion: string,
    result: Extract<AnalyticsResult, { status: 'computed' | 'partial' }>
  ) => void;

  requestAdditionalChart: (subQuestion: string) => void;
  clearPendingChartRequest: () => void;

  clearWorkspace: () => void;
}

let questionCounter = 0;

export const useAnswerWorkspaceStore = create<AnswerWorkspaceStore>((set, get) => ({
  activeWorkspace: null,
  pendingChartRequest: null,

  startNewQuestion: (question, sheetId, matchedPattern) => {
    questionCounter += 1;
    const questionId = `q_${Date.now()}_${questionCounter}`;
    set({
      activeWorkspace: {
        questionId,
        question,
        sheetId,
        matchedPattern,
        entries: [],
        createdAt: Date.now(),
      },
      pendingChartRequest: null,
    });
    return questionId;
  },

  addEntry: (questionId, planId, subQuestion, result) => {
    const current = get().activeWorkspace;
    if (!current || current.questionId !== questionId) return;
    if (current.entries.some(e => e.planId === planId)) return; // idempotency guard
    set({
      activeWorkspace: {
        ...current,
        entries: [...current.entries, { planId, subQuestion, result, addedAt: Date.now() }],
      },
    });
  },

  requestAdditionalChart: (subQuestion) => set({ pendingChartRequest: subQuestion }),
  clearPendingChartRequest: () => set({ pendingChartRequest: null }),

  clearWorkspace: () => set({ activeWorkspace: null, pendingChartRequest: null }),
}));
