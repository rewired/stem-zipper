export const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'it', 'es', 'pt'] as const;
export type LocaleKey = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: LocaleKey = 'en';

export const translations = {
  en: {
    app_title: 'Stem ZIPper',
    about: 'Info',
    close: 'Close',
    about_text: 'Stem ZIPper version {version}. Manage and package your audio stems with ease.',
    select_folder: 'Select Folder',
    header_label: 'Select or drop a folder:',
    max_size_label: 'Max ZIP size (MB):',
    max_size_tooltip: 'Set the target size per ZIP archive.',
    table_file: 'File',
    table_size: 'Size (MB)',
    table_action: 'Action',
    ready: 'Ready',
    found_files: '{count} files found.',
    pack_now: 'Pack Now',
    status_packing: 'Creating {name}...',
    status_done: 'Done.',
    status_packing_percent: 'Creating {name}... ({percent}%)',
    msg_no_files: 'No supported audio files found.',
    msg_finished: '{count} ZIP files created successfully.',
    msg_invalid_max_size: 'Please enter a value greater than 0 and up to {max} MB. Resetting to {reset} MB.',
    choose_folder: 'Choose Folder',
    create_testdata: 'Create Test Data (DEV)',
    exit: 'Exit',
    split_mono: 'Split Mono',
    split_zip: 'Split ZIP',
    normal: 'Normal',
    drop_helper: 'Drop a folder anywhere in the window',
    dev_label: 'Developer Mode',
    now_packing: 'Packing...',
    select_hint: 'Drop or select a folder to begin',
    pack_disabled: 'Pick a folder to enable packing',
    create_testdata_done: '{count} dummy files created in\n{folder}',
    error_title: 'Something went wrong',
    browse: 'Browse',
    testdata_dev_only: 'Test data generation is only available in developer mode.'
  },
  de: {
    app_title: 'Stem ZIPper',
    about: 'Info',
    close: 'Schließen',
    about_text: 'Stem ZIPper Version {version}. Verwalten und packen Sie Ihre Audio-Stems mühelos.',
    select_folder: 'Ordner auswählen',
    header_label: 'Ordner auswählen oder hineinziehen:',
    max_size_label: 'Max. ZIP-Größe (MB):',
    max_size_tooltip: 'Zielgröße pro ZIP-Archiv festlegen.',
    table_file: 'Datei',
    table_size: 'Größe (MB)',
    table_action: 'Aktion',
    ready: 'Bereit',
    found_files: '{count} Dateien gefunden.',
    pack_now: 'Jetzt packen',
    status_packing: '{name} wird erstellt...',
    status_done: 'Fertig.',
    status_packing_percent: '{name} wird erstellt... ({percent}%)',
    msg_no_files: 'Keine unterstützten Audiodateien gefunden.',
    msg_finished: '{count} ZIP-Dateien erfolgreich erstellt.',
    msg_invalid_max_size: 'Bitte einen Wert größer als 0 und höchstens {max} MB eingeben. Zurücksetzen auf {reset} MB.',
    choose_folder: 'Ordner wählen',
    create_testdata: 'Testdaten erstellen (DEV)',
    exit: 'Beenden',
    split_mono: 'Mono-Split',
    split_zip: 'Split-ZIP',
    normal: 'Normal',
    drop_helper: 'Ordner irgendwo im Fenster ablegen',
    dev_label: 'Entwicklermodus',
    now_packing: 'Wird gepackt...',
    select_hint: 'Ordner ziehen oder auswählen, um zu starten',
    pack_disabled: 'Ordner wählen, um Packen zu aktivieren',
    create_testdata_done: '{count} Dummy-Dateien erstellt in\n{folder}',
    error_title: 'Es ist ein Fehler aufgetreten',
    browse: 'Durchsuchen',
    testdata_dev_only: 'Das Erstellen von Testdaten ist nur im Entwicklermodus verfügbar.'
  },
  fr: {
    app_title: 'Stem ZIPper',
    about: 'Info',
    close: 'Fermer',
    about_text: 'Stem ZIPper version {version}. Gérez et archivez vos stems audio en toute simplicité.',
    select_folder: 'Sélectionner le dossier',
    header_label: 'Sélectionnez ou déposez un dossier :',
    max_size_label: 'Taille ZIP max. (Mo) :',
    max_size_tooltip: 'Définissez la taille cible par archive ZIP.',
    table_file: 'Fichier',
    table_size: 'Taille (Mo)',
    table_action: 'Action',
    ready: 'Prêt',
    found_files: '{count} fichiers trouvés.',
    pack_now: 'Compresser maintenant',
    status_packing: 'Création de {name}...',
    status_done: 'Terminé.',
    status_packing_percent: 'Création de {name}... ({percent} %)',
    msg_no_files: 'Aucun fichier audio trouvé.',
    msg_finished: '{count} fichiers ZIP créés avec succès.',
    msg_invalid_max_size: 'Veuillez saisir une valeur supérieure à 0 et jusqu’à {max} Mo. Réinitialisation à {reset} Mo.',
    choose_folder: 'Choisir un dossier',
    create_testdata: 'Créer des données de test (DEV)',
    exit: 'Quitter',
    split_mono: 'Diviser Mono',
    split_zip: 'ZIP fractionné',
    normal: 'Normal',
    drop_helper: 'Déposez un dossier n’importe où dans la fenêtre',
    dev_label: 'Mode développeur',
    now_packing: 'Compression...',
    select_hint: 'Déposez ou sélectionnez un dossier pour démarrer',
    pack_disabled: 'Choisissez un dossier pour activer la compression',
    create_testdata_done: '{count} fichiers factices créés dans\n{folder}',
    error_title: 'Une erreur est survenue',
    browse: 'Parcourir',
    testdata_dev_only: 'La génération de données de test est uniquement disponible en mode développeur.'
  },
  it: {
    app_title: 'Stem ZIPper',
    about: 'Info',
    close: 'Chiudi',
    about_text: 'Stem ZIPper versione {version}. Gestisci e comprimi i tuoi stem audio con facilità.',
    select_folder: 'Seleziona cartella',
    header_label: 'Seleziona o trascina una cartella:',
    max_size_label: 'Dimensione ZIP max (MB):',
    max_size_tooltip: 'Imposta la dimensione target per archivio ZIP.',
    table_file: 'File',
    table_size: 'Dimensione (MB)',
    table_action: 'Azione',
    ready: 'Pronto',
    found_files: '{count} file trovati.',
    pack_now: 'Comprimi ora',
    status_packing: 'Creazione di {name}...',
    status_done: 'Fatto.',
    status_packing_percent: 'Creazione di {name}... ({percent}%)',
    msg_no_files: 'Nessun file audio trovato.',
    msg_finished: '{count} file ZIP creati con successo.',
    msg_invalid_max_size: 'Inserisci un valore maggiore di 0 e al massimo {max} MB. Ripristino a {reset} MB.',
    choose_folder: 'Scegli cartella',
    create_testdata: 'Crea dati di test (DEV)',
    exit: 'Esci',
    split_mono: 'Dividi Mono',
    split_zip: 'Dividi ZIP',
    normal: 'Normale',
    drop_helper: 'Rilascia una cartella ovunque nella finestra',
    dev_label: 'Modalità sviluppatore',
    now_packing: 'Compressione...',
    select_hint: 'Trascina o seleziona una cartella per iniziare',
    pack_disabled: 'Scegli una cartella per attivare la compressione',
    create_testdata_done: '{count} file fittizi creati in\n{folder}',
    error_title: 'Si è verificato un errore',
    browse: 'Sfoglia',
    testdata_dev_only: 'La generazione di dati di test è disponibile solo in modalità sviluppatore.'
  },
  es: {
    app_title: 'Stem ZIPper',
    about: 'Info',
    close: 'Cerrar',
    about_text: 'Stem ZIPper versión {version}. Gestiona y empaqueta tus stems de audio con facilidad.',
    select_folder: 'Seleccionar carpeta',
    header_label: 'Seleccionar o arrastrar una carpeta:',
    max_size_label: 'Tamaño máx. ZIP (MB):',
    max_size_tooltip: 'Ajusta el tamaño objetivo por archivo ZIP.',
    table_file: 'Archivo',
    table_size: 'Tamaño (MB)',
    table_action: 'Acción',
    ready: 'Listo',
    found_files: '{count} archivos encontrados.',
    pack_now: 'Empaquetar ahora',
    status_packing: 'Creando {name}...',
    status_done: 'Hecho.',
    status_packing_percent: 'Creando {name}... ({percent} %)',
    msg_no_files: 'No se encontraron archivos de audio.',
    msg_finished: '{count} archivos ZIP creados.',
    msg_invalid_max_size: 'Introduce un valor mayor que 0 y de hasta {max} MB. Restableciendo a {reset} MB.',
    choose_folder: 'Elegir carpeta',
    create_testdata: 'Crear datos de prueba (DEV)',
    exit: 'Salir',
    split_mono: 'Dividir Mono',
    split_zip: 'Dividir ZIP',
    normal: 'Normal',
    drop_helper: 'Suelta una carpeta en cualquier parte de la ventana',
    dev_label: 'Modo desarrollador',
    now_packing: 'Empaquetando...',
    select_hint: 'Suelta o selecciona una carpeta para empezar',
    pack_disabled: 'Elige una carpeta para habilitar el empaquetado',
    create_testdata_done: '{count} archivos falsos creados en\n{folder}',
    error_title: 'Algo salió mal',
    browse: 'Examinar',
    testdata_dev_only: 'La generación de datos de prueba solo está disponible en modo desarrollador.'
  },
  pt: {
    app_title: 'Stem ZIPper',
    about: 'Info',
    close: 'Fechar',
    about_text: 'Stem ZIPper versão {version}. Gerencie e compacte seus stems de áudio com facilidade.',
    select_folder: 'Selecionar pasta',
    header_label: 'Selecione ou arraste uma pasta:',
    max_size_label: 'Tamanho máx. ZIP (MB):',
    max_size_tooltip: 'Ajuste o tamanho alvo por arquivo ZIP.',
    table_file: 'Arquivo',
    table_size: 'Tamanho (MB)',
    table_action: 'Ação',
    ready: 'Pronto',
    found_files: '{count} arquivos encontrados.',
    pack_now: 'Compactar agora',
    status_packing: 'Criando {name}...',
    status_done: 'Concluído.',
    status_packing_percent: 'Criando {name}... ({percent}%)',
    msg_no_files: 'Nenhum arquivo de áudio encontrado.',
    msg_finished: '{count} arquivos ZIP criados.',
    msg_invalid_max_size: 'Insira um valor maior que 0 e de até {max} MB. Redefinindo para {reset} MB.',
    choose_folder: 'Escolher pasta',
    create_testdata: 'Criar dados de teste (DEV)',
    exit: 'Sair',
    split_mono: 'Dividir Mono',
    split_zip: 'Dividir ZIP',
    normal: 'Normal',
    drop_helper: 'Solte uma pasta em qualquer lugar da janela',
    dev_label: 'Modo desenvolvedor',
    now_packing: 'Compactando...',
    select_hint: 'Solte ou selecione uma pasta para começar',
    pack_disabled: 'Escolha uma pasta para habilitar a compactação',
    create_testdata_done: '{count} arquivos falsos criados em\n{folder}',
    error_title: 'Algo deu errado',
    browse: 'Procurar',
    testdata_dev_only: 'A geração de dados de teste está disponível apenas no modo desenvolvedor.'
  }
} as const;

type TranslationMap = (typeof translations)[LocaleKey];

export type TranslationKey = keyof TranslationMap;

function matchLocale(locale: string | null | undefined): LocaleKey | undefined {
  if (!locale) {
    return undefined;
  }
  const normalized = locale.toLowerCase();
  if (normalized in translations) {
    return normalized as LocaleKey;
  }
  const short = normalized.slice(0, 2);
  if (short in translations) {
    return short as LocaleKey;
  }
  return undefined;
}

export function resolveLocale(
  ...candidates: Array<string | null | undefined | readonly string[]>
): LocaleKey {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      const match = matchLocale(candidate);
      if (match) {
        return match;
      }
      continue;
    }
    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        const match = matchLocale(entry);
        if (match) {
          return match;
        }
      }
      continue;
    }
  }
  return DEFAULT_LOCALE;
}

export function formatMessage(
  locale: LocaleKey,
  key: TranslationKey,
  params: Record<string, string | number> = {}
): string {
  const template = translations[locale]?.[key] ?? translations[DEFAULT_LOCALE][key];
  return Object.keys(params).reduce((message, paramKey) => {
    return message.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(params[paramKey]));
  }, template);
}
