# 🛡️ Privana Change Governance Policy (CHANGE_POLICY.md)

To protect Privana from unintended regressions or architectural degradation, all modifications are categorized into three distinct change tiers with mandatory governance gates.

---

## 🚦 Change Tier Classification

### 🟢 Tier 1: Small Changes (Low Risk)
* **Scope**: Single-file bug fix, CSS/UI layout tweak, comment update, or typo correction.
* **Requirements**:
  - `npm run build` verification.
  - Update `JOURNAL.md`.

---

### 🟡 Tier 2: Medium Changes (Moderate Risk)
* **Scope**: Modifying an executor algorithm, extending an existing interface, adding a new chart type, or optimizing an in-memory loop.
* **Requirements**:
  - Full analytical test suite verification.
  - Golden-result parity verification against pre-migration output.
  - Empirical benchmark recording in `MEMORY.md`.
  - Update `STATE.json` and `JOURNAL.md`.

---

### 🔴 Tier 3: Large / Architectural Changes (High Risk)
* **Scope**: Database engine migration (e.g. DuckDB-WASM), changing `ComputeEngine` or `AnalyticsResult` contracts, altering state stores, or modifying NLU parsing.
* **Mandatory Governance Gate**:
  1. **Impact Analysis**: Identify all dependent callers and downstream consumers.
  2. **ADR Creation**: Document architectural rationale, tradeoffs, and consequences in `DECISIONS.md`.
  3. **Implementation Plan**: Present design to user and secure explicit approval.
  4. **Phased Shadow Rollout**: Run new implementation in shadow mode alongside baseline.
  5. **Full 10-Point Quality Gate**: All layers in `VERIFICATION.md` must pass before deprecating legacy code.
