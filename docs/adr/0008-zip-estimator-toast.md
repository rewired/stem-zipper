# ADR 0008: Deterministic ZIP count estimator toast

- Status: Accepted
- Date: 2025-10-23

## Context

Users currently learn how many `stems-XX.zip` archives will be generated only after packing finishes. Packing can take minutes for large folders, and the number of output archives depends on the configured size ceiling, archive overheads and whether oversize stereo WAVs are split into mono files. Without feedback during analysis, it is hard to tune the max size input or to anticipate the effort required for moderation workflows.

## Decision

We introduced a shared estimator in `app/common/packing/` that deterministically predicts archive counts. The estimator:

- normalises the target megabytes to bytes and subtracts fixed overhead constants (`EST_ZIP_OVERHEAD_BYTES`, `EST_STAMP_BYTES`, `EST_LICENSE_BYTES`),
- applies a mono-splitting ratio (`EST_SPLIT_RATIO`) only to stereo WAV files that exceed the configured capacity,
- clamps both capacity and resulting archive counts to a minimum of one, ensuring conservative results.

The Electron main process exposes this pure function via an `estimator:estimate` IPC channel, with preload plumbing and renderer typings keeping the contract type-safe. In the renderer we debounce estimate requests (100 ms) whenever analysis completes or the target size control changes, call the IPC endpoint, and render the response as an accessible toast. The toast is hosted by a new provider/hook, appears automatically without extra UI, carries i18n copy for every locale, enforces ≥10 s visibility, replaces prior estimate toasts instead of stacking them, and automatically dismisses once packing completes so the UI never shows stale guidance. The estimator also returns per-file overflow metadata so the renderer can flag lossy files that risk exceeding the configured max ZIP size directly within the batch table.

## Consequences

- Users get immediate, localised feedback about likely archive counts, reducing guesswork before launching the packer.
- The estimator module is fully covered by Vitest, enabling future adjustments (e.g. refined ratios or additional file heuristics) with confidence.
- IPC and renderer layers gain a reusable toast system; future background notifications can reuse the provider without adding libraries.
- Any changes to constants or estimator logic must remain deterministic and keep tests updated, otherwise renderer copy or toast timing may drift out of sync with expectations.
