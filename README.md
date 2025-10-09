# Audio Stem Splitter & ZIPper

This tool enables the automatic splitting and packing of large audio file collections into ZIP archives with a maximum of 50 MB per archive.
The files are distributed optimally so that the available space is utilized as efficiently as possible.

Supported formats:
`.wav`, `.flac`, `.mp3`, `.aiff`, `.ogg`, `.aac`, `.wma`

---

## Features

* Drag & Drop GUI (or manual folder selection)
* Automatic packing into `stems-XX.zip` (max. 50 MB)
* Intelligent distribution (Best-Fit-Decreasing)
* Cross-platform (Windows / macOS / Linux)
* Optional: Create a standalone app (.exe / .app / binary)

---

## Requirements

* **Python 3.9+**
* Internet connection (for the initial `pip install`)
* `tkinter` (usually preinstalled; only minimal Linux installations require additional setup)

---

## Installation

### 1. Clone or extract the repository

```bash
git clone https://github.com/<dein-repo>/audio-stem-zipper.git
cd audio-stem-zipper
```

or extract the ZIP and change into the project directory.

### 2. Create a virtual environment

Windows (PowerShell or CMD)

```bash
python -m venv venv
venv\Scripts\activate
```

macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

## Usage

### Option A

Run directly (recommended during development)

```bash
python stems_gui.py
```

### Option B

Create a standalone app

#### Windows (.exe)

```bash
pyinstaller --noconfirm --onefile --windowed stems_gui.py
```

Result:
`dist/stems_gui.exe`

#### macOS (.app)

```bash
pyinstaller --noconfirm --onefile --windowed --name "AudioStemZipper" stems_gui.py
```

Result:
`dist/AudioStemZipper.app`

> On first launch under macOS you may need to right-click → Open (due to Gatekeeper).

#### Linux (binary)

```bash
pyinstaller --noconfirm --onefile stems_gui.py
```

Result:
`dist/stems_gui`

Run the file with:

```bash
./dist/stems_gui
```

## License

MIT License
© 2025 Björn Ahlers
