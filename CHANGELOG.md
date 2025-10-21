# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Fixed
- Adjusted the Electron TypeScript configs so the main and preload builds can consume shared modules under `src/common/` without triggering `rootDir` violations, emitting both outputs under a unified `dist/` tree.

### Changed
- Switched the Electron workspace tooling from npm to pnpm, updating scripts and documentation to reflect the new workflow.

## [0.9.0] - 2024-02-14
### Added
- Electron workspace (`electron-app/`) with TypeScript main/preload processes and a Vite + React + Tailwind renderer mirroring the original Tkinter experience.
- Ported audio utilities (stereo WAV splitting, best-fit packing, ZIP stamping, dummy data generation) to Node with archiver, wav-decoder/encoder, and fs-extra.
- IPC bridge exposing analysis, packing, progress updates, and developer tooling to the renderer.
- Multi-language JSON resources for EN/DE/FR/IT/ES/PT shared with the React UI via i18next.
- Electron-builder configuration and npm scripts for development, builds, and packaging on Windows, macOS, and Linux.
- ADR 0001 documenting the Electron migration rationale and trade-offs.

### Changed
- README updated with Electron development/packaging instructions alongside the legacy Python guidance.

### Deprecated
- The Python/Tkinter client remains for reference but is superseded by the Electron implementation moving forward.
