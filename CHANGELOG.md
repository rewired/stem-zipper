# Changelog

All notable changes to this project will be documented in this file.

## [1.0.2]

### Added
- Automated cross-platform icon generation now builds platform-specific icon assets via `pnpm icons`, feeding electron-builder packaging for macOS, Windows, and Linux.
- Renderer file table now includes selection checkboxes, a master toggle, and per-row archive estimate badges with ZIP gating
  feedback.
- Renderer estimated archive column now exposes a localized screen-reader label for improved accessibility.
- Electron main process exposes a deterministic `estimatePackingPlan` IPC endpoint for renderer archive badge planning and ZIP
  eligibility checks.
- Electron packer now emits localized info/warning toasts (10s minimum) when stereo splitting is skipped, keeping users informed
  about unsupported audio during packing.
- Renderer batch table now surfaces localized warning badges for lossy files that would exceed the configured max ZIP size or
  trigger extra volumes.
- Renderer adds a front-end pack method selector (ZIP vs 7z) ahead of the upcoming multi-archive backend work.- Electron packer can now produce 7z archives with configurable volume splitting via bundled native binaries.
- Renderer exposes a shared `getFileExtension` helper for consistent lowercase extension parsing across platforms.

### Changed
- Renderer pack progress UI now uses a reducer-driven state machine that keeps the bar visible
  through preparing/packing/finalizing phases and shows explicit done/error feedback once the
  run completes.
- UI: Primary action "Pack Now" now green; "~ no zip gain" shown as blue info badge.
- Renderer "Pack Now" CTA now leans into the success palette with higher-contrast focus/hover states for AA compliance.
- File table select column swaps the slider toggle for an indeterminate-aware master checkbox with an accessible select-all label.
- Renderer now debounces ZIP estimate requests and pairs them with the latest analysis token to prevent stale toasts.
- Renderer toast estimates now use underscore keys with concise start/result/error copy shared across locales.
- Development workflow now delegates to `concurrently` with named stream prefixes and signal-aware teardown so `pnpm run dev` exits cleanly across platforms.
- Repository root now exposes pnpm workspace scripts, enabling `pnpm run dev|build|lint|typecheck|test|package` without `cd app` and aligning CI with the monorepo layout.
- Renderer shell split into feature-focused providers and routes, shrinking `App.tsx` while clarifying pack and metadata flows.- Electron packaging pipeline refactored into modular pack strategies with a single progress stream for renderer updates.
- Electron stereo splitting progress now adjusts totals dynamically, emits mono file lifecycle events, and heartbeats long splits so the renderer progress indicators remain accurate.
- Electron packaging now resolves the bundled 7z binary per platform/architecture, honours the `STEM_ZIPPER_7Z_PATH` override, and enforces executable permissions for Unix builds.

### Removed

### Fixed
- Electron packaging now syncs platform 7-Zip binaries from the `7zip-bin` package during
  `pnpm install`, ensuring installers ship the CLI even on clean machines without a
  system-level 7z installation.
- Electron packer now falls back to 7z binaries available on the system `PATH`
  when bundled archives are missing, restoring packing on developer machines
  without the packaged helper.
- Icon generation script now resolves project paths relative to the repository root, restoring `pnpm run icons` when invoked
  from the `app` workspace on Windows terminals.
- Electron pack handler now emits localized warning toasts and error progress updates when 7z/split operations fail,
  keeping the renderer out of indeterminate states.
- Electron 7z split pack strategy now reports all generated volume parts in
  numeric order, ensuring the renderer receives every `stems.7z` segment.
- Electron 7z packing progress now parses stdout/stderr percentages, tolerates CR updates, and heartbeats stale output to keep
  the progress bar responsive across platforms.
- Electron 7z split pack strategy now loads `execa` via a dynamic import, restoring packaging on
  Node 18+ where the dependency ships as ESM-only.
- Electron 7z pack strategy now clears stale `stems.7z` volumes and forces non-interactive
  overwrites, preventing packing from hanging on overwrite prompts.
- Electron 7z split pack strategy now stages split mono temp files inside the pack folder before
  spawning 7z, restoring multi-volume archives after stereo splitting.
- `pnpm run dev` now registers the Electron launcher script again, restoring the
  development workflow after the missing `dev:electron` target regression.
- Preview launcher now reinstalls Electron binaries automatically, preventing `Electron failed to install correctly` crashes
  after fresh dependency installs.
- Electron main TypeScript config now includes the `gracefulExit` helper, restoring `pnpm run dev` on Windows by keeping the
  main-process watcher aware of the new source file.
- Renderer now force-dismisses the ZIP estimate toast when analysis or packing begins, keeping the notification hidden during
  heavy work and final states.
- Electron stereo splitter now processes drain events sequentially, preventing `MaxListenersExceededWarning` spam during
  packaging.
- Electron packaging probes audio headers to split only real stereo WAV (PCM/IEEE float) files, logging and skipping malformed inputs without crashing the pack flow.
- Renderer pack badges and estimate chips now pull localized copy via `tNS('pack', ...)`, eliminating raw key output in the table.
- Renderer silences the ZIP estimate toast during the post-pack analysis cycle, preventing the notification from reappearing until the next manual scan or size change.
- Electron pack routines now await folder analysis, normalize 7z error reporting, and validate stereo split outputs to satisfy strict TypeScript checks and keep progress feedback reliable.
- Renderer now detects all already-compressed audio formats when flagging "~ no zip gain" and suggests 7z volumes for oversized compressed files.
- Planner, estimator, and pack flow now split oversize stereo WAV files into mono stems, keeping rows selectable and packaging the channel outputs automatically when they enable a ZIP plan.
- Router shell now opts the React Router `RouterProvider` into the `v7_startTransition` future flag, eliminating the transition
  mode warning ahead of the v7 release.
- Renderer pack badge for Split Mono now resolves via the `pack_badge_split_mono` key across all locales, restoring the localized label and aria text.
- Electron ZIP packer now falls back to packaging the original stem when stereo splitting fails, ensuring archives are still produced.

## [1.0.1]

### Added
- Automation contribution guide (`AGENTS.md`) capturing CI discipline, i18n requirements, and reviewer expectations for agents.
- Renderer toast that surfaces a deterministic ZIP count estimate (with stereo split heuristics) after scans and max-size updates.
- Lightweight underscore-based i18n policy with flat locale JSONs, helper utilities, and a guard test enforcing mirrored keys and placeholders.
- Metadata modal in the renderer with required title/artist/license fields, persisted default artist preferences, and automatic `PACK-METADATA.json`, `LICENSE.txt`, and `ATTRIBUTION.txt` generation during packing.
- Metadata modal now remembers the artist URL and contact email defaults alongside the artist name for faster subsequent runs.

### Changed

- Migrated the shared localisation layer to JSON-based catalogs with typed helpers, updating renderer and Electron callers to use the new key set.

### Removed

### Fixed
- Electron preferences service now persists JSON preferences directly via the filesystem, removing the `electron-store` dependency and eliminating the `ERR_REQUIRE_ESM` crash on Node 18+.
- Electron main and preload TypeScript configs now include locale JSON catalogs, restoring watch mode after expanding the translation set.
- Development runner now spawns pnpm watchers directly, eliminating the `util._extend` deprecation warning raised by `spawn-command`.
- Repaired the German localisation catalogue entry so bundlers and the TypeScript compiler can parse the new toast estimate keys without syntax errors.
- Renderer now dismisses the ZIP estimate toast once packing completes, preventing stale notifications after successful runs.
- Renderer no longer triggers a fresh ZIP estimate immediately after packing, avoiding redundant toasts during the automatic post-pack rescan.

## [1.0.0]

### Added
- Continuous integration workflow validating linting, type safety and test suites on Node 18 with pnpm caching.
- Expanded the shared localisation catalogue with Danish, Norwegian, Swedish, Finnish, Dutch, Polish, Japanese, Chinese, Thai, Korean, Czech, Romanian and Ukrainian translations.
- Reusable Material Symbols helper component for consistent inline icons in the renderer UI.
- Electron desktop shell backed by Vite, React, TypeScript and Tailwind CSS.
- Shared localisation catalogue in `app/common/i18n.ts` consumed by the renderer and Electron main process.
- Node-based audio analysis, stereo splitting and best-fit-decreasing packing services with Vitest coverage.
- Developer-mode dummy data generator exposed through the renderer and IPC bridge.
- Windows packaging task (`pnpm package:win`) backed by `electron-builder` to produce a distributable NSIS installer.
- Renderer action bar now exposes an “About” affordance that surfaces a translated modal with the packaged app version.
- Renderer info modal links now open in the system browser via a dedicated `open-external` IPC bridge helper.

### Changed
- Development runner now accepts an optional locale argument (e.g. `pnpm run dev de` or `--lang=fr`) and auto-detects the operating system language when no input is provided, falling back to English only when the locale is unsupported.
- Renderer header now displays the application version alongside the product name and the Electron window title mirrors the versioned label.
- Renderer header now uses a Material icon instead of the headphone emoji, drops the duplicate folder instruction copy and widens the selected-path display for long directories.
- Renderer header, action bar and modal controls now render Material Symbols icons instead of emojis while preserving layout and accessibility.
- Electron main window now clears the default application menu to hide the native menu bar across platforms.
- Runtime configuration now resolves locale/dev-mode via environment variables or OS defaults and is surfaced to the renderer through the preload bridge.
- Progress events, error reporting and packer actions now flow through typed IPC contracts shared between renderer and main processes.
- Documentation refreshed to highlight Node/Electron prerequisites, feature parity with the Python release and the new packaging expectations.
- Windows packaging now whitelists the pnpm runtime dependencies when copying `node_modules`, trimming dev tooling from the installer and reducing the bundled archive size.
- Package management switched from npm to pnpm, updating scripts and documentation accordingly.
- Repository ignore rules refocused on the Vite/TypeScript toolchain, removing stale Python artefacts and excluding generated source maps.
- Renderer shell keeps the header and action controls visible with sticky positioning while scrolling large file tables.
- Renderer pack button now adopts the blue accent palette to align hover and focus states with the folder selection control.
- Renderer info button now mirrors the pack control spacing and displays the translated label beside its icon.
- Renderer file table now lists the action column before the size column to match the desired order.
- Renderer file table now widens the filename column and narrows the size column to improve readability.
- Renderer file table now pulls the megabyte unit label from the locale-aware translation catalogue, enabling localized abbreviations.

### Removed
- Tkinter frontend, Python CLI switches and PyInstaller packaging instructions from the primary documentation set (archived under `docs/archive/python-legacy.md`).

### Fixed
- Windows development runner now reuses the invoking Node/PNPM executables, avoiding `spawn EINVAL` crashes when starting `pnpm run dev` on Windows terminals.
- File size display in the renderer table now respects locale-specific decimal separators when rendering megabyte values.
- Windows runtime now enforces a hoisted pnpm `node_modules` layout, ensuring `buffer-crc32` ships alongside `yazl` and preventing `Cannot find module 'buffer-crc32'` crashes when launching the packaged desktop app.
- Windows packaging now clears previous build artefacts before invoking Electron Builder, preventing `Zugriff verweigert` errors when rerunning `pnpm package:win` on Windows systems that keep `chrome_100_percent.pak` locked between builds.
- Windows installer packaging now bundles pnpm-managed production dependencies by including `node_modules` in the Electron Builder file list, ensuring the desktop app launches correctly from the distributable.
- Windows packaging metadata now satisfies Electron Builder by providing author/description fields and keeping the `electron` runtime scoped to development dependencies, restoring `pnpm package:win` builds.
- Locale resolution in the Electron main process now prioritises the operating system locale over English preference lists and generic `LANG` fallbacks, ensuring the renderer bootstraps with the expected language.
- The development Electron launcher now reruns the upstream installer when the binary download is skipped, preventing `Electron failed to install correctly` crashes after fresh installs.
- TypeScript watch mode for the preload bundle now keeps project references composite-friendly while emitting declarations, resolving the `TS6304` regression introduced with recent compiler upgrades.
- Electron build pipelines now share a common root directory and reference the shared `app/common` sources explicitly, restoring watch/build success for the main and preload processes while keeping runtime module resolution intact.
- Electron runtime now loads the rebuilt main/preload bundles from their new output locations, preventing `@common/*` resolution failures when launching the desktop shell.
- Stereo splitting now tolerates the community `wavefile` type gaps, preventing `toMono` compile errors and enabling deterministic WAV channel extraction during packaging.
- Electron window creation now waits for the compiled preload bundle and resolves it via the application root, eliminating `Unable to load preload script` crashes and keeping the renderer runtime configuration available.
- Packaging stamps now read the shared application version metadata, ensuring the generated archive banner matches the bundled release number.
- The renderer template now ships with a strict content security policy, silencing the Electron CSP warning while keeping development hot reloading functional.
