# ADR 0005: Robust Preload Resolution and Renderer CSP

- Status: Accepted
- Date: 2025-10-22

## Context

During Windows-based smoke tests the renderer crashed at launch because Electron could not locate the compiled preload bundle. The TypeScript watchers place the preload output under `app/dist-electron/preload/electron/preload.js`, but the main process only checked for a path relative to the compiled `main.js`. When the watcher had not yet emitted the bundle—common on the first `pnpm dev` run—the BrowserWindow instantiation failed, preventing the preload bridge from exposing the runtime configuration to the renderer.

At the same time the renderer console emitted Electron's CSP warning because the HTML template lacked any Content Security Policy. The warning appears during development and obscures genuine issues; it also flags a real hardening gap for production builds.

## Decision

- Resolve the preload script path through `app.getAppPath()` and memoise the result. Poll for the compiled file for up to ten seconds so that the main process tolerates the initial TypeScript build latency during development. If the file remains missing, throw a descriptive error that lists the checked paths to help diagnose misconfigured builds.
- Update `index.html` with a strict `<meta http-equiv="Content-Security-Policy">` directive that locks down script, style, image, font, frame and object sources while whitelisting the Vite dev server endpoints required for hot-module reloading.

## Consequences

- The preload bridge is always available once the TypeScript watcher finishes emitting, preventing `Unable to load preload script` crashes and keeping renderer boot resilient on slower machines.
- Developers receive clearer diagnostics if the preload output folders drift from expectations, avoiding silent failures.
- The renderer no longer triggers the Electron CSP warning, improving developer signal-to-noise and aligning production builds with recommended security posture.
- Allow-listing the Vite dev endpoints maintains the existing developer workflow without weakening the packaged application's CSP policy.
