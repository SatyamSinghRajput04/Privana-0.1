# Architectural Review Report — Privana

## Scoring (1-10 scale, 10 = production-ready, 1 = prototype)

| Category | Score | Rationale |
|---|---|---|
| Architecture & Design | 7/10 | Clean domain layer with discriminated unions, immutable snapshots, and clear separation of concerns. However, AnalyzePage.tsx is a 210KB monolith that violates the architecture. |
| Code Quality | 5/10 | Domain layer is well-structured, but extensive use of `any` types, inconsistent error handling, and AnalyzePage.tsx contains 4000+ lines of mixed concerns. |
| Security | 4/10 | CRITICAL: Supabase service role key committed in vercel.json. Missing origin validation in postMessage. PII firewall is good but regex-only. Rate limiter is per-instance in serverless. |
| Test Coverage | 3/10 | Only 16 test files, all in analytics domain. No tests for API endpoints, firewall, stores, components, or integration. |
| Performance | 6/10 | LRU cache, code splitting, and debouncing are present. But Object.freeze on large arrays, in-memory sorting in IndexedDB, and AlaSQL limitations affect scale. |
| Documentation | 6/10 | SPEC_V1.1.md is excellent. .env.example is clear. But no API docs, no architecture docs, no contributing guide until now. |
| Maintainability | 4/10 | AnalyzePage.tsx is unmaintainable. ComputedView.tsx is 1700 lines. Legacy/new pipeline coexistence creates confusion. |
| Scalability | 4/10 | Browser-only computation limits to ~100K rows. Rate limiter doesn't share state across serverless instances. No pagination on API queries. |
| Accessibility | 2/10 | No ARIA labels, no keyboard navigation, no screen reader support, no focus management. |
| DevOps & CI/CD | 2/10 | No CI/CD pipeline, no Docker, no automated testing in deployment, no staging environment. |

**Overall Score: 4.3/10**

## Critical Security Vulnerabilities

### 1. 🚨 CRITICAL: Hardcoded Supabase Service Role Key
**File**: vercel.json
**Impact**: The `SUPABASE_SERVICE_ROLE_KEY` is committed in plaintext. This key bypasses ALL Row Level Security policies and grants unrestricted admin access to the entire Supabase database.
**Remediation**: Remove from version control immediately. Use Vercel environment variables dashboard. Rotate the compromised key.

### 2. 🚨 HIGH: Missing PostMessage Origin Validation
**File**: src/lib/googleAuth.ts
**Impact**: `signInWithGoogle()` listens for `window.postMessage` but NEVER verifies `event.origin`. Any script or iframe can send crafted auth tokens.
**Remediation**: Add `if (event.origin !== expectedOrigin) return;` check.

### 3. 🚨 HIGH: Supabase Credentials in OAuth State
**File**: src/lib/googleAuth.ts
**Impact**: `buildGoogleUrl` encodes `supabaseUrl` and `supabaseAnonKey` in Base64 state URL parameter.
**Remediation**: Use server-side OAuth flow or remove credentials from client state.

### 4. 🚨 MEDIUM: API Error Message Leakage
**Files**: All api/*.js files
**Impact**: `err.message` returned directly in HTTP 500 responses, potentially exposing database schema/query details.
**Remediation**: Return generic error messages; log details server-side.

### 5. 🚨 MEDIUM: No Workspace Ownership Verification
**Files**: api/datasets.js, api/queries.js, api/saved.js
**Impact**: These endpoints scope by `x-workspace-id` header but don't verify the workspace belongs to the session's tenant token.
**Remediation**: Add workspace ownership check via tenant token.

## Architectural Strengths

1. **Domain-Driven Design**: Clean separation of domain (analytics, safeCompute, resolver, validator, verifier, sql, shadow) from infrastructure and UI.
2. **Discriminated Unions**: `AnalyticsResult` (7 states) and `VisualContract` (7 kinds) provide exhaustive type safety.
3. **Immutable Snapshots**: `Object.freeze` on committed results prevents UI state corruption.
4. **Privacy Architecture**: Fail-closed firewall, PII scanning, schema obfuscation, HMAC hashing — genuine privacy engineering.
5. **Statistical Rigor**: Custom math engine with Lanczos gamma, FDR corrections, and multiple correlation methods.
6. **Dual-Mode Architecture**: Seamless Solo/Server mode switching with shared UI.
7. **Metadata-Only Egress**: analyze.js endpoint explicitly refuses to compute analytics.
8. **SPEC V1.1**: Excellent runtime invariant documentation.

## Architectural Weaknesses

### 1. AnalyzePage.tsx Monolith
- **Why it's a problem**: At 210KB (~4000 lines), this single file contains 30+ useState hooks, inline math functions, a custom markdown parser, and hardcoded schema processing. It's impossible to review, test, or modify safely.
- **Severity**: 🔴 Critical
- **Suggested solution**: Decompose into feature modules (QueryPanel, ResultsPanel, FilterPanel, DatasetPanel). Move inline math to `domain/safeCompute`.
- **Estimated effort**: 2-3 weeks

### 2. Loose Typing (Pervasive `any`)
- **Why it's a problem**: `any` types in `expandToBlueprint.ts`, `matchResultToSheet.ts`, and legacy code defeat TypeScript's compile-time safety guarantees, allowing runtime type errors to slip through.
- **Severity**: 🟡 Medium
- **Suggested solution**: Replace `any` with proper generics and discriminated unions. Enable `strict: true` in tsconfig.
- **Estimated effort**: 1-2 weeks

### 3. Hardcoded Dataset Schema in UI
- **Why it's a problem**: AnalyzePage.tsx contains hardcoded references to `'sleep_hours'`, `'gender'`, `'platform'` — violating the tabular-agnostic principle. The platform breaks or misbehaves with any other dataset.
- **Severity**: 🔴 Critical
- **Suggested solution**: Remove all hardcoded column names. Derive everything from `DatasetProfile` dynamically.
- **Estimated effort**: 1 week

### 4. Leaky Storage Abstractions
- **Why it's a problem**: HistoryPage.tsx and SavedPage.tsx directly call IndexedDB transactions instead of using a unified repository. This duplicates storage logic and creates divergent code paths for Solo vs Server mode.
- **Severity**: 🟡 Medium
- **Suggested solution**: Create a unified `StorageRepository` abstraction that dispatches to IndexedDB (Solo) or API (Server) transparently.
- **Estimated effort**: 3-5 days

### 5. Legacy/New Pipeline Coexistence
- **Why it's a problem**: Feature flags gate between old inline analytics and the new domain architecture. Both code paths are active, creating confusion, duplicated logic, and increased bundle size.
- **Severity**: 🟡 Medium
- **Suggested solution**: Complete the migration to the new pipeline and remove legacy code paths behind the flags.
- **Estimated effort**: 1-2 weeks

### 6. ComputedView.tsx Size (1700 lines)
- **Why it's a problem**: Contains inline subcomponents (SimpleMarkdown, PremiumCircularGauge, PremiumNarrativePanel, telemetry console). Hard to test or modify individual pieces.
- **Severity**: 🟡 Medium
- **Suggested solution**: Extract each inline subcomponent into its own file under `features/result-view/components/`.
- **Estimated effort**: 3-5 days

### 7. No Per-Feature Error Boundaries
- **Why it's a problem**: A single top-level ErrorBoundary means any component crash takes down the entire app instead of just the affected feature area.
- **Severity**: 🟠 High
- **Suggested solution**: Add ErrorBoundary wrappers around each major feature (QueryPanel, ResultsPanel, WorkspaceCards).
- **Estimated effort**: 1-2 days

## Performance Concerns

1. Object.freeze on large result arrays is O(N) recursive
2. indexedDb.ts sorts all results in JS memory instead of using IDB cursors
3. AlaSQL regex-replaces window functions (PERCENTILE_CONT → AVG), silently altering results
4. LRU cache byte size calculated via JSON.stringify().length * 2
5. DatasetValidator PII regex scanning is O(N*M) and runs on main thread

## Testing Gaps

1. Zero API endpoint tests
2. Zero component tests (React Testing Library)
3. Zero integration/E2E tests
4. Zero firewall/privacyFetch tests
5. Zero store tests
6. Only analytics domain executors and resolvers are tested

---

## Top 10 High-Impact Improvements

### 1. Remove Hardcoded Secrets from Version Control
**Priority**: P0 — IMMEDIATE
**Effort**: 30 minutes
**Impact**: Eliminates critical security vulnerability
**Action**: Delete SUPABASE_SERVICE_ROLE_KEY from vercel.json. Rotate key. Use Vercel env vars.

### 2. Decompose AnalyzePage.tsx
**Priority**: P0
**Effort**: 2-3 weeks
**Impact**: Enables maintainability, testing, and code review
**Action**: Extract into feature modules: QueryPanel, ResultsPanel, FilterPanel, DatasetPanel, ChatPanel. Move inline math to domain/safeCompute.

### 3. Add Workspace Ownership Verification to API
**Priority**: P1
**Effort**: 1-2 days
**Impact**: Closes authorization bypass vulnerability
**Action**: In datasets.js/queries.js/saved.js, verify x-workspace-id belongs to tenantToken before processing.

### 4. Fix PostMessage Origin Validation
**Priority**: P1
**Effort**: 1 hour
**Impact**: Prevents auth token injection attacks
**Action**: Add event.origin check in googleAuth.ts postMessage handler.

### 5. Add CI/CD Pipeline
**Priority**: P1
**Effort**: 1-2 days
**Impact**: Automated testing, build verification, deployment safety
**Action**: GitHub Actions with: lint, type-check, unit tests, build verification.

### 6. Expand Test Coverage to 60%+
**Priority**: P1
**Effort**: 2-3 weeks
**Impact**: Regression prevention, refactoring confidence
**Action**: Add tests for API endpoints, firewall, stores, and key components.

### 7. Remove Hardcoded Dataset Schema from UI
**Priority**: P2
**Effort**: 1 week
**Impact**: Makes the platform truly tabular-agnostic
**Action**: Remove 'sleep_hours', 'gender', 'platform' references from AnalyzePage.tsx. Derive all schema from DatasetProfile.

### 8. Add Comprehensive Error Handling
**Priority**: P2
**Effort**: 3-5 days
**Impact**: Better UX and debuggability
**Action**: Per-feature ErrorBoundaries. Generic API error responses. Structured error logging.

### 9. Add Accessibility (a11y)
**Priority**: P2
**Effort**: 2 weeks
**Impact**: Inclusive design, WCAG compliance
**Action**: ARIA labels, keyboard navigation, focus management, screen reader support.

### 10. Dockerize and Add Staging Environment
**Priority**: P3
**Effort**: 2-3 days
**Impact**: Reproducible builds, deployment safety
**Action**: Create Dockerfile, docker-compose.yml, add staging Vercel environment.
