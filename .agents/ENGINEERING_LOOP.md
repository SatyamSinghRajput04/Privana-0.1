# 🔄 Privana Engineering Loop Protocol (ENGINEERING_LOOP.md)

Every autonomous or paired engineering session on Privana MUST follow this rigorous step-by-step lifecycle before committing changes or declaring completion.

---

## 🔁 The 18-Step Engineering Loop

```
 1. READ          ──►  2. UNDERSTAND   ──►  3. CHECK STATE   ──►  4. CHECK MEMORY
                                                                        │
 8. IMPLEMENT     ◄──  7. PLAN         ◄──  6. DECISIONS     ◄──  5. ARCHITECTURE
    (Small Step)
       │
       ▼
 9. COMPILE       ──► 10. TEST         ──► 11. BENCHMARK     ──► 12. AUDIT BOUNDARIES
                                                                        │
16. FINAL GATE    ◄── 15. UPDATE STATE ◄── 14. UPDATE JOURN. ◄── 13. UPDATE MEMORY
       │
       ▼
17. AUDIT LOG     ──► 18. COMMIT
```

### Detailed Step Requirements:

1. **READ**: Inspect existing code using `code-review-graph` or targeted views.
2. **UNDERSTAND**: Identify the exact mathematical and architectural intent.
3. **CHECK STATE**: Read `.agents/STATE.json` to verify current active phase and blocked items.
4. **CHECK MEMORY**: Review `.agents/MEMORY.md` to prevent repeating known past mistakes.
5. **CHECK ARCHITECTURE**: Ensure proposed change aligns with `.agents/ARCHITECTURE.md`.
6. **CHECK DECISIONS**: Verify compliance with ADRs in `.agents/DECISIONS.md`.
7. **PLAN**: Draft a precise, minimal implementation plan.
8. **IMPLEMENT SMALL CHANGE**: Apply changes in small, isolated steps.
9. **COMPILE**: Verify with `tsc -b && vite build`.
10. **TEST**: Run unit tests (`npx tsx ...`) and golden-result parity tests.
11. **BENCHMARK**: Record empirical P50/P95 latency and heap footprint.
12. **AUDIT BOUNDARIES**: Confirm no layer violations, no hardcoded columns, and no leakages.
13. **UPDATE MEMORY**: Record any new empirical or mathematical discoveries in `MEMORY.md`.
14. **UPDATE JOURNAL**: Append progress and decisions to `JOURNAL.md`.
15. **UPDATE STATE**: Update `STATE.json` with new task status.
16. **FINAL GATE**: Run `.agents/FINAL_GATE.sh` verification checks.
17. **AUDIT LOG**: Confirm zero data egress and local privacy preservation.
18. **COMMIT**: Generate clean, descriptive git commit.
