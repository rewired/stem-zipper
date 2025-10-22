# Stem ZIPper

Stem ZIPper is now delivered as an Electron application that combines a Vite powered React + TypeScript renderer with a modern desktop runtime. The tool keeps the original mission of preparing sample packs for platforms such as [ccmixter.org](https://ccmixter.org) by analysing folders full of audio files, splitting stereo WAV files if necessary and producing optimally filled ZIP archives.

---

## Highlights

- 🎛️ **Modern desktop UI** built with React, Tailwind CSS and Electron.
- 🗂️ **Drag & drop** or manual folder selection with live validation of the configured ZIP size target.
- 📦 **Best-fit packing** into `stems-XX.zip` archives including the classic Stem ZIPper stamp file.
- 🪄 **Automatic mono-splitting** for stereo WAV files that exceed the configured limit.
- 🌍 **Multilingual interface** (EN, DE, FR, IT, ES, PT) that adapts to the operating system locale.
- 🧪 **Developer utilities** (available in dev mode) to generate dummy audio files for testing the packing workflow.

Supported formats remain: `.wav`, `.flac`, `.mp3`, `.aiff`, `.ogg`, `.aac`, `.wma`.

---

## Project layout

```
app/
├── electron/        # Main & preload processes and packaging services
├── src/             # React renderer (components, styling, localisation)
├── common/          # Shared constants, IPC contracts and helpers
├── index.html       # Vite entry point
└── package.json     # Electron/Vite workspace configuration
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) **18.x or newer**
- [pnpm](https://pnpm.io/) (enable via `corepack enable pnpm` if it is not yet available). The workspace pins `node-linker=hoisted` via `.npmrc` so that production dependencies are flattened for Electron packaging.
- macOS, Windows or Linux desktop environment with file system access for Electron

> ✅ The legacy Python/Tkinter bundle has been retired on this branch. All features now ship with the Electron workspace under `app/`.

---

## Installation & workflows

Run the following steps from the repository root unless noted otherwise.

### Install dependencies

```bash
cd app
pnpm install
```

### Development workflow

```bash
pnpm dev
```

Pass an optional locale when launching the development workflow to override the interface language, for example:

```bash
pnpm dev de
pnpm dev -- --lang=fr
```

If no locale is provided, the runners detect the operating system language and only fall back to English (`en`) when the locale
cannot be resolved.

This command starts the Vite dev server, compiles the Electron main & preload processes in watch mode and launches Electron once the renderer is ready. Any change in `src/` hot-reloads the UI, while updates to Electron code trigger a fast TypeScript rebuild.

> ℹ️ The Electron launcher verifies that the native binary is available. If the post-install download was skipped (for example when `ELECTRON_SKIP_BINARY_DOWNLOAD=1` was set globally), the script reruns the official installer before starting the desktop shell.

### Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
```

- **`lint`** runs ESLint with the React/TypeScript configuration.
- **`typecheck`** executes `tsc --noEmit` across the Electron + renderer workspaces.
- **`test`** triggers Vitest suites that cover the Node-based packing engine and helper utilities.

### Production build & smoke test

```bash
pnpm build
pnpm preview
```

The build pipeline produces two artefacts:

- `dist-renderer/` – the production React bundle styled with Tailwind CSS.
- `dist-electron/` – compiled Electron main & preload scripts ready for packaging.

`pnpm preview` launches the built application locally using the generated artefacts, allowing a final manual smoke test before packaging.

### Cleanup generated artefacts

```bash
pnpm clean
```

The cleanup task removes the `dist-electron/`, `dist-renderer/` and `release/` directories. It is safe to run repeatedly and helps keep cross-platform builds reproducible.

---

## Feature parity with the classic release

| Area | Electron implementation |
| --- | --- |
| **User interface** | Single-window layout with a header toolbar, drag & drop surface, folder path breadcrumb and a responsive file table. The right-hand status rail mirrors the legacy progress readout, while action buttons (Pack Now, Cancel, Clear) stay anchored at the bottom for accessibility. |
| **Internationalisation** | The renderer resolves the OS locale (EN, DE, FR, IT, ES, PT) via the preload bridge, serving shared translations from `app/common/i18n.ts`. Dialogs triggered from the main process reuse the same catalogue to avoid drift between Electron and React copies. |
| **Developer tooling** | Dev-mode exposes the familiar "Create Test Data" button which shells out to the Node dummy-data generator. File sizes, stems count and progress notifications follow the Python defaults to keep test scripts compatible. |
| **ZIP logic** | Audio analysis, stereo-to-mono splitting and best-fit-decreasing packing now run inside the Electron main process (`app/electron/services/packer`). The workflow persists the `_stem-zipper.txt` stamp file and emits sequential `stems-XX.zip` archives identical to the Tkinter run. |

### UI walk-through

1. **Header** – Displays the application title and quick links to settings and documentation.
2. **Drop zone** – Central card that accepts folders via drag & drop or manual selection. Provides immediate feedback on unsupported file types.
3. **Analysis table** – Responsive table summarising detected files, duration, size and pending actions (pack, split, ignore). Rows highlight when splitting or multi-archive packing will occur.
4. **Progress rail** – Right-aligned timeline showing current phase (scanning, splitting, packing) with an indeterminate spinner for long-running tasks.
5. **Action footer** – Primary **Pack Now** button plus contextual secondary controls (**Cancel**, **Clear Results**) matching the previous keyboard shortcuts.

> Need a visual reference? See the annotated UI description above or explore the interactive preview via `pnpm dev`.

---

## Usage tips

1. Choose or drop a folder containing supported audio files.
2. Adjust the **Max ZIP size (MB)** field if required (defaults to 48 MB, capped at 500 MB).
3. Review the analysed files in the table – the action column highlights when mono splitting or multi-archive packaging will occur.
4. Click **Pack Now** to create `stems-XX.zip` files in the source folder. Progress updates mirror the classic Tkinter interface.
5. In development builds, a **Create Test Data (DEV)** button generates random dummy audio files in a chosen directory.

---

## Packaging & distribution

### Windows installer

```bash
pnpm package:win
```

Run this command from the `app/` workspace. It compiles the renderer and Electron processes and then uses [electron-builder](https://www.electron.build/) to generate an NSIS installer for 64-bit Windows. The packaging script automatically runs `pnpm clean` first to clear previous releases, preventing Windows from holding on to files such as `chrome_100_percent.pak` between successive builds.

The Electron Builder configuration now whitelists only the production runtime packages (`buffer-crc32`, `clsx`, `react`, `react-dom`, `scheduler`, `loose-envify`, `js-tokens`, `wavefile`, `yazl`) so that development tooling such as Vite and ESLint is no longer copied into the installer. After running the packaging task you can inspect the generated archive with:

```bash
npx asar extract release/win-unpacked/resources/app.asar /tmp/app-asar
ls /tmp/app-asar/node_modules
```

The extracted `node_modules` directory should only contain the runtime dependencies listed above, yielding a noticeably smaller `app.asar` and installer payload. Execute the task on Windows (or a Linux/macOS machine with [Wine](https://wiki.winehq.org/) configured) to ensure the `.exe` is produced successfully.

### Other platforms

- The workspace remains ready for additional tooling such as [Electron Forge](https://www.electronforge.io/) or custom `electron-builder` targets; integrate them on top of the generated `dist-electron` and `dist-renderer` artefacts.
- Cross-platform signing/notarisation scripts should live alongside the Electron configuration inside `app/electron`.
- The retired PyInstaller flow lives in `docs/archive/python-legacy.md` together with notes on the final Tkinter build.

---

## License

MIT License  
© 2025 Björn Ahlers
