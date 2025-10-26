# ADR 0002: Node-based packaging engine

- Status: Accepted
- Date: 2025-10-22

## Context

The original Stem ZIPper project implemented its audio analysis, WAV splitting and ZIP packing logic in Python. During the Electron migration we temporarily re-used parts of the Python behaviour from the renderer, leaving the long-term goal of a fully Node-powered packaging backend unfinished. We now need deterministic packing across platforms, the ability to unit test the workflow, and the classic `_stem-zipper.txt` branding inside every archive.

## Decision

We implemented a TypeScript packaging service for the Electron main process that:

- Scans the target directory for supported audio files grouped by extension.
- Calculates file sizes in bytes to keep decisions consistent with the legacy Tkinter version.
- Applies a deterministic best-fit-decreasing strategy (with hashed RAND tie-breakers) so archives are evenly filled regardless of file order.
- Splits oversized stereo WAV files into mono pairs before packing, re-using the existing WaveFile dependency.
- Creates branded archives through `yazl`, injecting the `_stem-zipper.txt` manifesto as a stored (uncompressed) entry.
- Streams progress/error information back to the renderer to mirror the classic UX.
- Ships Vitest specs for the bin-packing and ZIP branding behaviour to prevent regressions.

## Consequences

- Node becomes the single source of truth for packaging logic, reducing drift between UI and backend implementations.
- The Electron main process now owns more domain logic, making it easier to add worker threads if future performance work is needed.
- Tests can run without launching Electron, shortening feedback loops and enabling CI automation.
- New dependencies (`vitest`) and configuration files are added; developers need to install them before running the suite.
- Bundled archives always contain the `_stem-zipper.txt` branding, ensuring continuity with the original tool.
- Header probing guards the stereo-splitting path, skipping unsupported or malformed audio while surfacing user-facing toasts instead of aborting the pack run.
