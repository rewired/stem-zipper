# Audio Stem Splitter & ZIPper

Dieses Tool ermöglicht das automatische Aufteilen und Packen großer Audio-Dateisammlungen in ZIP-Archive mit maximal 50 MB pro Archiv.  
Die Dateien werden dabei optimal verteilt, sodass der Speicherplatz bestmöglich ausgenutzt wird.

Unterstützte Formate:
`.wav`, `.flac`, `.mp3`, `.aiff`, `.ogg`, `.aac`, `.wma`

---

## Funktionen

- Drag & Drop GUI (oder manuelle Ordnerauswahl)
- Automatisches Packen in `stems-XX.zip` (max. 50 MB)
- Intelligente Verteilung (Best-Fit-Decreasing)
- Plattformübergreifend (Windows / macOS / Linux)
- Optional: Erstellung einer ausführbaren App (.exe / .app / Binärdatei)

---

## Voraussetzungen

- **Python 3.9+**
- Internetverbindung (für das erste `pip install`)
- `tkinter` (meist vorinstalliert; nur Linux-Minimal-Installationen benötigen Nachinstallation)

---

## Installation

### 1. Repository klonen oder entpacken

```bash
git clone https://github.com/<dein-repo>/audio-stem-zipper.git
cd audio-stem-zipper
```

oder ZIP entpacken und ins Projektverzeichnis wechseln.

### 2. Virtuelle Umgebung erstellen

Windows (PowerShell oder CMD)

```bash
python -m venv venv
venv\Scripts\activate
```

macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Abhängigkeiten installieren

```bash
pip install -r requirements.txt
```

## Verwendung

### Variante A

Direkt ausführen (empfohlen während der Entwicklung)

```bash
python stems_gui.py
```

### Variante B

Erstellung einer ausführbaren App

#### Windows (.exe)

```bash
pyinstaller --noconfirm --onefile --windowed stems_gui.py
```

Ergebnis:
`dist/stems_gui.exe`

#### macOS (.app)

```bash
pyinstaller --noconfirm --onefile --windowed --name "AudioStemZipper" stems_gui.py
```

Ergebnis:
`dist/AudioStemZipper.app`

> Beim ersten Start unter macOS ggf. Rechtsklick → Öffnen (wegen Gatekeeper).

#### Linux (Binärdatei)

```bash
pyinstaller --noconfirm --onefile stems_gui.py
```

Ergebnis:
`dist/stems_gui`

Ausführen der Datei mit:

```bash
./dist/stems_gui
```

## Lizenz

MIT License
© 2025 Björn Ahlers
