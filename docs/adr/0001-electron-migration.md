# ADR 0001: Migrating the Stem ZIPper UI to Electron

- Status: Accepted
- Date: 2024-05-08

## Context

The original Stem ZIPper interface was implemented in Python using Tkinter. While lightweight, this approach limited the ability to deliver a modern, cross-platform experience with advanced layout, styling and developer tooling. The new requirements call for drag & drop folder support, richer visual feedback, and a sustainable way to share logic between the UI and the packaging workflow.

## Decision

We will rebuild the desktop application around an Electron runtime:

- Use **Vite** with **React + TypeScript** for the renderer to benefit from component-based UI development, Tailwind CSS utility styling and hot module reloading.
- Implement the Electron **main** and **preload** processes in TypeScript, exposing a secure IPC bridge that covers folder selection, audio analysis, packing and developer tooling (dummy data generation).
- Move platform-agnostic constants, validation rules and IPC contracts into a shared `app/common/` workspace that is consumed by both the renderer and the main process.
- Retire the Python/Tkinter artefacts (`stem-zipper.py`, `requirements.txt`) to avoid confusion and reduce maintenance overhead.

## Consequences

- Node.js (18+) becomes the primary runtime dependency for development and distribution.
- The build workflow now involves `npm run dev` / `npm run build` inside `app/`, producing compiled Electron bundles.
- Future enhancements (e.g., packaging installers via Electron Builder) can build upon the new TypeScript codebase without touching Python.
- Documentation, onboarding materials and automation scripts need to reflect the Electron project structure.
