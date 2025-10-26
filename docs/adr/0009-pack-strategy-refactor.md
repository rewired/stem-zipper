# ADR 0009: Modular Pack Strategies with 7z Support

## Status
Accepted

## Context
The original `electron/services/packaging.ts` implementation mixed file discovery, stereo splitting, metadata generation, progress reporting, and archive creation in a single 570-line module. The design made it difficult to introduce additional archive formats, caused duplicate progress events, and tightly coupled ZIP creation to UI updates. Supporting 7z multi-volume archives required a pluggable backend capable of resolving native binaries and streaming progress from external processes.

## Decision
We refactored the packer into `electron/services/pack/*` modules with well-defined responsibilities:

- `index.ts` orchestrates pack requests, normalises options, and exposes a single progress reporter.
- `expandFiles.ts`, `splitStereo.ts`, and `metadata.ts` host focused logic for discovery, WAV splitting, and metadata generation.
- `zipStrategy.ts` contains the existing ZIP best-fit implementation, and `sevenZStrategy.ts` introduces 7z volume support via the native CLI resolved in `binaries.ts`.
- `progress.ts` provides a typed emitter that guarantees a single stream of progress events.

The renderer receives canonical progress states (`preparing`, `packing`, `finalizing`, `done`, `error`) and reacts to dedicated `pack-done`/`pack-error` IPC events. Electron Builder now bundles platform-specific 7z binaries under `resources/bin/*`.

## Consequences
- Packaging logic is modular and testable; strategies can evolve independently.
- Progress handling is centralised, eliminating duplicate updates in the renderer.
- 7z multi-volume archives are available across platforms via bundled binaries.
- The renderer, preload, and main process now share explicit `PackResult`/`PackErrorPayload` events, enabling richer UI feedback.
- The refactor required updates to localisation keys and integration tests to align with the new progress vocabulary.
