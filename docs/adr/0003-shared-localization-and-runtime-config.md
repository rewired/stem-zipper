# ADR 0003: Shared localization and runtime configuration

- Status: Accepted
- Date: 2024-05-12

## Context

The Python-era CLI exposed `--lang` and `--dev` switches and embedded translations directly in the UI layer. During the Electron migration we temporarily hard-coded strings in the renderer and relied on Vite's `import.meta.env.DEV`, leaving the main process with English-only dialogs and no reliable way to honour locale overrides. We need a single source of truth for translations, a preload-safe way to surface the resolved locale/dev-mode to the renderer, and guardrails around developer-only tooling.

## Decision

- Create `app/common/i18n.ts` containing all six locale catalogues plus helpers to resolve and format messages so both renderer and main processes stay in sync.
- Resolve the runtime locale/dev-mode inside the Electron main process using `STEM_ZIPPER_LANG`/`STEM_ZIPPER_DEV_MODE` environment variables or the host language via `app.getPreferredSystemLanguages()` / `app.getLocale()`.
- Persist the resolved configuration in `process.env` and expose it synchronously through the preload bridge as `window.runtimeConfig` so the renderer can bootstrap without extra IPC.
- Localise Electron-owned surfaces (window title, folder chooser, packer error propagation) and return translated error messages for developer-only operations such as the test data generator.
- Remove the old CLI switches in favour of the environment-driven runtime config and keep the dummy data generator button hidden (and guarded server-side) unless developer mode is active.

## Consequences

- Both processes share identical translations, preventing divergence between UI and main process messaging.
- Packaged builds can honour explicit language/dev toggles by setting environment variables prior to launch; development still works out-of-the-box via `VITE_DEV_SERVER_URL`.
- The pnpm development runner now exposes a locale argument that writes `STEM_ZIPPER_LANG` before spawning the Electron/Vite processes, defaulting to English when the input is missing or unsupported.
- The preload bridge now publishes runtime metadata, slightly increasing its API surface but avoiding ad-hoc IPC calls during start-up.
- Tests and code touching `packFolder` or runtime config must import the new helpers/types; the stricter localisation also means new strings need entries in all six catalogues.
