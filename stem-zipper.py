import os
import shutil
import zipfile
import subprocess
import platform
import wave
import random
import argparse
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

# ---------------------------------------------------------------------------
# KONSTANTEN
# ---------------------------------------------------------------------------
MAX_SIZE_MB = 50
MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
SUPPORTED_EXTENSIONS = ('.wav', '.flac', '.mp3', '.aiff', '.ogg', '.aac', '.wma')
AUDIO_EXTENSIONS = SUPPORTED_EXTENSIONS

# ---------------------------------------------------------------------------
# HELFER: WAV Split
# ---------------------------------------------------------------------------
def split_stereo_wav(filepath):
    """Teilt eine Stereo-WAV-Datei in zwei Mono-Dateien auf."""
    try:
        with wave.open(filepath, 'rb') as stereo:
            if stereo.getnchannels() != 2:
                return [filepath]

            sampwidth = stereo.getsampwidth()
            framerate = stereo.getframerate()
            nframes = stereo.getnframes()
            frames = stereo.readframes(nframes)

            left, right = bytearray(), bytearray()
            for i in range(0, len(frames), sampwidth * 2):
                left += frames[i:i + sampwidth]
                right += frames[i + sampwidth:i + 2 * sampwidth]

            base, ext = os.path.splitext(filepath)
            left_path, right_path = f"{base}_L{ext}", f"{base}_R{ext}"

            for ch_path, ch_data in [(left_path, left), (right_path, right)]:
                with wave.open(ch_path, 'wb') as ch:
                    ch.setnchannels(1)
                    ch.setsampwidth(sampwidth)
                    ch.setframerate(framerate)
                    ch.writeframes(ch_data)

            os.remove(filepath)
            return [left_path, right_path]
    except Exception as e:
        print(f"Fehler beim Splitten von {filepath}: {e}")
        return [filepath]

# ---------------------------------------------------------------------------
# HELFER: ZIP / SPLIT-ZIP
# ---------------------------------------------------------------------------
def create_zip(zip_name, files, output_dir):
    """Erstellt ZIP aus Dateien."""
    zip_path = os.path.join(output_dir, f"{zip_name}.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file_path in files:
            zf.write(file_path, arcname=os.path.basename(file_path))
    return zip_path

def split_zip(zip_path):
    """Teilt ZIP in mehrere 50MB-Teile (plattformabhängig)."""
    system = platform.system().lower()
    try:
        if system in ("darwin", "linux"):
            subprocess.run(["zip", "-s", "50m", zip_path, "--out", zip_path], check=True)
        elif system == "windows":
            subprocess.run(["7z", "a", "-v50m", zip_path, zip_path], check=True)
        print(f"Split-ZIP erstellt für {os.path.basename(zip_path)}")
    except Exception:
        print(f"Split-ZIP konnte nicht erstellt werden (kein 'zip' oder '7z' gefunden).")

# ---------------------------------------------------------------------------
# BEST-FIT PACKER
# ---------------------------------------------------------------------------
def best_fit_pack(files):
    files.sort(key=lambda x: x[1], reverse=True)
    bins = []
    for path, size in files:
        best_bin, min_remaining = None, MAX_SIZE_BYTES + 1
        for b in bins:
            remaining = MAX_SIZE_BYTES - sum(f[1] for f in b)
            if size <= remaining < min_remaining:
                best_bin, min_remaining = b, remaining
        if best_bin is None:
            bins.append([(path, size)])
        else:
            best_bin.append((path, size))
    return bins

# ---------------------------------------------------------------------------
# TESTDATEN GENERATOR (DEV)
# ---------------------------------------------------------------------------
def create_dummy_file(path, size_mb):
    size_bytes = int(size_mb * 1024 * 1024)
    header = b"FAKEAUDIO" + bytes(f" {os.path.basename(path)}", "utf-8")
    with open(path, "wb") as f:
        f.write(header)
        f.write(os.urandom(max(size_bytes - len(header), 0)))

def create_test_files(output_dir, num_files=20, min_size=2.0, max_size=20.0):
    os.makedirs(output_dir, exist_ok=True)
    for i in range(1, num_files + 1):
        ext = random.choice(AUDIO_EXTENSIONS)
        size = round(random.uniform(min_size, max_size), 2)
        filename = f"testfile_{i:03}{ext}"
        path = os.path.join(output_dir, filename)
        create_dummy_file(path, size)
        print(f"Testdatei erstellt: {filename} ({size} MB)")
    messagebox.showinfo("Testdaten erstellt", f"{num_files} Dummy-Dateien in:\n{output_dir}")

# ---------------------------------------------------------------------------
# VERARBEITUNG
# ---------------------------------------------------------------------------
def process_folder(folder_path, progress_label):
    all_files = [
        os.path.join(folder_path, f)
        for f in os.listdir(folder_path)
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
    ]
    if not all_files:
        messagebox.showwarning("Keine Dateien", "Keine unterstützten Audiodateien gefunden.")
        return

    expanded_files = []
    for f in all_files:
        size = os.path.getsize(f)
        if size > MAX_SIZE_BYTES and f.lower().endswith(".wav"):
            print(f"Splitte große WAV-Datei: {os.path.basename(f)}")
            for new_f in split_stereo_wav(f):
                expanded_files.append((new_f, os.path.getsize(new_f)))
        else:
            expanded_files.append((f, size))

    groups = best_fit_pack(expanded_files)
    created_zips = []

    for i, group in enumerate(groups, start=1):
        zip_name = f"stems-{i:02}"
        zip_path = create_zip(zip_name, [f for f, _ in group], folder_path)
        created_zips.append(zip_path)
        if os.path.getsize(zip_path) > MAX_SIZE_BYTES:
            split_zip(zip_path)
        progress_label.config(text=f"{zip_name}.zip erstellt...")
        progress_label.update_idletasks()

    messagebox.showinfo("Fertig", f"{len(created_zips)} ZIP-Dateien erstellt.")
    progress_label.config(text="Bereit")

# ---------------------------------------------------------------------------
# GUI
# ---------------------------------------------------------------------------
def select_folder(progress_label):
    folder = filedialog.askdirectory(title="Ordner mit Audiodateien wählen")
    if folder:
        process_folder(folder, progress_label)

def dev_create_testdata(progress_label):
    folder = filedialog.askdirectory(title="Zielverzeichnis für Testdaten")
    if folder:
        create_test_files(folder)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dev", action="store_true", help="Entwicklermodus mit Testdaten-Button aktivieren")
    args = parser.parse_args()

    root = tk.Tk()
    root.title("STEM ZIPPER")
    root.geometry("420x220")
    root.resizable(False, False)

    frame = ttk.Frame(root, padding=20)
    frame.pack(expand=True, fill='both')

    ttk.Label(frame, text="Ziehe einen Ordner hierher oder wähle ihn aus:").pack(pady=10)
    progress_label = ttk.Label(frame, text="Bereit")
    progress_label.pack(pady=5)

    ttk.Button(frame, text="Ordner auswählen", command=lambda: select_folder(progress_label)).pack(pady=10)

    if args.dev:
        ttk.Separator(frame, orient="horizontal").pack(fill="x", pady=10)
        ttk.Button(frame, text="Testdaten erstellen (DEV)", command=lambda: dev_create_testdata(progress_label)).pack(pady=5)

    root.mainloop()

if __name__ == "__main__":
    main()
