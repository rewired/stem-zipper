import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent
} from 'react';
import type { FileEntry, PackMetadata, PackProgress, PackState } from '@common/ipc';
import { DEFAULT_MAX_SIZE_MB, MAX_SIZE_LIMIT_MB } from '@common/constants';
import { ensureValidMaxSize } from '@common/validation';
import { Header } from './components/Header';
import { FileTable } from './components/FileTable';
import { ProgressPanel } from './components/ProgressPanel';
import { ActionBar } from './components/ActionBar';
import { formatMessage, resolveLocale, type LocaleKey, type TranslationKey } from '@common/i18n';
import { InfoModal } from './components/InfoModal';
import { APP_VERSION } from '@common/version';
import { DiagOverlay } from './components/DiagOverlay';
import { ChoiceModal } from './components/ChoiceModal';
import { useToast } from './components/ui/ToastProvider';
import { MetadataModal } from './components/MetadataModal';
import {
  buildPackMetadata,
  createEmptyDraft,
  hasRequiredMetadata,
  mergeDraftData,
  updateAutoAttribution,
  type MetadataDraftData,
  type MetadataDraftState
} from './state/metadataStore';

const initialProgress: PackProgress = {
  state: 'idle',
  current: 0,
  total: 0,
  percent: 0,
  message: 'pack_status_ready'
};

function dedupeRecentArtists(values: readonly string[], max = 5): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
    if (result.length >= max) {
      break;
    }
  }
  return result;
}

function detectInitialLocale(): LocaleKey {
  const languages = Array.isArray(navigator.languages) ? navigator.languages : [];
  const runtime = (window as unknown as { runtimeConfig?: { locale?: string } }).runtimeConfig;
  return resolveLocale(runtime?.locale, languages, navigator.language);
}

export default function App() {
  const [locale] = useState<LocaleKey>(() => detectInitialLocale());
  const [maxSize, setMaxSize] = useState<number | ''>(DEFAULT_MAX_SIZE_MB);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [progress, setProgress] = useState<PackProgress>(initialProgress);
  const [statusText, setStatusText] = useState(() => formatMessage(locale, 'pack_status_ready'));
  const [isPacking, setIsPacking] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isRevealOpen, setIsRevealOpen] = useState(false);
  const [lastPackCount, setLastPackCount] = useState(0);
  const [isOverwriteOpen, setIsOverwriteOpen] = useState(false);
  const [isOverwriteWarnOpen, setIsOverwriteWarnOpen] = useState(false);
  const [pendingAnalyze, setPendingAnalyze] = useState<{ path: string; max: number } | null>(null);
  const [metadataDrafts, setMetadataDrafts] = useState<Record<string, MetadataDraftState>>({});
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [metadataIntent, setMetadataIntent] = useState<'idle' | 'pack'>('idle');
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [userPrefs, setUserPrefs] = useState<{
    defaultArtist?: string;
    defaultArtistUrl?: string;
    defaultContactEmail?: string;
    recentArtists: string[];
  }>(() => ({
    defaultArtist: undefined,
    defaultArtistUrl: undefined,
    defaultContactEmail: undefined,
    recentArtists: []
  }));
  const ensureMetadataDraft = useCallback((folder: string) => {
    setMetadataDrafts((prev) => {
      if (prev[folder]) {
        return prev;
      }
      return { ...prev, [folder]: createEmptyDraft() };
    });
  }, []);

  const updateMetadataDraft = useCallback(
    (folder: string, updater: (draft: MetadataDraftState) => MetadataDraftState) => {
      setMetadataDrafts((prev) => {
        const current = prev[folder] ?? createEmptyDraft();
        const updated = updater(current);
        if (updated === current) {
          if (!prev[folder]) {
            return { ...prev, [folder]: current };
          }
          return prev;
        }
        return { ...prev, [folder]: updated };
      });
    },
    []
  );
  const { show: showToast, dismiss: dismissToast } = useToast();
  const estimateTimeoutRef = useRef<number | null>(null);
  const estimateRequestTokenRef = useRef(0);
  const estimatorErrorLoggedRef = useRef(false);
  const progressStateRef = useRef<PackState>(initialProgress.state);
  const skipEstimateRef = useRef(false);

  const t = useCallback(
    (key: TranslationKey, params: Record<string, string | number> = {}) =>
      formatMessage(locale, key, params),
    [locale]
  );

  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.getUserPrefs !== 'function') {
      return;
    }
    window.electronAPI
      .getUserPrefs({})
      .then((prefs) => {
        setUserPrefs({
          defaultArtist: prefs?.default_artist?.trim() || undefined,
          defaultArtistUrl: prefs?.default_artist_url?.trim() || undefined,
          defaultContactEmail: prefs?.default_contact_email?.trim() || undefined,
          recentArtists: dedupeRecentArtists(prefs?.recent_artists ?? [])
        });
      })
      .catch((error) => {
        console.warn('Failed to load user preferences', error);
      });
  }, []);

  const handleMetadataChange = useCallback(
    (updates: Partial<MetadataDraftData>) => {
      if (!folderPath) {
        return;
      }
      updateMetadataDraft(folderPath, (draft) => mergeDraftData(draft, updates));
    },
    [folderPath, updateMetadataDraft]
  );

  const handleRememberDefaultChange = useCallback(
    (remember: boolean) => {
      if (!folderPath) {
        return;
      }
      updateMetadataDraft(folderPath, (draft) => ({ ...draft, rememberDefault: remember }));
    },
    [folderPath, updateMetadataDraft]
  );

  const handleAutoAttributionChange = useCallback(
    (value: string | undefined) => {
      if (!folderPath) {
        return;
      }
      updateMetadataDraft(folderPath, (draft) => updateAutoAttribution(draft, value));
    },
    [folderPath, updateMetadataDraft]
  );

  const handleOpenMetadata = useCallback(
    (intent: 'idle' | 'pack' = 'idle') => {
      if (!folderPath) {
        return;
      }
      ensureMetadataDraft(folderPath);
      setMetadataIntent(intent);
      setIsMetadataOpen(true);
      updateMetadataDraft(folderPath, (draft) => ({ ...draft, everOpened: true }));
    },
    [ensureMetadataDraft, folderPath, updateMetadataDraft]
  );

  const actionNames = useMemo(
    () => ({
      normal: t('pack_option_normal'),
      split_mono: t('pack_option_split_mono'),
      split_zip: t('pack_option_split_zip')
    }),
    [t]
  );

  const formatSize = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return (value: number) => formatter.format(value);
  }, [locale]);

  useEffect(() => {
    document.title = `${formatMessage(locale, 'app_title')} ${APP_VERSION}`;
  }, [locale]);

  const resetProgress = () => {
    setProgress(initialProgress);
    progressStateRef.current = initialProgress.state;
  };

  const analyze = useCallback(
    async (targetFolder: string, currentMaxSize: number) => {
      try {
        const response = await window.electronAPI.analyzeFolder(targetFolder, currentMaxSize, locale);
        setFiles(response.files);
        setFolderPath(targetFolder);
        ensureMetadataDraft(targetFolder);
        if (response.maxSizeMb !== currentMaxSize) {
          setMaxSize(response.maxSizeMb);
          setStatusText(
            t('pack_error_invalid_max_size', { max: MAX_SIZE_LIMIT_MB, reset: response.maxSizeMb })
          );
        } else {
          setStatusText(
            response.count > 0
              ? t('pack_status_found_files', { count: response.count })
              : t('pack_status_no_files')
          );
        }
      } catch (error) {
        console.error(error);
        setStatusText(`${t('common_error_title')}: ${(error as Error).message}`);
      }
    },
    [ensureMetadataDraft, locale, t]
  );

  const handleFolderSelection = useCallback(
    async (selectedPath: string | null) => {
      if (!selectedPath) {
        return;
      }
      resetProgress();
      const numericMax = typeof maxSize === 'number' ? maxSize : DEFAULT_MAX_SIZE_MB;
      try {
        if (window.electronAPI && typeof window.electronAPI.checkExistingZips === 'function') {
          const res = await window.electronAPI.checkExistingZips(selectedPath);
          if (res && res.count > 0) {
            setPendingAnalyze({ path: selectedPath, max: numericMax });
            setIsOverwriteWarnOpen(true);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to check existing ZIPs before analyze', e);
      }
      await analyze(selectedPath, numericMax);
    },
    [analyze, maxSize]
  );

  const handleSelectFolder = async () => {
    if (!window.electronAPI || typeof window.electronAPI.selectFolder !== 'function') {
      setStatusText(t('common_error_title'));
      return;
    }
    const selected = await window.electronAPI.selectFolder();
    await handleFolderSelection(selected);
  };

  const handleMaxSizeBlur = async () => {
    const numericValue = typeof maxSize === 'number' ? maxSize : DEFAULT_MAX_SIZE_MB;
    const sanitized = ensureValidMaxSize(numericValue);
    if (sanitized !== numericValue) {
      setMaxSize(sanitized);
      setStatusText(t('pack_error_invalid_max_size', { max: MAX_SIZE_LIMIT_MB, reset: sanitized }));
    }
    if (folderPath) {
      await analyze(folderPath, sanitized);
    }
  };

  const performPack = useCallback(async () => {
    if (!folderPath || typeof maxSize !== 'number') {
      setStatusText(t('pack_error_disabled'));
      return;
    }
    const metadataDraft = folderPath ? metadataDrafts[folderPath] : undefined;
    if (!metadataDraft || !hasRequiredMetadata(metadataDraft.data)) {
      setStatusText(t('btn_pack_disabled_missing_required'));
      handleOpenMetadata('pack');
      return;
    }
    let packMetadata;
    try {
      packMetadata = buildPackMetadata(metadataDraft.data);
    } catch (error) {
      console.warn('Failed to build pack metadata before packing', error);
      setStatusText(t('btn_pack_disabled_missing_required'));
      handleOpenMetadata('pack');
      return;
    }
    if (!window.electronAPI || typeof window.electronAPI.startPack !== 'function') {
      setStatusText(t('common_error_title'));
      return;
    }
    setIsPacking(true);
    setStatusText(t('pack_status_in_progress'));
    try {
      const total = await window.electronAPI.startPack({
        folderPath,
        maxSizeMb: maxSize,
        locale,
        packMetadata
      });
      if (total > 0) {
        setStatusText(t('pack_result_success', { count: total }));
        setLastPackCount(total);
        setIsRevealOpen(true);
      } else {
        setStatusText(t('pack_status_no_files'));
      }
      skipEstimateRef.current = true;
      await analyze(folderPath, maxSize);
    } catch (error) {
      console.error(error);
      setStatusText(`${t('common_error_title')}: ${(error as Error).message}`);
    } finally {
      setIsPacking(false);
    }
  }, [analyze, folderPath, handleOpenMetadata, locale, maxSize, metadataDrafts, t]);

  const handlePack = async () => {
    if (!folderPath || typeof maxSize !== 'number') {
      setStatusText(t('pack_error_disabled'));
      return;
    }
    if (!currentMetadataDraft || !hasRequiredMetadata(currentMetadataDraft.data)) {
      setStatusText(t('btn_pack_disabled_missing_required'));
      handleOpenMetadata('pack');
      return;
    }
    try {
      if (window.electronAPI && typeof window.electronAPI.checkExistingZips === 'function') {
        const result = await window.electronAPI.checkExistingZips(folderPath);
        if (result && result.count > 0) {
          setIsOverwriteOpen(true);
          return;
        }
      }
    } catch (e) {
      console.warn('Check existing zips failed', e);
    }
    await performPack();
  };

  const handleMetadataSave = useCallback(
    async (intent: 'save' | 'save_and_pack') => {
      if (!folderPath) {
        return;
      }
      const draft = metadataDrafts[folderPath] ?? createEmptyDraft();
      let metadata: PackMetadata;
      try {
        metadata = buildPackMetadata(draft.data);
      } catch (error) {
        console.warn('Metadata validation failed before saving', error);
        setStatusText(t('btn_pack_disabled_missing_required'));
        return;
      }
      const sanitized: MetadataDraftData = {
        title: metadata.title,
        artist: metadata.artist,
        licenseId: metadata.license.id,
        album: metadata.album ?? '',
        bpm: metadata.bpm ?? '',
        key: metadata.key ?? '',
        attribution: metadata.attribution ?? '',
        artistUrl: metadata.links?.artist_url ?? '',
        contactEmail: metadata.links?.contact_email ?? ''
      };
      setMetadataSaving(true);
      try {
        const nextAutoAttribution = sanitized.attribution || `${metadata.artist} — ${metadata.title}`;
        updateMetadataDraft(folderPath, (current) => ({
          ...mergeDraftData(current, sanitized),
          lastAutoAttribution: nextAutoAttribution,
          everOpened: true,
          rememberDefault: current.rememberDefault
        }));
        if (window.electronAPI && typeof window.electronAPI.setUserPrefs === 'function' && draft.rememberDefault) {
          await window.electronAPI.setUserPrefs({
            default_artist: metadata.artist,
            default_artist_url: metadata.links?.artist_url,
            default_contact_email: metadata.links?.contact_email
          });
        }
        if (window.electronAPI && typeof window.electronAPI.addRecentArtist === 'function') {
          await window.electronAPI.addRecentArtist({ artist: metadata.artist });
        }
        setUserPrefs((prev) => ({
          defaultArtist: draft.rememberDefault ? metadata.artist : prev.defaultArtist,
          defaultArtistUrl: draft.rememberDefault
            ? metadata.links?.artist_url ?? undefined
            : prev.defaultArtistUrl,
          defaultContactEmail: draft.rememberDefault
            ? metadata.links?.contact_email ?? undefined
            : prev.defaultContactEmail,
          recentArtists: dedupeRecentArtists([metadata.artist, ...prev.recentArtists])
        }));
        setIsMetadataOpen(false);
        setMetadataIntent('idle');
        showToast({
          id: 'metadata-saved',
          title: t('panel_pack_metadata_title'),
          message: t('toast_metadata_saved'),
          closeLabel: t('common_close'),
          timeoutMs: 5000
        });
        if (intent === 'save_and_pack') {
          await performPack();
        }
      } catch (error) {
        console.error('Failed to persist metadata preferences', error);
        setStatusText(t('common_error_title'));
      } finally {
        setMetadataSaving(false);
      }
    },
    [folderPath, metadataDrafts, performPack, showToast, t, updateMetadataDraft]
  );

  const handleCreateTestData = async () => {
    if (!window.electronAPI || typeof window.electronAPI.selectFolder !== 'function') {
      setStatusText(t('common_error_title'));
      return;
    }
    const target = await window.electronAPI.selectFolder();
    if (!target) {
      return;
    }
    try {
      if (!window.electronAPI || typeof window.electronAPI.createTestData !== 'function') {
        setStatusText(t('common_error_title'));
        return;
      }
      const response = await window.electronAPI.createTestData(target, locale);
      setStatusText(
        t('dev_message_create_test_data_done', { count: response.count, folder: response.folderPath })
      );
    } catch (error) {
      console.error(error);
      setStatusText(`${t('common_error_title')}: ${(error as Error).message}`);
    }
  };

  const handleOpenExternal = useCallback((event: MouseEvent<HTMLAnchorElement>, url: string) => {
    event.preventDefault();
    if (!window.electronAPI || typeof window.electronAPI.openExternal !== 'function') {
      console.error('Failed to open external link: API not available');
      return;
    }
    window.electronAPI.openExternal(url).catch((error) => {
      console.error('Failed to open external link', error);
    });
  }, []);

  const infoModalContent = useMemo(
    () => (
      <>
        <p>© 2025 Björn Ahlers — MIT License</p>
        <p className="mt-4">
          Get the source code at:{' '}<br />
          <a
            href="https://github.com/rewired/stem-zipper"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            onClick={(event) => handleOpenExternal(event, 'https://github.com/rewired/stem-zipper')}
          >
            https://github.com/rewired/stem-zipper
          </a>
        </p>
        <p className="mt-4">
          Music by 7OOP3D at ccMixter:{' '}<br />
          <a
            href="https://ccmixter.org/people/7OOP3D"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            onClick={(event) => handleOpenExternal(event, 'https://ccmixter.org/people/7OOP3D')}
          >
            https://ccmixter.org/people/7OOP3D
          </a>
        </p>
      </>
    ),
    [handleOpenExternal]
  );

  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onPackProgress !== 'function') {
      return () => {};
    }
    const removeListener = window.electronAPI.onPackProgress((event) => {
      progressStateRef.current = event.state;
      setProgress(event);
      switch (event.state) {
        case 'analyzing':
          if (event.message === 'splitting') {
            setStatusText(
              t('pack_status_splitting_percent', {
                percent: event.percent
              })
            );
          } else {
            setStatusText(t('pack_status_in_progress'));
          }
          break;
        case 'packing':
          if (event.currentZip) {
            setStatusText(
              t('pack_status_packing_percent', {
                name: event.currentZip,
                percent: event.percent
              })
            );
          } else {
            setStatusText(t('pack_status_in_progress'));
          }
          break;
        case 'finished':
          setStatusText(t('pack_status_done'));
          dismissToast('estimate');
          break;
        case 'error':
          setStatusText(
            event.errorMessage
              ? `${t('common_error_title')}: ${event.errorMessage}`
              : t('common_error_title')
          );
          break;
        default:
          break;
      }
    });
    return removeListener;
  }, [dismissToast, t]);

  useEffect(() => {
    if (estimateTimeoutRef.current !== null) {
      window.clearTimeout(estimateTimeoutRef.current);
      estimateTimeoutRef.current = null;
    }
    if (skipEstimateRef.current) {
      skipEstimateRef.current = false;
      return;
    }
    if (progress.state === 'finished') {
      return;
    }
    if (!files.length) {
      return;
    }
    if (typeof maxSize !== 'number' || Number.isNaN(maxSize)) {
      return;
    }
    if (!window.electronAPI || typeof window.electronAPI.estimateZipCount !== 'function') {
      return;
    }

    const requestFiles = files
      .filter((file) => Number.isFinite(file.sizeBytes) && file.sizeBytes >= 0)
      .map((file) => ({
        path: file.path,
        sizeBytes: file.sizeBytes,
        kind: file.kind,
        stereo: file.stereo === true ? true : undefined
      }));

    if (requestFiles.length === 0) {
      return;
    }

    const request = {
      files: requestFiles,
      targetMB: maxSize
    };

    estimateTimeoutRef.current = window.setTimeout(() => {
      estimateTimeoutRef.current = null;
      const currentToken = estimateRequestTokenRef.current + 1;
      estimateRequestTokenRef.current = currentToken;
      if (progressStateRef.current === 'finished') {
        return;
      }
      window.electronAPI
        .estimateZipCount(request)
        .then((response) => {
          if (estimateRequestTokenRef.current !== currentToken) {
            return;
          }
          if (progressStateRef.current === 'finished') {
            return;
          }
          estimatorErrorLoggedRef.current = false;
          showToast({
            id: 'estimate',
            title: t('toast_estimate_title'),
            message: formatMessage(locale, 'pack_toast_estimate', { count: response.zips }),
            note: t('toast_estimate_note'),
            closeLabel: formatMessage(locale, 'common_close'),
            timeoutMs: 10_000
          });
        })
        .catch((error) => {
          if (!estimatorErrorLoggedRef.current) {
            console.error('Failed to estimate ZIP count', error);
            estimatorErrorLoggedRef.current = true;
          }
        });
    }, 100);

    return () => {
      if (estimateTimeoutRef.current !== null) {
        window.clearTimeout(estimateTimeoutRef.current);
        estimateTimeoutRef.current = null;
      }
    };
  }, [files, locale, maxSize, progress.state, showToast, t]);

  useEffect(() => {
    if (!folderPath || !files.length || isMetadataOpen) {
      return;
    }
    const draft = metadataDrafts[folderPath];
    if (!draft) {
      return;
    }
    if (!draft.everOpened && !hasRequiredMetadata(draft.data)) {
      handleOpenMetadata('idle');
    }
  }, [files.length, folderPath, handleOpenMetadata, isMetadataOpen, metadataDrafts]);

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const item = event.dataTransfer.files?.[0] as (File & { path?: string }) | undefined;
    const itemPath = item?.path;
    if (!itemPath) {
      return;
    }
    await handleFolderSelection(itemPath);
  };

  const currentMetadataDraft = folderPath ? metadataDrafts[folderPath] : undefined;
  const metadataMissingRequired = Boolean(folderPath) && (!currentMetadataDraft || !hasRequiredMetadata(currentMetadataDraft.data));
  const canPack = Boolean(folderPath && files.length > 0 && !isPacking && typeof maxSize === 'number');
  const isDevMode = (window as unknown as { runtimeConfig?: { devMode?: boolean } }).runtimeConfig?.devMode || import.meta.env.DEV;
  const hasElectronAPI = Boolean((window as unknown as { electronAPI?: unknown }).electronAPI);
  const hasRuntimeConfig = Boolean((window as unknown as { runtimeConfig?: unknown }).runtimeConfig);

  return (
    <>
    <div
      className="flex min-h-screen flex-col bg-slate-950 text-slate-50"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Header
        title={t('app_title')}
        version={APP_VERSION}
        folderPath={folderPath}
        selectLabel={t('app_select_folder_label')}
        browseLabel={t('app_select_hint')}
        maxSizeLabel={t('app_max_size_label')}
        maxSizeTooltip={t('app_max_size_tooltip')}
        maxSize={maxSize}
        maxSizeLimit={MAX_SIZE_LIMIT_MB}
        onSelectFolder={handleSelectFolder}
        onMaxSizeChange={setMaxSize}
        onMaxSizeBlur={handleMaxSizeBlur}
        dropHelper={t('app_drop_helper')}
      />
      <main className="flex flex-1 min-h-0 flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
          <FileTable
            files={files}
            fileLabel={t('app_table_file')}
            sizeLabel={t('app_table_size')}
            actionLabel={t('app_table_action')}
            actionNames={actionNames}
            emptyLabel={t('app_select_hint')}
            helperLabel={t('app_drop_helper')}
            sizeUnitLabel={t('common_size_unit_megabyte')}
            formatSize={formatSize}
          />
        </div>
        <div className="sticky bottom-0 z-30 border-t border-slate-800 bg-slate-950/90 px-8 py-4 backdrop-blur">
          <div className="space-y-4">
            <ProgressPanel progress={progress} statusText={statusText} />
            <ActionBar
              onPack={handlePack}
              onExit={() => window.close()}
              onCreateTestData={isDevMode ? handleCreateTestData : undefined}
              onShowInfo={() => setIsInfoOpen(true)}
              onShowMetadata={() => handleOpenMetadata('idle')}
              canPack={canPack}
              isPacking={isPacking}
              packLabel={t('pack_action_start')}
              exitLabel={t('common_exit')}
              createTestDataLabel={t('dev_action_create_test_data')}
              devMode={isDevMode}
              infoLabel={t('app_about_label')}
              metadataLabel={t('btn_metadata_open')}
              metadataBadgeLabel={t('badge_metadata_missing_required')}
              showMetadataBadge={metadataMissingRequired}
              metadataDisabled={!folderPath || isPacking}
            />
          </div>
        </div>
      </main>
    {isMetadataOpen && folderPath && currentMetadataDraft ? (
      <MetadataModal
        modalTitle={t('modal_metadata_title')}
        draft={currentMetadataDraft.data}
        rememberDefault={currentMetadataDraft.rememberDefault}
        lastAutoAttribution={currentMetadataDraft.lastAutoAttribution}
        defaultArtist={userPrefs.defaultArtist}
        defaultArtistUrl={userPrefs.defaultArtistUrl}
        defaultContactEmail={userPrefs.defaultContactEmail}
        recentArtists={userPrefs.recentArtists}
        saveLabel={t('modal_save')}
        saveAndPackLabel={t('modal_save_and_pack')}
        cancelLabel={t('common_close')}
        rememberLabel={t('field_artist_remember_label')}
        requiredHint={t('hint_required')}
        requiredError={t('error_required')}
        emailWarning={t('warn_email_invalid')}
        titleLabel={t('field_title_label')}
        artistLabel={t('field_artist_label')}
        licenseLabel={t('field_license_label')}
        albumLabel={t('field_album_label')}
        bpmLabel={t('field_bpm_label')}
        keyLabel={t('field_key_label')}
        attributionLabel={t('field_attribution_label')}
        artistUrlLabel={t('field_artist_url_label')}
        contactEmailLabel={t('field_contact_email_label')}
        onChange={handleMetadataChange}
        onRememberDefaultChange={handleRememberDefaultChange}
        onClose={() => {
          setIsMetadataOpen(false);
          setMetadataIntent('idle');
        }}
        onSave={handleMetadataSave}
        onAutoAttributionChange={handleAutoAttributionChange}
        showSaveAndPack={metadataIntent === 'pack'}
        saving={metadataSaving}
        badgeRequiredLabel={t('badge_metadata_missing_required')}
        prefillKey={folderPath}
      />
    ) : null}
    {isInfoOpen ? (
      <InfoModal
        title={`Stem ZIPper v${APP_VERSION}`}
        text={infoModalContent}
        closeLabel={t('common_close')}
        onClose={() => setIsInfoOpen(false)}
      />
    ) : null}
    {isOverwriteWarnOpen ? (
      <ChoiceModal
        title={t('dialog_overwrite_title')}
        text={t('dialog_overwrite_text')}
        primaryLabel={t('common_ignore')}
        secondaryLabel={t('common_cancel')}
        onPrimary={async () => {
          setIsOverwriteWarnOpen(false);
          const next = pendingAnalyze;
          setPendingAnalyze(null);
          if (next) {
            await analyze(next.path, next.max);
          }
        }}
        onSecondary={() => {
          setIsOverwriteWarnOpen(false);
          setPendingAnalyze(null);
          setFiles([]);
          setFolderPath(null);
          setStatusText(t('app_select_hint'));
        }}
      />
    ) : null}
      {isDragActive ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm">
          <div className="rounded-xl border border-blue-400/60 bg-slate-900/90 px-10 py-6 text-center text-lg font-semibold text-blue-100 shadow-xl">
            {t('app_drop_helper')}
          </div>
        </div>
      ) : null}
    </div>
    <DiagOverlay hasElectronAPI={hasElectronAPI} hasRuntimeConfig={hasRuntimeConfig} isDev={isDevMode} />
    {isOverwriteOpen ? (
      <ChoiceModal
        title={t('dialog_overwrite_title')}
        text={t('dialog_overwrite_text')}
        primaryLabel={t('pack_action_start')}
        secondaryLabel={t('common_close')}
        onPrimary={() => {
          setIsOverwriteOpen(false);
          void performPack();
        }}
        onSecondary={() => setIsOverwriteOpen(false)}
      />
    ) : null}
    {isRevealOpen && folderPath ? (
      <ChoiceModal
        title={t('pack_status_done')}
        text={`${t('pack_result_success', { count: lastPackCount })}\n${t('dialog_open_folder_prompt')}`}
        primaryLabel={t('common_browse')}
        secondaryLabel={t('common_close')}
        onPrimary={() => {
          setIsRevealOpen(false);
          if (window.electronAPI && typeof window.electronAPI.openPath === 'function') {
            window.electronAPI.openPath(folderPath).catch((err) => console.error(err));
          }
        }}
        onSecondary={() => setIsRevealOpen(false)}
      />
    ) : null}
    </>
  );
}

