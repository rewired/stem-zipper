import os
import zipfile
import subprocess
import platform
import wave
import random
import argparse
import locale
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

# ============================================================
# I18N / LANGUAGES
# ============================================================
LANGS = {
    "en": {"app_title": "Stem ZIPper","select_folder": "Select Folder","now_packing": "Packing...","ready": "Ready",
            "create_testdata": "Create Test Data (DEV)","exit": "Exit","found_files": "{} files found.",
            "pack_now": "Pack Now","choose_folder": "Choose Folder","header_label": "Select or drop a folder:",
            "table_file": "File","table_size": "Size (MB)","table_action": "Action","status_done": "Done.",
            "status_packing": "Creating {}...","msg_no_files": "No supported audio files found.",
            "msg_finished": "{} ZIP files created successfully.","msg_testdata_done": "{} dummy files created in:\n{}",
            "split_mono": "Split Mono","split_zip": "Split ZIP","normal": "Normal",
            "max_size_label": "Max ZIP size (MB):","max_size_tooltip": "Set the target size per ZIP archive.",
            "msg_invalid_max_size": "Please enter a value greater than 0 and up to {} MB. Resetting to {} MB."},
    "de": {"app_title": "Stem ZIPper","select_folder": "Ordner auswählen","now_packing": "Wird gepackt...","ready": "Bereit",
            "create_testdata": "Testdaten erstellen (DEV)","exit": "Beenden","found_files": "{} Dateien gefunden.",
            "pack_now": "Jetzt packen","choose_folder": "Ordner wählen","header_label": "Ordner auswählen oder hineinziehen:",
            "table_file": "Datei","table_size": "Größe (MB)","table_action": "Aktion","status_done": "Fertig.",
            "status_packing": "{} wird erstellt...","msg_no_files": "Keine unterstützten Audiodateien gefunden.",
            "msg_finished": "{} ZIP-Dateien erfolgreich erstellt.","msg_testdata_done": "{} Dummy-Dateien erstellt in:\n{}",
            "split_mono": "Mono-Split","split_zip": "Split-ZIP","normal": "Normal",
            "max_size_label": "Max. ZIP-Größe (MB):","max_size_tooltip": "Zielgröße pro ZIP-Archiv festlegen.",
            "msg_invalid_max_size": "Bitte einen Wert größer als 0 und höchstens {} MB eingeben. Zurücksetzen auf {} MB."},
    "fr": {"app_title": "Stem ZIPper","select_folder": "Sélectionner le dossier","now_packing": "Compression...","ready": "Prêt",
            "create_testdata": "Créer des données de test (DEV)","exit": "Quitter","found_files": "{} fichiers trouvés.",
            "pack_now": "Compresser maintenant","choose_folder": "Choisir un dossier","header_label": "Sélectionnez ou déposez un dossier :",
            "table_file": "Fichier","table_size": "Taille (Mo)","table_action": "Action","status_done": "Terminé.",
            "status_packing": "Création de {}...","msg_no_files": "Aucun fichier audio trouvé.",
            "msg_finished": "{} fichiers ZIP créés avec succès.","msg_testdata_done": "{} fichiers factices créés dans :\n{}",
            "split_mono": "Diviser Mono","split_zip": "ZIP fractionné","normal": "Normal",
            "max_size_label": "Taille ZIP max. (Mo) :","max_size_tooltip": "Définissez la taille cible par archive ZIP.",
            "msg_invalid_max_size": "Veuillez saisir une valeur supérieure à 0 et jusqu'à {} Mo. Réinitialisation à {} Mo."},
    "it": {"app_title": "Stem ZIPper","select_folder": "Seleziona cartella","now_packing": "Compressione...","ready": "Pronto",
            "create_testdata": "Crea dati di test (DEV)","exit": "Esci","found_files": "{} file trovati.",
            "pack_now": "Comprimi ora","choose_folder": "Scegli cartella","header_label": "Seleziona o trascina una cartella:",
            "table_file": "File","table_size": "Dimensione (MB)","table_action": "Azione","status_done": "Fatto.",
            "status_packing": "Creazione di {}...","msg_no_files": "Nessun file audio trovato.",
            "msg_finished": "{} file ZIP creati con successo.","msg_testdata_done": "{} file fittizi creati in:\n{}",
            "split_mono": "Dividi Mono","split_zip": "Dividi ZIP","normal": "Normale",
            "max_size_label": "Dimensione ZIP max (MB):","max_size_tooltip": "Imposta la dimensione target per archivio ZIP.",
            "msg_invalid_max_size": "Inserisci un valore maggiore di 0 e al massimo {} MB. Ripristino a {} MB."},
    "es": {"app_title": "Stem ZIPper","select_folder": "Seleccionar carpeta","now_packing": "Empaquetando...","ready": "Listo",
            "create_testdata": "Crear datos de prueba (DEV)","exit": "Salir","found_files": "{} archivos encontrados.",
            "pack_now": "Empaquetar ahora","choose_folder": "Elegir carpeta","header_label": "Seleccionar o arrastrar una carpeta:",
            "table_file": "Archivo","table_size": "Tamaño (MB)","table_action": "Acción","status_done": "Hecho.",
            "status_packing": "Creando {}...","msg_no_files": "No se encontraron archivos de audio.",
            "msg_finished": "{} archivos ZIP creados.","msg_testdata_done": "{} archivos falsos creados en:\n{}",
            "split_mono": "Dividir Mono","split_zip": "Dividir ZIP","normal": "Normal",
            "max_size_label": "Tamaño máx. ZIP (MB):","max_size_tooltip": "Ajusta el tamaño objetivo por archivo ZIP.",
            "msg_invalid_max_size": "Introduce un valor mayor que 0 y de hasta {} MB. Restableciendo a {} MB."},
    "pt": {"app_title": "Stem ZIPper","select_folder": "Selecionar pasta","now_packing": "Compactando...","ready": "Pronto",
            "create_testdata": "Criar dados de teste (DEV)","exit": "Sair","found_files": "{} arquivos encontrados.",
            "pack_now": "Compactar agora","choose_folder": "Escolher pasta","header_label": "Selecione ou arraste uma pasta:",
            "table_file": "Arquivo","table_size": "Tamanho (MB)","table_action": "Ação","status_done": "Concluído.",
            "status_packing": "Criando {}...","msg_no_files": "Nenhum arquivo de áudio encontrado.",
            "msg_finished": "{} arquivos ZIP criados.","msg_testdata_done": "{} arquivos falsos criados em:\n{}",
            "split_mono": "Dividir Mono","split_zip": "Dividir ZIP","normal": "Normal",
            "max_size_label": "Tamanho máx. ZIP (MB):","max_size_tooltip": "Ajuste o tamanho alvo por arquivo ZIP.",
            "msg_invalid_max_size": "Insira um valor maior que 0 e de até {} MB. Redefinindo para {} MB."},
}

try:
    user_lang = (locale.getdefaultlocale() or ("en",))[0][:2].lower()
except Exception:
    user_lang = "en"
LANG = LANGS.get(user_lang, LANGS["en"])

def _(key): return LANG.get(key, key)

# ============================================================
# STAMP TEXT
# ============================================================
VERSION = "0.8"
STEM_ZIPPER_LOGO = f"""
░█▀▀░▀█▀░█▀▀░█▄█░░░▀▀█░▀█▀░█▀█░█▀█░█▀▀░█▀▄░
░▀▀█░░█░░█▀▀░█░█░░░▄▀░░░█░░█▀▀░█▀▀░█▀▀░█▀▄░
░▀▀▀░░▀░░▀▀▀░▀░▀░░░▀▀▀░▀▀▀░▀░░░▀░░░▀▀▀░▀░▀░ v{VERSION}"""
STEM_ZIPPER_STAMP = f"""{STEM_ZIPPER_LOGO}

Packed with Stem ZIPper v{VERSION}

Get it here: https://github.com/rewired/stem-zipper
It's free and open source!"""
STAMP_FILENAME = "_stem-zipper.txt"

# ============================================================
# CORE LOGIC
# ============================================================
DEFAULT_MAX_SIZE_MB = 48  # default size limit per ZIP file (kept below common 50 MB upload limits)
MAX_SIZE_LIMIT_MB = 500   # hard upper bound to keep archive sizes practical
SUPPORTED_EXTENSIONS = ('.wav', '.flac', '.mp3', '.aiff', '.ogg', '.aac', '.wma')

def split_stereo_wav(filepath):
    try:
        with wave.open(filepath, 'rb') as s:
            if s.getnchannels() != 2:
                return [filepath]
            sw, fr, nf = s.getsampwidth(), s.getframerate(), s.getnframes()
            f = s.readframes(nf)
            l, r = bytearray(), bytearray()
            for i in range(0, len(f), sw*2):
                l += f[i:i+sw]
                r += f[i+sw:i+2*sw]
            base, ext = os.path.splitext(filepath)
            lp, rp = f"{base}_L{ext}", f"{base}_R{ext}"
            for p, d in [(lp, l), (rp, r)]:
                with wave.open(p, 'wb') as c:
                    c.setnchannels(1)
                    c.setsampwidth(sw)
                    c.setframerate(fr)
                    c.writeframes(d)
            os.remove(filepath)
            return [lp, rp]
    except Exception:
        return [filepath]

class Tooltip:
    def __init__(self, widget, text):
        self.widget = widget
        self.text = text
        self.tipwindow = None
        widget.bind("<Enter>", self.show_tip)
        widget.bind("<Leave>", self.hide_tip)

    def show_tip(self, _event=None):
        if self.tipwindow or not self.text:
            return
        x = self.widget.winfo_rootx() + 20
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 10
        self.tipwindow = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)
        tw.wm_geometry(f"+{x}+{y}")
        tw.wm_attributes("-topmost", True)
        label = tk.Label(tw, text=self.text, background="#111827", foreground="#f9fafb",
                         relief="solid", borderwidth=1, padx=8, pady=4, font=("Segoe UI", 9))
        label.pack()

    def hide_tip(self, _event=None):
        if self.tipwindow:
            self.tipwindow.destroy()
            self.tipwindow = None


def create_zip(name, files, outdir):
    zp = os.path.join(outdir, f"{name}.zip")
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in files:
            z.write(f, arcname=os.path.basename(f))
        z.writestr(STAMP_FILENAME, STEM_ZIPPER_STAMP)
    return zp

def best_fit_pack(files, max_size_bytes):
    files.sort(key=lambda x: x[1], reverse=True)
    bins=[]
    for p,s in files:
        best=None; minr=max_size_bytes+1
        for b in bins:
            r=max_size_bytes-sum(f[1] for f in b)
            if s<=r<minr:
                best,minr=b,r
        if not best:
            bins.append([(p,s)])
        else:
            best.append((p,s))
    return bins

def create_dummy_file(path, mb):
    b=int(mb*1024*1024)
    with open(path,"wb") as f:
        f.write(b"FAKEAUDIO")
        if b > 9:
            f.write(os.urandom(b-9))

def create_test_files(out, n=20, min_s=2, max_s=20):
    os.makedirs(out, exist_ok=True)
    for i in range(1,n+1):
        ext=random.choice(SUPPORTED_EXTENSIONS)
        sz=round(random.uniform(min_s,max_s),2)
        p=os.path.join(out,f"testfile_{i:03}{ext}")
        create_dummy_file(p,sz)
    messagebox.showinfo(_("app_title"), _("msg_testdata_done").format(n,out))

def analyze_folder(path, max_size_bytes):
    fl=[]
    for f in os.listdir(path):
        e=os.path.splitext(f)[1].lower()
        if e not in SUPPORTED_EXTENSIONS:
            continue
        fp=os.path.join(path,f); sz=os.path.getsize(fp)
        act=_("normal")
        if sz>max_size_bytes:
            act=_("split_mono") if e==".wav" else _("split_zip")
        fl.append((f, round(sz/1048576,2), act))
    return fl

def process_folder(folder, label, bar, max_size_bytes):
    allf=[os.path.join(folder,f) for f in os.listdir(folder)
          if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS]
    if not allf:
        messagebox.showwarning(_("app_title"), _("msg_no_files")); return
    expanded=[]
    for f in allf:
        s=os.path.getsize(f)
        if s>max_size_bytes and f.lower().endswith(".wav"):
            for nf in split_stereo_wav(f):
                expanded.append((nf, os.path.getsize(nf)))
        else:
            expanded.append((f,s))
    groups=best_fit_pack(expanded, max_size_bytes)
    total=len(groups); bar["maximum"]=total
    for i,g in enumerate(groups,1):
        zn=f"stems-{i:02}"
        create_zip(zn,[f for f,_ in g],folder)
        bar["value"]=i
        percent=int(i/total*100)
        label.config(text=_("status_packing").format(zn)+f" ({percent}%)")
        label.update_idletasks()
        bar.update_idletasks()
    messagebox.showinfo(_("app_title"), _("msg_finished").format(total))
    label.config(text=_("status_done")); bar["value"]=0
    bar.update_idletasks()

# ============================================================
# MODERN GUI (kind of)
# ============================================================
class StemZipperGUI:
    def __init__(self, dev=False):
        self.dev=dev; self.folder=None
        self.root=tk.Tk()
        self.root.title(_("app_title"))
        self.root.geometry("850x650")
        self.root.configure(bg="#f5f6f8"); self.root.resizable(False,False)
        self.max_size_var=tk.DoubleVar(value=DEFAULT_MAX_SIZE_MB)

        s=ttk.Style()
        s.theme_use("clam")
        base=("Segoe UI",10)
        s.configure("TFrame",background="#f5f6f8")
        s.configure("TLabel",background="#f5f6f8",font=base)
        s.configure("TButton",font=base,foreground="#fff",padding=6,background="#2563eb")
        s.map("TButton",background=[("active","#3b82f6")])
        s.configure("Treeview",font=base,background="#fff",rowheight=26,fieldbackground="#fff")
        s.configure("Treeview.Heading",font=("Segoe UI Semibold",10),background="#f3f4f6")
        s.configure("Horizontal.TProgressbar",troughcolor="#e5e7eb",background="#3b82f6")

        # Header
        h=ttk.Frame(self.root,padding=(20,15,20,5)); h.pack(fill="x")
        ttk.Label(h,text="🎧 "+_("app_title"),font=("Segoe UI Semibold",14)).pack(anchor="w",pady=(0,5))
        ttk.Label(h,text=_("header_label")).pack(side="left",padx=(0,10))
        ttk.Button(h,text=_("select_folder"),command=self.select_folder).pack(side="left")
        ttk.Label(h,text=_("max_size_label")).pack(side="left",padx=(20,5))
        self.max_size_spin=ttk.Spinbox(h,from_=1,to=MAX_SIZE_LIMIT_MB,textvariable=self.max_size_var,
                                      width=7,justify="right",increment=1)
        self.max_size_spin.pack(side="left")
        self.max_size_spin.bind("<FocusOut>", lambda _e: self._ensure_valid_max_size())
        self.max_size_spin.bind("<Return>", lambda _e: self._ensure_valid_max_size())
        Tooltip(self.max_size_spin, _("max_size_tooltip"))

        # Table
        t=ttk.Frame(self.root,padding=(20,10,20,10)); t.pack(fill="both",expand=True)
        cols=("name","size","action")
        self.tree=ttk.Treeview(t,columns=cols,show="headings",height=15)
        self.tree.heading("name",text=_("table_file"))
        self.tree.heading("size",text=_("table_size"))
        self.tree.heading("action",text=_("table_action"))
        self.tree.column("name",width=500,anchor="w")
        self.tree.column("size",width=120,anchor="center")
        self.tree.column("action",width=150,anchor="center")
        self.tree.tag_configure("evenrow",background="#f9fafb")
        self.tree.tag_configure("oddrow",background="#fff")
        sb=ttk.Scrollbar(t,orient="vertical",command=self.tree.yview)
        self.tree.configure(yscroll=sb.set)
        self.tree.grid(row=0,column=0,sticky="nsew"); sb.grid(row=0,column=1,sticky="ns")
        t.grid_columnconfigure(0,weight=1)

        # Status
        st=ttk.Frame(self.root,padding=(20,5)); st.pack(fill="x")
        self.bar=ttk.Progressbar(st,length=600,mode="determinate")
        self.bar.pack(side="left",padx=(0,10),fill="x",expand=True)
        self.label=ttk.Label(st,text=_("ready")); self.label.pack(side="left")

        # Buttons
        bf=ttk.Frame(self.root,padding=(20,10)); bf.pack(fill="x")
        self.start=ttk.Button(bf,text=_("pack_now"),command=self.start_pack,state="disabled"); self.start.pack(side="left",padx=(0,10))
        if self.dev: ttk.Button(bf,text=_("create_testdata"),command=self.create_testdata).pack(side="left")
        ttk.Button(bf,text=_("exit"),command=self.root.destroy).pack(side="right")
        self.root.mainloop()

    def select_folder(self):
        f=filedialog.askdirectory(title=_("choose_folder"))
        if not f:
            return
        self.folder=f
        self.populate()

    def populate(self):
        for i in self.tree.get_children(): self.tree.delete(i)
        max_size_bytes=self._get_max_size_bytes()
        files=analyze_folder(self.folder,max_size_bytes)
        for i,(n,s,a) in enumerate(files):
            tag="evenrow" if i%2==0 else "oddrow"
            self.tree.insert("", "end", values=(n,s,a), tags=(tag,))
        self.label.config(text=_("found_files").format(len(files)))
        if files: self.start["state"]="normal"
        else: self.start["state"]="disabled"

    def start_pack(self):
        max_size_bytes=self._get_max_size_bytes()
        process_folder(self.folder,self.label,self.bar,max_size_bytes)

    def _get_max_size_bytes(self):
        max_size_mb=self._ensure_valid_max_size()
        return int(max_size_mb * 1024 * 1024)

    def _ensure_valid_max_size(self):
        reset_value=None
        try:
            value=float(self.max_size_var.get())
        except (tk.TclError, ValueError, TypeError):
            reset_value=DEFAULT_MAX_SIZE_MB
        else:
            if value<=0:
                reset_value=DEFAULT_MAX_SIZE_MB
            elif value>MAX_SIZE_LIMIT_MB:
                reset_value=MAX_SIZE_LIMIT_MB
        if reset_value is not None:
            messagebox.showwarning(_("app_title"), _("msg_invalid_max_size").format(MAX_SIZE_LIMIT_MB, reset_value))
            self.max_size_var.set(reset_value)
            return reset_value
        return value

    def create_testdata(self):
        f=filedialog.askdirectory(title=_("choose_folder"))
        if f:
            create_test_files(f)

# ============================================================
def main():
    parser = argparse.ArgumentParser(
        description=STEM_ZIPPER_LOGO,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--dev", action="store_true", help="Enable developer mode (test data button)")
    supported_languages = ", ".join(LANGS)
    parser.add_argument("--lang", type=str, help=f"Force specific language (currently supported: {supported_languages})")
    args = parser.parse_args()

    # Sprache setzen
    if args.lang and args.lang.lower() in LANGS:
        lang_code = args.lang.lower()
    else:
        try:
            lang_code = (locale.getdefaultlocale() or ("en",))[0][:2].lower()
        except Exception:
            lang_code = "en"

    global LANG
    LANG = LANGS.get(lang_code, LANGS["en"])

    StemZipperGUI(dev=args.dev)

if __name__=="__main__":
    main()
