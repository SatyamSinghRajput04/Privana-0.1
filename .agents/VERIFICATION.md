# ✅ Privana Verification & Definition of Done (VERIFICATION.md)

A task or pull request is **never considered done** merely because compilation succeeded. Every modification must pass the complete 10-point Quality Gate.

---

## 📋 The 10-Point Quality Gate Checklist

Before marking any task complete, verify that all 10 checkboxes are satisfied:

- [ ] **1. TypeScript Compilation**: `npm run build` (`tsc -b && vite build`) passes with 0 errors.
- [ ] **2. Analytical Unit Tests**: All domain unit tests pass (`runAnalyticsQuestion.test.ts`, `correlation.test.ts`).
- [ ] **3. Golden-Result Parity**: New engine results match golden reference values within statistical tolerance ($\epsilon < 10^{-5}$).
- [ ] **4. Statistical Edge Cases Tested**:
  - `null`, `undefined`, empty strings, `NaN`, `Infinity` handled safely.
  - Zero-variance inputs return explicit degenerate status instead of misleading $r=0$.
  - Negative numbers, floating points, and mixed binary types verified.
- [ ] **5. Visual Contract Integrity**:
  - Recharts renders directly from `VisualContract`.
  - No independent mathematical recalculation in UI components.
- [ ] **6. No Fabricated Values**: UI displays explicit error or warning states if data is missing or ambiguous.
- [ ] **7. Zero Hardcoding**: No dataset-specific column names (`gender`, `sleep_hours`, etc.) in generic pipelines.
- [ ] **8. Zero Data Egress**: 100% of computation remains in-browser; zero network leaks.
- [ ] **9. Memory & DOM Protection**:
  - Preview queries strictly capped at `LIMIT 50`.
  - Scatter plots capped at 2,000 reservoir points.
- [ ] **10. Documentation Synchronized**:
  - `STATE.json`, `JOURNAL.md`, and `MEMORY.md` updated.
