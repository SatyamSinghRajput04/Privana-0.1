# Privana Roadmap

Based on the architectural review, here is a prioritized roadmap.

## Phase 1: Security & Stability (Weeks 1-2)
- [ ] Remove SUPABASE_SERVICE_ROLE_KEY from vercel.json and rotate key
- [ ] Fix postMessage origin validation in googleAuth.ts
- [ ] Add workspace ownership verification to API endpoints
- [ ] Sanitize API error responses (remove err.message exposure)
- [ ] Add Subresource Integrity to external CDN scripts
- [ ] Remove event listener memory leak in googleAuth.ts

## Phase 2: Architecture & Refactoring (Weeks 3-6)
- [ ] Decompose AnalyzePage.tsx into feature modules
  - Extract QueryPanel, ResultsPanel, FilterPanel, DatasetPanel
  - Move inline math functions to domain/safeCompute
  - Remove hardcoded 'sleep_hours'/'gender'/'platform' references
- [ ] Split ComputedView.tsx into modular components
- [ ] Create unified storage repository (abstract IndexedDB vs API calls)
- [ ] Clean up legacy analytics pipeline (remove dead code after feature flag migration)
- [ ] Replace `any` types with proper TypeScript generics

## Phase 3: Testing & CI/CD (Weeks 4-6)
- [ ] Set up GitHub Actions CI/CD pipeline
  - Lint, type-check, unit tests, build verification on every PR
- [ ] Add API endpoint tests
- [ ] Add firewall/privacyFetch tests
- [ ] Add Zustand store tests
- [ ] Add React component tests (Testing Library)
- [ ] Target: 60%+ code coverage

## Phase 4: Performance & Scale (Weeks 7-10)
- [ ] Evaluate DuckDB-WASM as AlaSQL replacement
- [ ] Move PII scanning to Web Worker (avoid main thread blocking)
- [ ] Replace Object.freeze with Immer for structural sharing
- [ ] Implement IDB cursor-based sorting (replace in-memory sort)
- [ ] Add pagination to API query endpoints
- [ ] Implement proper window function support (replace regex workarounds)

## Phase 5: User Experience (Weeks 8-12)
- [ ] Add ARIA labels and keyboard navigation (WCAG 2.1 AA)
- [ ] Add proper error boundaries per feature area
- [ ] Implement settings persistence (currently placeholder)
- [ ] Add multi-table JOIN support for analytics queries
- [ ] Add CSV/PDF export for reports
- [ ] Implement collaborative real-time features (Server Mode)

## Phase 6: Infrastructure & DevOps (Weeks 10-14)
- [ ] Create Docker configuration
- [ ] Set up staging environment
- [ ] Add E2E tests (Playwright or Cypress)
- [ ] Implement health monitoring and error tracking
- [ ] Add rate limiter with shared state (Redis) for production

## Future Vision
- DuckDB-WASM for 10x performance
- TEE hardware integration (Intel SGX / ARM TrustZone)
- Federation protocol for cross-org private analytics
- Mobile app (React Native)
- Plugin ecosystem for custom analytics executors
