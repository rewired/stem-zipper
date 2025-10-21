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
- npm (bundled with Node.js)

> The Python/Tkinter application has been removed in this branch. All functionality now lives in the Electron experience under `app/`.

---

## Getting started

From the repository root:

```bash
cd app
npm install
```

### Development mode

```bash
npm run dev
```

This command starts the Vite dev server, compiles the Electron main & preload processes in watch mode and launches Electron once the renderer is ready. Any change in `src/` hot-reloads the UI, while updates to Electron code trigger a quick TypeScript rebuild.

### Linting & type checks

```bash
npm run lint
npm run typecheck
```

### Production build

```bash
npm run build
```

The build pipeline produces:

- `dist-renderer/` – the production React bundle.
- `dist-electron/` – compiled Electron main & preload scripts.

Launch the packaged application locally via:

```bash
npm run preview
```

---

## Usage tips

1. Choose or drop a folder containing supported audio files.
2. Adjust the **Max ZIP size (MB)** field if required (defaults to 48 MB, capped at 500 MB).
3. Review the analysed files in the table – the action column highlights when mono splitting or multi-archive packaging will occur.
4. Click **Pack Now** to create `stems-XX.zip` files in the source folder. Progress updates mirror the classic Tkinter interface.
5. In development builds, a **Create Test Data (DEV)** button generates random dummy audio files in a chosen directory.

---

## Packaging & distribution

Electron Builder or Forge are not yet wired into this branch. To distribute the application you can integrate your preferred packaging tool on top of the generated `dist-electron` and `dist-renderer` artefacts.

---

## License

MIT License  
© 2025 Björn Ahlers
