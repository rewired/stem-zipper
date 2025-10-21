# ADR 0001 – Electron Migration for Stem ZIPper

## Status
Accepted – 2024-02-14

## Context
The original Stem ZIPper shipped as a Python/Tkinter desktop application. While functional, the UI stack made it hard to deliver a modern user experience, ship cross-platform builds, and reuse the audio packing logic outside Python. The product roadmap calls for a multi-platform, designable desktop client with a richer component ecosystem, hot reloading, and a straightforward packaging story. The team also needs to preserve existing features such as multi-language support, stereo WAV splitting, best-fit packing, ZIP stamping, developer tooling, and CLI flags for language/dev mode overrides.

## Decision
We migrate the desktop client to an Electron-based architecture using:

- **Electron** for the shell and filesystem access.
- **TypeScript** across the codebase to ensure type safety.
- **Vite + React** for a modern, component-driven renderer workflow with fast dev server support.
- **Tailwind CSS and Headless UI** for consistent styling and accessible UI components.
- **Node tooling** (`fs-extra`, `archiver`, `wav-decoder`, `wav-encoder`) to port the audio processing algorithms from `stem-zipper.py`.

Key structural changes:

1. A new `electron-app/` workspace containing the Electron main process, preload bridge, and Vite renderer.
2. Shared constants/types under `electron-app/src/common/` to mirror the Python feature set.
3. IPC contracts (`stem:*` channels) that expose analysis, packing, progress updates, and test-data generation to the renderer.
4. Tailwind-powered UI recreating the Tkinter layout with translated strings sourced from JSON locale bundles.
5. `electron-builder` configuration and pnpm scripts for development (`pnpm dev`), production builds, and multi-platform packaging.

## Consequences
- Node 18+ and pnpm become additional tooling requirements alongside the legacy Python runtime.
- The Electron app now owns the authoritative implementation of the packing logic, keeping Python as a reference/legacy client.
- Documentation, changelog, and ADRs must cover the new architecture, dev workflow, and packaging steps.
- Automated tests are not yet included; future work should add unit/integration coverage for the Node services and renderer components.
- The repository structure grows, so contributors must run `pnpm install` inside `electron-app/` and follow the new lint/build scripts.
