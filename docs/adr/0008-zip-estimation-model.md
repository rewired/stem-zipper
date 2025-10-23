# ADR 0008: Renderer ZIP count estimation model

- Status: Accepted
- Date: 2025-02-18

## Context

Packaging runs already perform deterministic splitting and archiving, but the renderer only surfaced a static “Ready” label after analysis. Users had no insight into how many archives would be produced until after packing, and planners needed a quick approximation that reflected mono channel splitting of oversize WAVs plus per-archive overhead. The estimator must stay deterministic, share logic between processes, and avoid UI churn while users tweak the target ZIP size.

## Decision

- Introduce a shared `estimateZipCount` helper in `app/common/packing/estimator.ts` backed by constants for mono split ratio and archive overhead, producing logical byte counts and required ZIP totals.
- Expose a new `estimator:estimate` IPC channel via the preload bridge so the renderer can request estimates without duplicating sizing logic or hitting the filesystem.
- Cache the latest file analysis metadata (including stereo hints) in the renderer and debounce estimate requests when the file list or target size changes, updating the status badge with a localized tooltip.
- Replace the idle “Ready” text in the progress panel with the estimate output whenever files are available, while falling back to the legacy message when the list is empty.

## Consequences

- Renderer status updates now require stereo metadata from analysis; WAV headers are sampled synchronously to flag oversized stereo inputs for mono split estimation.
- The main process logs estimator usage for diagnostics, and renderer tests cover both idle and estimated label rendering alongside pure estimator unit coverage.
- Translators gain three new status keys; locales missing the new strings fall back to the English copy via the existing localisation helper.
