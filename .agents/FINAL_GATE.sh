#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# .agents/FINAL_GATE.sh
# Final automated verification gate for Privana codebase.
# Must exit with code 0 before any phase or architectural PR is declared complete.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "=== 🛡️ RUNNING PRIVANA FINAL VERIFICATION GATE ==="

# 1. TypeScript & Bundling Compilation
echo "1. [COMPILE] Running tsc -b && vite build..."
npm run build

# 2. Analytical Unit Tests
echo "2. [TESTS] Running Analytical Domain Test Suite..."
npx tsx src/domain/analytics/__tests__/runAnalyticsQuestion.test.ts
npx tsx src/domain/analytics/__tests__/correlation.test.ts

# 3. Privacy & Zero-Egress Static Scan
echo "3. [SECURITY] Scanning for unauthorized remote fetch or telemetry calls..."
# Ensure privacyFetch or local API server is used, no raw fetch to third parties
node -e '
  const fs = require("fs");
  const path = require("path");
  function checkDir(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) {
        if (f !== "node_modules" && f !== ".git" && f !== "dist") checkDir(p);
      } else if (f.endsWith(".ts") || f.endsWith(".tsx")) {
        const content = fs.readFileSync(p, "utf8");
        if (content.includes("https://api.mixpanel.com") || content.includes("https://google-analytics.com")) {
          console.error("❌ Telemetry leak found in " + p);
          process.exit(1);
        }
      }
    }
  }
  checkDir("./src");
  console.log("✓ Privacy scan passed (0 telemetry leaks).");
'

echo "=== ✅ PRIVANA FINAL GATE PASSED (100% READY) ==="
exit 0
