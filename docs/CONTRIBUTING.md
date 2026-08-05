# Contributing to Privana

## Getting Started
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/Privana.git`
3. Install dependencies: `npm install`
4. Copy environment template: `cp .env.example .env`
5. Start development: `npm run dev`

## Development Environment
- Node.js v18+
- npm v9+
- VS Code recommended (with ESLint + TypeScript extensions)
- Optional: Ollama for AI features

## Architecture Overview
Read docs/ARCHITECTURE.md and docs/CODEBASE_GUIDE.md first.

Key principles:
1. **Privacy First**: All data processing happens in the browser. Never send raw data to any server.
2. **Unified Pipeline**: All analytics queries route through `runAnalyticsQuestion()`. Never create duplicate computation paths.
3. **Tabular-Agnostic**: Never hardcode column names. Derive everything from schema profiles.
4. **Immutable Snapshots**: Committed AnalyticsResults are frozen. Never mutate them.
5. **Single Source of Truth**: Every visualization consumes the same immutable snapshot.

## Code Organization
- **Domain logic** goes in `src/domain/` — pure functions, no React
- **UI components** go in `src/components/` — reusable, stateless where possible
- **Page layouts** go in `src/pages/` — compose components + connect to stores
- **State** goes in `src/store/` — Zustand stores with clear boundaries
- **Infrastructure** goes in `src/infrastructure/` — firewall, network
- **Utilities** go in `src/lib/` — shared helpers

## Coding Standards
- TypeScript strict mode
- Avoid `any` types — use proper generics and discriminated unions
- Write pure functions for domain logic (no side effects)
- Use named exports (not default exports)
- Format with Prettier (if configured), otherwise follow existing style
- Document complex algorithms and business logic

## Testing
```bash
npm test            # Run all tests
npm test -- --watch  # Watch mode
```

Test files live alongside source in `__tests__/` directories.
Use Vitest (Vite's test runner).

## Pull Request Process
1. Create a feature branch from `main`
2. Make your changes
3. Run `npx tsc --noEmit` to verify TypeScript
4. Run `npm test` to verify tests pass
5. Run `npm run build` to verify production build
6. Submit PR with:
   - Clear description of changes
   - Screenshots for UI changes
   - Test coverage for new logic

## Privacy Rules (MUST FOLLOW)
- NEVER send raw data to external servers
- NEVER log PII in console
- NEVER store plaintext questions on the server (HMAC hash them)
- ALWAYS route network calls through privacyFetch
- ALWAYS obfuscate schema before any LLM call

## Bug Reports
Include:
- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (screenshot)
- Mode (Solo or Server)

## Contact
Maintainer: Satyam Singh Rajput (@SatyamSinghRajput04)
GitHub: https://github.com/SatyamSinghRajput04/Privana
