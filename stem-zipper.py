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

MAX_SIZE_MB = 50
MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
SUPPORTED_EXTENSIONS = ('.wav', '.flac', '.mp3', '.aiff', '.ogg', '.aac', '.wma')


# ---------------------------------------------------------------------
# WAV-SPLIT
# ---------------------------------------------------------------------
def split_stereo_wav(filepath):
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


# ---------------------------------------------------------------------
# ZIP / SPLIT-ZIP
# ---------------------------------------------------------------------
def create_zip(zip_name, files, output_dir):
    zip_path = os.path.join(output_dir, f"{zip_name}.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file_path in files:
            zf.write(file_path, arcname=os.path.basename(file_path))
    return zip_path


def split_zip(zip_path):
    system = platform.system().lower()
    try:
        if system in ("darwin", "linux"):
            subprocess.run(["zip", "-s", "50m", zip_path, "--out", zip_path], check=True)
        elif system == "windows":
            subprocess.run(["7z", "a", "-v50m", zip_path, zip_path], check=True)
        print(f"Split-ZIP erstellt für {os.path.basename(zip_path)}")
    except Exception:
        print(f"Split-ZIP konnte nicht erstellt werden (kein 'zip' oder '7z' gefunden).")


# ---------------------------------------------------------------------
# PACK-LOGIK
# ---------------------------------------------------------------------
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


# ---------------------------------------------------------------------
# TESTDATEN
# ---------------------------------------------------------------------
def create_dummy_file(path, size_mb):
    size_bytes = int(size_mb * 1024 * 1024)
    header = b"FAKEAUDIO" + bytes(f" {os.path.basename(path)}", "utf-8")
    with open(path, "wb") as f:
        f.write(header)
        f.write(os.urandom(max(size_bytes - len(header), 0)))


def create_test_files(output_dir, num_files=20, min_size=2.0, max_size=20.0):
    os.makedirs(output_dir, exist_ok=True)
    for i in range(1, num_files + 1):
        ext = random.choice(SUPPORTED_EXTENSIONS)
        size = round(random.uniform(min_size, max_size), 2)
        filename = f"testfile_{i:03}{ext}"
        path = os.path.join(output_dir, filename)
        create_dummy_file(path, size)
    messagebox.showinfo("Testdaten erstellt", f"{num_files} Dummy-Dateien in:\n{output_dir}")


# ---------------------------------------------------------------------
# ANALYSE
# ---------------------------------------------------------------------
def analyze_folder(folder_path):
    file_list = []
    for f in os.listdir(folder_path):
        ext = os.path.splitext(f)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        fp = os.path.join(folder_path, f)
        size = os.path.getsize(fp)
        action = "Normal"
        if size > MAX_SIZE_BYTES:
            if ext == ".wav":
                action = "Split Mono"
            else:
                action = "Split ZIP"
        file_list.append((f, round(size / (1024 * 1024), 2), action))
    return file_list


# ---------------------------------------------------------------------
# VERARBEITUNG (mit Fortschrittsbalken)
# ---------------------------------------------------------------------
def process_folder(folder_path, progress_label, progress_bar):
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
    total = len(groups)
    progress_bar["maximum"] = total

    for i, group in enumerate(groups, start=1):
        zip_name = f"stems-{i:02}"
        zip_path = create_zip(zip_name, [f for f, _ in group], folder_path)
        created_zips.append(zip_path)
        if os.path.getsize(zip_path) > MAX_SIZE_BYTES:
            split_zip(zip_path)

        progress_bar["value"] = i
        percent = int((i / total) * 100)
        progress_label.config(text=f"{zip_name}.zip erstellt ({percent}%)")

        # Farbänderung
        progress_bar.update_idletasks()
        if percent < 100:
            progress_bar.configure(style="Blue.Horizontal.TProgressbar")
        else:
            progress_bar.configure(style="Green.Horizontal.TProgressbar")

    messagebox.showinfo("Fertig", f"{len(created_zips)} ZIP-Dateien erstellt.")
    progress_label.config(text="Fertig.")
    progress_bar["value"] = 0


# ---------------------------------------------------------------------
# GUI
# ---------------------------------------------------------------------
class StemZipperGUI:
    def __init__(self, dev_mode=False):
        self.dev_mode = dev_mode
        self.folder = None
        self.root = tk.Tk()
        self.root.title("STEM ZIPPER")
        self.root.geometry("850x600")
        self.root.resizable(False, False)

        style = ttk.Style()
        style.theme_use("clam")
        style.configure("Treeview.Heading", font=("Segoe UI", 10, "bold"))
        style.configure("Treeview", rowheight=22, background="#f9f9f9", fieldbackground="#f9f9f9")
        style.configure("Blue.Horizontal.TProgressbar", troughcolor="#eee", background="#4a90e2")
        style.configure("Green.Horizontal.TProgressbar", troughcolor="#eee", background="#4caf50")

        # --- TOP SECTION ---
        top_frame = ttk.Frame(self.root, padding=(20, 15, 20, 5))
        top_frame.pack(fill="x")

        ttk.Label(top_frame, text="Ordner auswählen oder hineinziehen:", font=("Segoe UI", 11)).pack(side="left", padx=(0, 10))
        ttk.Button(top_frame, text="Ordner auswählen", command=self.select_folder).pack(side="left")

        # --- TABLE SECTION ---
        table_frame = ttk.Frame(self.root, padding=(20, 10))
        table_frame.pack(fill="both", expand=True)

        columns = ("name", "size", "action")
        self.tree = ttk.Treeview(table_frame, columns=columns, show="headings", height=15)
        self.tree.heading("name", text="Datei")
        self.tree.heading("size", text="Größe (MB)")
        self.tree.heading("action", text="Aktion")

        self.tree.column("name", width=480, anchor="w")
        self.tree.column("size", width=120, anchor="center")
        self.tree.column("action", width=160, anchor="center")

        scrollbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscroll=scrollbar.set)
        self.tree.grid(row=0, column=0, sticky="nsew")
        scrollbar.grid(row=0, column=1, sticky="ns")

        table_frame.grid_columnconfigure(0, weight=1)
        table_frame.grid_rowconfigure(0, weight=1)

        # --- STATUS + PROGRESS ---
        status_frame = ttk.Frame(self.root, padding=(20, 5))
        status_frame.pack(fill="x")

        self.progress_bar = ttk.Progressbar(status_frame, length=650, mode="determinate", style="Blue.Horizontal.TProgressbar")
        self.progress_bar.pack(side="left", padx=(0, 10), fill="x", expand=True)

        self.progress_label = ttk.Label(status_frame, text="Bereit")
        self.progress_label.pack(side="left")

        # --- BUTTONS ---
        button_frame = ttk.Frame(self.root, padding=(20, 10))
        button_frame.pack(fill="x")

        self.start_btn = ttk.Button(button_frame, text="Jetzt packen", command=self.start_pack, state="disabled")
        self.start_btn.pack(side="left")

        if self.dev_mode:
            ttk.Button(button_frame, text="Testdaten erstellen (DEV)", command=self.create_testdata).pack(side="left", padx=10)

        ttk.Button(button_frame, text="Beenden", command=self.root.destroy).pack(side="right")

        self.root.mainloop()

    def select_folder(self):
        self.folder = filedialog.askdirectory(title="Ordner wählen")
        if not self.folder:
            return
        self.populate_preview()

    def populate_preview(self):
        for row in self.tree.get_children():
            self.tree.delete(row)
        files = analyze_folder(self.folder)
        for name, size, action in files:
            self.tree.insert("", "end", values=(name, size, action))
        self.progress_label.config(text=f"{len(files)} Dateien gefunden.")
        if files:
            self.start_btn["state"] = "normal"

    def start_pack(self):
        process_folder(self.folder, self.progress_label, self.progress_bar)

    def create_testdata(self):
        folder = filedialog.askdirectory(title="Zielverzeichnis für Testdaten")
        if folder:
            create_test_files(folder)


# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dev", action="store_true")
    args = parser.parse_args()
    StemZipperGUI(dev_mode=args.dev)


if __name__ == "__main__":
    main()
