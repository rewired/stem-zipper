# ADR 0006: Electron Builder packaging for Windows

- Status: Accepted
- Date: 2025-10-22

## Context

The Electron workspace exposed build outputs for the renderer (`dist-renderer`) and main/preload processes (`dist-electron`), but it lacked an automated path to bundle these artefacts into a Windows installer. Contributors had to wire their own tooling whenever they needed a distributable `.exe`, which slowed down testing on non-development machines and created room for inconsistencies.

## Decision

We adopted [`electron-builder`](https://www.electron.build/) as the packaging tool for Windows releases and exposed it through a dedicated `pnpm package:win` task. The script compiles the renderer and Electron processes and then invokes Electron Builder to produce a 64-bit NSIS installer in `app/release/`.

## Consequences

- Windows users can generate a tested installer with a single command instead of assembling packaging scripts manually.
- `electron-builder` joins the devDependencies, increasing the size of the toolchain but keeping packaging reproducible across machines.
- Package metadata (name, version, description, author) must stay populated and the `electron` runtime scoped to development dependencies so that electron-builder accepts the Windows build inputs.
- Future platform targets (macOS, Linux) can extend the same configuration without duplicating build logic.
