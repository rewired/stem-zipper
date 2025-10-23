# ADR 0004: Electron + React + Tailwind with Node-based Audio Engine

- Status: Accepted
- Date: 2025-10-22

## Context

Migrating away from the Tkinter UI created an opportunity to modernise the full technology stack. The legacy Python renderer and packaging scripts shared little code, carried duplicated validation logic and made it difficult to deliver a polished multi-lingual interface. A single desktop runtime was needed to host a responsive UI, reuse logic between presentation and packaging, and unlock ecosystem tooling for testing and distribution.

## Decision

Adopt an Electron architecture composed of:

- **Renderer**: Vite-powered React + TypeScript UI styled with Tailwind CSS utility classes.
- **Main & preload processes**: TypeScript modules that manage file-system access, audio inspection, IPC contracts and configuration resolution.
- **Audio/ZIP engine**: Node-based services that handle stereo-to-mono splitting, deterministic best-fit-decreasing packing and branded ZIP authoring.

The renderer and main process share constants, validation helpers and localisation catalogues via `app/common/`, ensuring one source of truth for user-facing messaging and packer constraints.

## Consequences

- Developers can rely on pnpm workflows (`pnpm dev`, `pnpm build`, `pnpm test`) for end-to-end work, eliminating Python runtime dependencies on the main branch.
- Tailwind CSS accelerates UI prototyping while keeping styling colocated with React components.
- Node-based packing logic benefits from the existing Vitest coverage and can be extended with additional audio formats without bridging two languages.
- Desktop distribution now depends on Electron-focused tooling (Forge/Builder) rather than PyInstaller; legacy guidance is archived under `docs/archive/python-legacy.md` for reference.
- The preload bridge enforces a typed IPC surface, reducing the risk of renderer-main drift and paving the way for future enhancements like background workers or auto-updates.
