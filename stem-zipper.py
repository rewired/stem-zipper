import os
import zipfile
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

MAX_FOLDER_SIZE_MB = 50
MAX_FOLDER_SIZE_BYTES = MAX_FOLDER_SIZE_MB * 1024 * 1024
SUPPORTED_EXTENSIONS = ('.wav', '.flac', '.mp3', '.aiff', '.ogg', '.aac', '.wma')

def get_file_size(path):
    return os.path.getsize(path)

def create_zip(file_group, output_dir, zip_index):
    zip_name = os.path.join(output_dir, f"stems-{zip_index:02}.zip")
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in file_group:
            zipf.write(file_path, arcname=os.path.basename(file_path))
    return zip_name

def best_fit_pack(files):
    """Verteilt Dateien optimal auf ZIP-Gruppen nach Best-Fit-Decreasing."""
    files.sort(key=lambda x: x[1], reverse=True)
    bins = []

    for file_path, size in files:
        best_bin = None
        min_remaining = MAX_FOLDER_SIZE_BYTES + 1
        for b in bins:
            remaining = MAX_FOLDER_SIZE_BYTES - sum(f[1] for f in b)
            if size <= remaining < min_remaining:
                best_bin = b
                min_remaining = remaining
        if best_bin is None:
            bins.append([(file_path, size)])
        else:
            best_bin.append((file_path, size))
    return bins

def process_folder(folder_path, progress_label):
    all_files = [
        os.path.join(folder_path, f)
        for f in os.listdir(folder_path)
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS
    ]

    if not all_files:
        messagebox.showwarning("Keine Dateien", "Keine unterstützten Audio-Dateien gefunden.")
        return

    files_with_sizes = [(f, get_file_size(f)) for f in all_files]
    file_groups = best_fit_pack(files_with_sizes)

    created_zips = []
    for i, group in enumerate(file_groups, start=1):
        zip_path = create_zip([f for f, _ in group], folder_path, i)
        created_zips.append(zip_path)
        progress_label.config(text=f"Erstelle {os.path.basename(zip_path)} ...")
        progress_label.update_idletasks()

    messagebox.showinfo("Fertig", f"{len(created_zips)} ZIP-Dateien erstellt.")
    progress_label.config(text="Bereit")

def select_folder(progress_label):
    folder = filedialog.askdirectory(title="Ordner auswählen mit Audiodateien")
    if folder:
        process_folder(folder, progress_label)

def main():
    root = tk.Tk()
    root.title("Audio Stem Splitter & ZIPper")
    root.geometry("400x180")
    root.resizable(False, False)

    frame = ttk.Frame(root, padding=20)
    frame.pack(expand=True, fill='both')

    label = ttk.Label(frame, text="Ziehe einen Ordner hierher oder wähle ihn aus:")
    label.pack(pady=10)

    progress_label = ttk.Label(frame, text="Bereit")
    progress_label.pack(pady=5)

    def drop_folder(event):
        folder = event.data.strip("{}")
        process_folder(folder, progress_label)

    try:
        import tkinterdnd2
        from tkinterdnd2 import TkinterDnD
        root.destroy()
        root = TkinterDnD.Tk()
        root.title("Audio Stem Splitter & ZIPper")
        frame = ttk.Frame(root, padding=20)
        frame.pack(expand=True, fill='both')
        label = ttk.Label(frame, text="Ordner hierher ziehen:")
        label.pack(pady=10)
        label.drop_target_register('DND_Files')
        label.dnd_bind('<<Drop>>', drop_folder)
        progress_label = ttk.Label(frame, text="Bereit")
        progress_label.pack(pady=5)
    except ImportError:
        pass  # tkinterdnd2 ist optional, Fallback auf Button

    btn = ttk.Button(frame, text="Ordner auswählen", command=lambda: select_folder(progress_label))
    btn.pack(pady=15)

    root.mainloop()

if __name__ == "__main__":
    main()