import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent
} from 'react';
import type { FileEntry, PackMetadata, PackProgress, PackState, PackStatusEvent } from '@common/ipc';
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

type DebouncedFunction<T extends (...args: unknown[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};

function debounce<T extends (...args: unknown[]) => void>(fn: T, delayMs: number): DebouncedFunction<T> {
  let handle: number | null = null;
  const debounced = ((...args: Parameters<T>) => {
    if (handle !== null) {
      window.clearTimeout(handle);
    }
    handle = window.setTimeout(() => {
      handle = null;
      fn(...args);
    }, delayMs);
  }) as DebouncedFunction<T>;
  debounced.cancel = () => {
    if (handle !== null) {
      window.clearTimeout(handle);
      handle = null;
    }
  };
  return debounced;
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
  const analyzeTokenRef = useRef(0);
  const estimateRequestCounterRef = useRef(0);
  const estimateTokenRef = useRef('0-0');
  const estimatorErrorLoggedRef = useRef(false);
  const progressStateRef = useRef<PackState>(initialProgress.state);
  const estimateModeRef = useRef<'auto' | 'silent'>('auto');
  const triggerEstimateRef = useRef<DebouncedFunction<() => void> | null>(null);

  const nextAnalyzeToken = useCallback(() => {
    const next = analyzeTokenRef.current + 1;
    analyzeTokenRef.current = next;
    estimateRequestCounterRef.current = 0;
    estimateTokenRef.current = `${next}-0`;
    return next;
  }, []);

  const isLatestAnalyzeToken = useCallback((token: number) => analyzeTokenRef.current === token, []);

  const nextEstimateTokenFromAnalyze = useCallback((analyzeToken: number) => {
    estimateRequestCounterRef.current += 1;
    const token = `${analyzeToken}-${estimateRequestCounterRef.current}`;
    estimateTokenRef.current = token;
    return token;
  }, []);

  const isLatestEstimateToken = useCallback((token: string) => estimateTokenRef.current === token, []);

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
      if (!window.electronAPI || typeof window.electronAPI.analyzeFolder !== 'function') {
        setStatusText(t('common_error_title'));
        return;
      }
      const analyzeToken = nextAnalyzeToken();
      try {
        const response = await window.electronAPI.analyzeFolder(targetFolder, currentMaxSize, locale);
        if (!isLatestAnalyzeToken(analyzeToken)) {
          return;
        }
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
        if (isLatestAnalyzeToken(analyzeToken)) {
          setStatusText(`${t('common_error_title')}: ${(error as Error).message}`);
        }
      }
    },
    [ensureMetadataDraft, isLatestAnalyzeToken, locale, nextAnalyzeToken, t]
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
    estimateModeRef.current = 'silent';
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
      await analyze(folderPath, maxSize);
    } catch (error) {
      console.error(error);
      setStatusText(`${t('common_error_title')}: ${(error as Error).message}`);
    } finally {
      setIsPacking(false);
      estimateModeRef.current = 'auto';
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
          dismissToast('estimate');
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
          dismissToast('estimate');
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
          dismissToast('estimate');
          break;
        default:
          break;
      }
    });
    return removeListener;
  }, [dismissToast, t]);

  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onPackStatus !== 'function') {
      return () => {};
    }
    const removeListener = window.electronAPI.onPackStatus((event: PackStatusEvent) => {
      if (event.type !== 'toast') {
        return;
      }
      const titleKey = event.toast.level === 'warning' ? 'toast_warning_title' : 'toast_info_title';
      showToast({
        id: event.toast.id,
        title: formatMessage(locale, titleKey),
        message: formatMessage(locale, event.toast.messageKey, event.toast.params),
        closeLabel: t('common_close'),
        timeoutMs: 10_000
      });
    });
    return removeListener;
  }, [locale, showToast, t]);

  const triggerEstimate = useMemo(() => {
    return debounce(() => {
      if (estimateModeRef.current !== 'auto') {
        return;
      }
      if (!files.length) {
        dismissToast('estimate');
        return;
      }
      if (typeof maxSize !== 'number' || Number.isNaN(maxSize)) {
        dismissToast('estimate');
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
        dismissToast('estimate');
        return;
      }

      const estimateToken = nextEstimateTokenFromAnalyze(analyzeTokenRef.current);
      estimatorErrorLoggedRef.current = false;

      showToast({
        id: 'estimate',
        title: t('toast_estimate_title'),
        message: formatMessage(locale, 'pack_toast_estimate_pending'),
        note: t('toast_estimate_note'),
        closeLabel: formatMessage(locale, 'common_close'),
        timeoutMs: 10_000
      });

      window.electronAPI
        .estimateZipCount({ files: requestFiles, targetMB: maxSize, token: estimateToken })
        .then((response) => {
          if (!isLatestEstimateToken(estimateToken)) {
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
          if (!isLatestEstimateToken(estimateToken)) {
            return;
          }
          if (!estimatorErrorLoggedRef.current) {
            console.error('Failed to estimate ZIP count', error);
            estimatorErrorLoggedRef.current = true;
          }
          dismissToast('estimate');
        });
    }, 150);
  }, [
    dismissToast,
    files,
    isLatestEstimateToken,
    locale,
    maxSize,
    nextEstimateTokenFromAnalyze,
    showToast,
    t
  ]);

  useEffect(() => {
    triggerEstimateRef.current?.cancel();
    triggerEstimateRef.current = triggerEstimate;
  }, [triggerEstimate]);

  useEffect(() => {
    const fn = triggerEstimateRef.current;
    if (!fn) {
      return;
    }
    fn();
    return () => {
      fn.cancel();
    };
  }, [files, locale, maxSize]);

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

