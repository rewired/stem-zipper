# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Introduce a shared `app/common/i18n.ts` locale catalogue consumed by both the renderer and the Electron main process, localizing window titles, dialogs and packer errors.
- Replace the legacy CLI `--lang`/`--dev` switches with runtime configuration resolved from `STEM_ZIPPER_LANG`/`STEM_ZIPPER_DEV_MODE` or the host locale, exposing the result to the renderer via the preload bridge.
- Keep the Node-based dummy data generator gated behind developer mode while preserving localized feedback for max ZIP size validation and dev-only capabilities.
- Port project to an Electron + Vite (React + TypeScript) application.
- Add Tailwind based UI with folder selection, file table, progress display and action controls.
- Implement IPC between renderer and main processes for folder analysis, packing and developer tooling.
- Replace the Tkinter frontend and remove Python specific assets.
- Introduce shared constants, IPC contracts and validation helpers for reuse across processes.
- Implement Node-based audio scanning utilities with per-extension grouping, deterministic best-fit-decreasing packing and branded ZIP output including `_stem-zipper.txt`.
- Mirror status/progress/error updates from the Electron main process to the renderer during packing, keeping split decisions and max-size validation aligned with the legacy workflow.
- Add Vitest test coverage for the bin-packing algorithm and branded ZIP creation to guard against regressions in the Electron port.
