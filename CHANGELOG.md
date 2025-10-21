# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Port project to an Electron + Vite (React + TypeScript) application.
- Add Tailwind based UI with folder selection, file table, progress display and action controls.
- Implement IPC between renderer and main processes for folder analysis, packing and developer tooling.
- Replace the Tkinter frontend and remove Python specific assets.
- Introduce shared constants, IPC contracts and validation helpers for reuse across processes.
- Implement Node-based audio scanning utilities with per-extension grouping, deterministic best-fit-decreasing packing and branded ZIP output including `_stem-zipper.txt`.
- Mirror status/progress/error updates from the Electron main process to the renderer during packing, keeping split decisions and max-size validation aligned with the legacy workflow.
- Add Vitest test coverage for the bin-packing algorithm and branded ZIP creation to guard against regressions in the Electron port.
