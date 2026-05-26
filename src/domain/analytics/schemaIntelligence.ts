// ─────────────────────────────────────────────────────────────────────────────
// src/domain/analytics/schemaIntelligence.ts
// S1 SCAFFOLD STUB — Implementation added in Step S4.
// ─────────────────────────────────────────────────────────────────────────────

export const SchemaIntelligence = {
  /**
   * Resolves a raw user phrase to a ranked list of matching column names.
   * S4 implementation: alias map + role inference + confidence scoring.
   */
  resolveColumn(_phrase: string, _profile: unknown): never {
    throw new Error('not implemented: SchemaIntelligence.resolveColumn (Step S4)');
  },

  /**
   * Infers the role of a column for a given intent:
   * one of: metric | groupBy | filter | target | time | id.
   * S4 implementation.
   */
  inferRole(_columnName: string, _intent: unknown): never {
    throw new Error('not implemented: SchemaIntelligence.inferRole (Step S4)');
  },

  /**
   * Generates a list of suggested questions from a dataset profile.
   * Used by the Suggested Questions Strip (Step W2).
   */
  suggestQuestions(_profile: unknown): never {
    throw new Error('not implemented: SchemaIntelligence.suggestQuestions (Step S4)');
  },
};
