# Stem ZIPper Automation Guide

## Purpose & Scope
- Document expectations for automation, coding assistants, and bot contributions.
- Applies repository-wide unless a nested `AGENTS.md` overrides these rules.
- Assumes the stack: Electron (main + preload), Vite + React + TypeScript renderer, Tailwind, Zustand, Vitest.
- Balances velocity with reviewer trust—small, well-tested PRs land fastest.
- Complements human contributor docs (`README.md`, ADRs, `CHANGELOG.md`). Read them when planning work.

## Working Agreement
1. **Atomic PRs**
   - Ship one logical change per PR. Feature + refactor combos must be split.
   - Update docs (CHANGELOG, ADR) alongside code that changes behaviour.
2. **TypeScript & ESM discipline**
   - No CommonJS modules in new code.
   - Extract literal values into named constants when reused or when meaning is unclear.
   - Honour strict compiler settings; avoid `any` unless impossible otherwise.
3. **Internationalisation first**
   - All user-facing copy flows through `app/common/i18n.ts`.
   - Add the same key/value to every locale listed in `SUPPORTED_LOCALES`; duplicate EN text when translation is unavailable.
   - Verify placeholders (`{name}`) survive translation.
4. **Testing requirements**
   - Add unit/component tests for new logic and edge cases.
   - Keep estimators and background jobs deterministic; use fake timers where timing matters.
   - Prefer Vitest + Testing Library patterns already in the repo.
5. **CI discipline**
   - Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` locally before requesting review.
   - Fix all warnings; treat them as failures.
   - Ensure generated bundles/tests work cross-platform (macOS, Linux, Windows) when possible.
6. **Accessibility & UX**
   - Provide aria labels, keyboard focus handling, and sensible timeouts for new UI (e.g. toasts ≥10s visibility).
   - Avoid motion flashes; prefer Tailwind utility classes already in use.

## Coding Standards & Tips
- Use existing path aliases (`@common/*`).
- Keep IPC contracts typed in `app/common` and mirrored in preload/main/renderer.
- When touching filesystem code, guard against invalid input and surface descriptive errors.
- Log once per failure scenario; avoid console spam.
- For background estimates or jobs, debounce noisy inputs (e.g. 100 ms throttle already in use).
- Maintain deterministic ordering for lists and calculations to keep tests stable.

## PR Checklist (copy before opening a PR)
- [ ] ✅ Atomic scope respected, no drive-by edits
- [ ] 🌐 i18n keys added/updated for **all** locales in `SUPPORTED_LOCALES`
- [ ] 🧪 Tests cover new logic, including edge cases & timer behaviour
- [ ] 📦 `pnpm lint` · `pnpm typecheck` · `pnpm test` all succeed locally
- [ ] 🚫 No console errors or warnings introduced (renderer & Electron)
- [ ] 📊 Estimators/background jobs remain deterministic & debounced
- [ ] ♿ Accessibility verified (aria labels, keyboard focus, readable copy)
- [ ] 📝 CHANGELOG/ADR entries updated when behaviour shifts

## Contribution Workflow
1. Create a branch: `feat/<slug>`, `fix/<slug>`, or `chore/<slug>`.
2. Implement the change respecting the agreements above.
3. Update docs (CHANGELOG under `## [Unreleased]`, ADRs when architecture changes) and ensure i18n coverage.
4. Run the full script trio locally: `pnpm lint`, `pnpm typecheck`, `pnpm test`.
5. Capture test results in the PR description; mention any follow-up tasks.
6. Keep commits conventional (`feat:`, `fix:`, etc.) with descriptive summaries.
7. Request review with context: what changed, risks, mitigations, manual QA performed.

Stay deterministic, keep UX polished, and leave the tree greener than you found it.

## Internationalization (i18n) Policy (Lightweight)

**Why this is simple:** This is a small app. We avoid over-engineering and keep i18n lean and predictable.

### File layout
- One flat JSON per language:
  - `locales/en.json` (master)
  - `locales/<lang>.json` (mirrors English keys)
- Keys are **underscore_case** with a namespace prefix: `pack_toast_estimate`, `app_status_ready`.
- **No dot-notation in keys**. The namespace is part of the key name via underscore, not a nested path.

### API
- New code uses:
  - `tNS(namespace: string, key: string, params?: Record<string, string | number>): string`
- Legacy shim:
  - `t('ns.key', params?)` remains available but is **deprecated**. Do not introduce new call sites.
- Placeholder format: `{{name}}`, `{{count}}` (must be identical across all languages for the same key).

### Rules for contributors (including AI agents)
1. **Do not rename or remove keys** unless explicitly requested by a task.
2. **Underscore keys only** (`^[a-z0-9_]+$`). Dots in keys are forbidden.
3. English (`locales/en.json`) is the master. Other languages must mirror the exact key set.
4. Keep placeholders identical across languages.
5. No user-facing hard-coded strings in code — always use `tNS(...)` (or the legacy shim during migration).

### CI gates (must pass)
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (includes a tiny i18n test that checks: missing keys, placeholder consistency, and forbids dot-notation in keys)

### Review checklist
- [ ] No new legacy `t('ns.key')` usages
- [ ] Keys are underscore_case; no dots
- [ ] All locales updated with the same keys
- [ ] Placeholders match across languages
- [ ] No hard-coded UI strings
