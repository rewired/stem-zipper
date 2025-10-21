# Legacy Python/Tkinter Build (Archived)

The classic Stem ZIPper desktop experience was implemented with Python 3.10, Tkinter and PyInstaller. The implementation remains available in the Git history prior to commit `86e0e40` ("feat: migrate ui to electron").

## Getting the legacy source

```bash
git checkout 86e0e40^  # or any earlier tag preceding the Electron migration
```

The repository layout at that revision exposes the following artefacts:

- `stem-zipper.py` – Tkinter GUI entry point.
- `packing/` – Python modules responsible for audio analysis, WAV splitting and ZIP creation.
- `requirements.txt` – pinned dependencies for local development.

## Local development workflow

```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python stem-zipper.py
```

## Packaging with PyInstaller

```bash
pyinstaller stem-zipper.spec
```

The generated binaries will be placed in `dist/`. Refer to the archived README inside the checkout for platform-specific switches.

> ⚠️ The Python/Tkinter codebase is no longer maintained. Bug fixes and new functionality land exclusively in the Electron + Node stack documented in the main branch.
