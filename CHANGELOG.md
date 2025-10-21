# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Electron desktop shell backed by Vite, React, TypeScript and Tailwind CSS.
- Shared localisation catalogue in `app/common/i18n.ts` consumed by the renderer and Electron main process.
- Node-based audio analysis, stereo splitting and best-fit-decreasing packing services with Vitest coverage.
- Developer-mode dummy data generator exposed through the renderer and IPC bridge.

### Changed
- Runtime configuration now resolves locale/dev-mode via environment variables or OS defaults and is surfaced to the renderer through the preload bridge.
- Progress events, error reporting and packer actions now flow through typed IPC contracts shared between renderer and main processes.
- Documentation refreshed to highlight Node/Electron prerequisites, feature parity with the Python release and the new packaging expectations.
- Package management switched from npm to pnpm, updating scripts and documentation accordingly.
- Repository ignore rules refocused on the Vite/TypeScript toolchain, removing stale Python artefacts and excluding generated source maps.

### Removed
- Tkinter frontend, Python CLI switches and PyInstaller packaging instructions from the primary documentation set (archived under `docs/archive/python-legacy.md`).

### Fixed
- The development Electron launcher now reruns the upstream installer when the binary download is skipped, preventing `Electron failed to install correctly` crashes after fresh installs.
- TypeScript watch mode for the preload bundle now keeps project references composite-friendly while emitting declarations, resolving the `TS6304` regression introduced with recent compiler upgrades.
