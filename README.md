# Stem ZIPper

Stem ZIPper analyses folders of audio stems, splits over-sized stereo WAV files, and packs the results into optimised ZIP archives that stay under a configurable size limit. The project now ships with a full Electron + TypeScript client powered by Vite, React, and Tailwind while keeping the original Python/Tkinter implementation as a reference.

## Features

- Modern Electron desktop UI with Tailwind styling and Headless UI components.
- Intelligent best-fit packing into `stems-XX.zip` archives with an adjustable size target (default 48 MB, cap 500 MB).
- Automatic stereo WAV channel splitting, `_stem-zipper.txt` archive stamp, and optional dummy test data generator.
- Built-in localisation for English, German, French, Italian, Spanish, and Portuguese with CLI overrides (`--lang`).
- Developer mode toggle (`--dev`) that exposes the test-data generator button in the UI.
- Cross-platform packaging workflows for Windows, macOS, and Linux via `electron-builder`.

## Requirements

| Component | Requirements |
|-----------|--------------|
| Electron app | Node.js 18+ and npm |
| Legacy Python client | Python 3.9+, Tkinter, `pip install -r requirements.txt` |

## Repository Layout

- `electron-app/` – Electron workspace containing main, preload, renderer, and build tooling.
- `stem-zipper.py` – Original Python/Tkinter GUI (kept for reference and parity testing).
- `docs/adr/` – Architectural decision records (see ADR 0001 for the Electron migration).
- `CHANGELOG.md` – Versioned summary of notable changes.

## Electron App Quickstart

```bash
cd electron-app
npm install
npm run dev
```

The dev server launches Vite (renderer) and recompiles the main/preload processes. Electron opens automatically once the renderer is ready.

### Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite, watch the main/preload processes, and launch Electron with `--dev`. |
| `npm run build` | Produce production builds in `dist/` for main, preload, and renderer bundles. |
| `npm run preview` | Launch Electron against the already-built bundles in `dist/`. |
| `npm run package` | Build and package installers via `electron-builder` into `release/`. |
| `npm run lint` | Run ESLint across the TypeScript sources. |

### Packaging Targets

`npm run package` executes `electron-builder` with presets for all major platforms:

- **Windows:** NSIS installer and ZIP archive in `release/`. Run with PowerShell/CMD or CI on Windows.
- **macOS:** Universal DMG and ZIP bundles in `release/`. Requires running on macOS (codesigning optional).
- **Linux:** AppImage and `tar.gz` archives in `release/`. Execute on Linux runners.

Place platform-specific icons or resources inside `electron-app/build/` before packaging.

### Language & Developer Flags

Electron forwards the original CLI switches:

- `--dev` – Enables developer mode (test data button).
- `--lang <code>` – Forces a specific language (`en`, `de`, `fr`, `it`, `es`, `pt`).

Examples:

```bash
# Run the packaged app in German
electron . --lang=de

# Launch dev mode with the generator button visible
npm run dev -- --dev
```

## Legacy Python Client

The Tkinter application is still available for compatibility checks.

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python stem-zipper.py [--dev] [--lang=de]
```

Feature parity with the Electron client is maintained by sharing translations and mirroring the packing algorithms.

## Documentation

- [CHANGELOG](CHANGELOG.md) – Track notable updates and releases.
- [ADR 0001](docs/adr/0001-electron-migration.md) – Decision record for the Electron migration.

## License

MIT License © 2025 Björn Ahlers
