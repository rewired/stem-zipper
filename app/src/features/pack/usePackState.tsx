import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { DEFAULT_MAX_SIZE_MB, MAX_SIZE_LIMIT_MB } from '@common/constants';
import type { FileEntry, PackProgress, PackState, PackStatusEvent, PackMethod } from '@common/ipc';
import type { PackingPlanRequest } from '@common/ipc/contracts';
import type { EstimateResponse } from '@common/packing/estimator';
import { ensureValidMaxSize } from '@common/validation';
import { formatMessage, tNS, type TranslationKey } from '@common/i18n';
import { useAppStore } from '../../store/appStore';
import { useMetadata } from '../metadata/useMetadata';
import type { FileRow } from '../../types/fileRow';
import { mergePackingPlan } from '../files/mergePackingPlan';

const initialProgress: PackProgress = {
  state: 'done',
  current: 0,
  total: 0,
  percent: 0,
  message: 'pack_progress_done'
};

const PACK_METHOD_STORAGE_KEY = 'stem-zipper.pack-method';

export type PackToastEvent =
  | {
      type: 'toast';
      toast: {
        id: string;
        title: string;
        message: string;
        timeoutMs?: number;
        note?: string;
        closeLabel: string;
      };
    }
  | { type: 'dismiss'; id: string };

interface PackContextValue {
  progress: PackProgress;
  isPacking: boolean;
  packMethod: PackMethod;
  setPackMethod: (method: PackMethod) => void;
  isRevealOpen: boolean;
  setIsRevealOpen: (value: boolean) => void;
  lastPackCount: number;
  isOverwriteOpen: boolean;
  setIsOverwriteOpen: (value: boolean) => void;
  isOverwriteWarnOpen: boolean;
  selectFolder: () => Promise<void>;
  handleMaxSizeBlur: () => Promise<void>;
  performPack: () => Promise<void>;
  confirmOverwriteAndPack: () => Promise<void>;
  confirmOverwriteWarning: () => Promise<void>;
  cancelOverwriteWarning: () => void;
  handleDropPath: (path: string) => Promise<void>;
  subscribe: (listener: (event: PackToastEvent) => void) => () => void;
  isDragActive: boolean;
  setIsDragActive: (value: boolean) => void;
  createTestData: () => Promise<void>;
}

const PackContext = createContext<PackContextValue | null>(null);

function useEventTarget<T>() {
  const targetRef = useRef<EventTarget>();
  if (!targetRef.current) {
    targetRef.current = new EventTarget();
  }

  const emit = useCallback((event: T) => {
    const target = targetRef.current as EventTarget;
    target.dispatchEvent(new CustomEvent('message', { detail: event } as CustomEventInit<T>));
  }, []);

  const subscribe = useCallback((listener: (event: T) => void) => {
    const target = targetRef.current as EventTarget;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<T>;
      listener(custom.detail);
    };
    target.addEventListener('message', handler);
    return () => target.removeEventListener('message', handler);
  }, []);

  return { emit, subscribe };
}

function convertFileEntriesToRows(entries: FileEntry[], previous: FileRow[]): FileRow[] {
  const previousByPath = new Map(previous.map((file) => [file.path, file] as const));
  return entries.map((entry) => {
    const existing = previousByPath.get(entry.path);
    const intended =
      typeof existing?.userIntendedSelected === 'boolean'
        ? existing.userIntendedSelected
        : typeof existing?.selected === 'boolean'
          ? existing.selected
          : true;
    const estimate = existing?.estimate
      ? { archiveIndex: existing.estimate.archiveIndex, archiveLabel: existing.estimate.archiveLabel }
      : undefined;

    return {
      ...entry,
      id: existing?.id ?? entry.path,
      selectable: existing?.selectable ?? true,
      selected: intended,
      userIntendedSelected: intended,
      estimate
    };
  });
}

export function PackStateProvider({ children }: { children: ReactNode }) {
  const { locale, maxSize, setMaxSize, folderPath, setFolderPath, files, setFiles, setStatusText } =
    useAppStore();
  const { ensureDraft, metadataMissingRequired, openMetadata, getPackMetadata } = useMetadata();
  const [progress, setProgress] = useState<PackProgress>(initialProgress);
  const [isPacking, setIsPacking] = useState(false);
  const [isRevealOpen, setIsRevealOpen] = useState(false);
  const [lastPackCount, setLastPackCount] = useState(0);
  const [isOverwriteOpen, setIsOverwriteOpen] = useState(false);
  const [isOverwriteWarnOpen, setIsOverwriteWarnOpen] = useState(false);
  const [pendingAnalyze, setPendingAnalyze] = useState<{ path: string; max: number } | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [packMethod, setPackMethodState] = useState<PackMethod>(() => {
    const stored = window.localStorage.getItem(PACK_METHOD_STORAGE_KEY) as PackMethod | null;
    return stored === 'seven_z_split' ? 'seven_z_split' : 'zip_best_fit';
  });
  const { emit, subscribe } = useEventTarget<PackToastEvent>();
  const analyzeTokenRef = useRef(0);
  const estimateRequestCounterRef = useRef(0);
  const estimateTokenRef = useRef('0-0');
  const estimatorErrorLoggedRef = useRef(false);
  const progressStateRef = useRef<PackState>(initialProgress.state);
  const estimateModeRef = useRef<'auto' | 'silent'>('auto');
  const triggerEstimateRef = useRef<ReturnType<typeof debounce> | null>(null);
  const lastPlanStateRef = useRef<{ signature: string; method: PackingPlanRequest['method']; size: number | null }>(
    {
      signature: '',
      method: 'zip',
      size: null
    }
  );

  const t = useCallback(
    (key: TranslationKey, params: Record<string, string | number> = {}) =>
      formatMessage(locale, key, params),
    [locale]
  );

  useEffect(() => {
    window.localStorage.setItem(PACK_METHOD_STORAGE_KEY, packMethod);
  }, [packMethod]);

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

  const resetProgress = useCallback(() => {
    setProgress(initialProgress);
    progressStateRef.current = initialProgress.state;
  }, []);

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
        setFiles((previous) => convertFileEntriesToRows(response.files, previous));
        setFolderPath(targetFolder);
        ensureDraft(targetFolder);
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
      } catch (error: unknown) {
        console.error(error);
        if (isLatestAnalyzeToken(analyzeToken)) {
          setStatusText(`${t('common_error_title')}: ${(error as Error).message}`);
        }
      }
    },
    [ensureDraft, isLatestAnalyzeToken, locale, nextAnalyzeToken, setFiles, setFolderPath, setMaxSize, setStatusText, t]
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
      } catch (e: unknown) {
        console.warn('Failed to check existing ZIPs before analyze', e);
      }
      await analyze(selectedPath, numericMax);
    },
    [analyze, maxSize, resetProgress]
  );

  const selectFolder = useCallback(async () => {
    if (!window.electronAPI || typeof window.electronAPI.selectFolder !== 'function') {
      setStatusText(t('common_error_title'));
      return;
    }
    const selected = await window.electronAPI.selectFolder();
    await handleFolderSelection(selected);
  }, [handleFolderSelection, setStatusText, t]);

  const handleMaxSizeBlur = useCallback(async () => {
    const numericValue = typeof maxSize === 'number' ? maxSize : DEFAULT_MAX_SIZE_MB;
    const sanitized = ensureValidMaxSize(numericValue);
    if (sanitized !== numericValue) {
      setMaxSize(sanitized);
      setStatusText(t('pack_error_invalid_max_size', { max: MAX_SIZE_LIMIT_MB, reset: sanitized }));
    }
    if (folderPath) {
      await analyze(folderPath, sanitized);
    }
  }, [analyze, folderPath, maxSize, setMaxSize, setStatusText, t]);

  const performPack = useCallback(async () => {
    if (!folderPath || typeof maxSize !== 'number') {
      setStatusText(t('pack_error_disabled'));
      return;
    }
    const metadata = getPackMetadata();
    if (!metadata) {
      setStatusText(t('btn_pack_disabled_missing_required'));
      openMetadata('pack');
      return;
    }
    if (!window.electronAPI || typeof window.electronAPI.startPack !== 'function') {
      setStatusText(t('common_error_title'));
      return;
    }
    estimateModeRef.current = 'silent';
    setIsPacking(true);
    emit({ type: 'dismiss', id: 'estimate' });
    setStatusText(t('pack_status_in_progress'));
    try {
      const selectedFiles = files.filter((file) => file.selectable && file.selected).map((file) => file.path);
      if (selectedFiles.length === 0) {
        setStatusText(t('pack_status_no_files'));
        setIsPacking(false);
        estimateModeRef.current = 'auto';
        return;
      }

      await window.electronAPI.startPack({
        folderPath,
        maxSizeMb: maxSize,
        locale,
        packMetadata: metadata,
        method: packMethod,
        files: selectedFiles
      });
      await analyze(folderPath, maxSize);
    } catch (error: unknown) {
      console.error(error);
      setStatusText(`${t('common_error_title')}: ${(error as Error).message}`);
    } finally {
      setIsPacking(false);
      estimateModeRef.current = 'auto';
    }
  }, [analyze, emit, files, folderPath, getPackMetadata, locale, maxSize, openMetadata, packMethod, setStatusText, t]);

  const confirmOverwriteAndPack = useCallback(async () => {
    setIsOverwriteOpen(false);
    await performPack();
  }, [performPack]);

  const confirmOverwriteWarning = useCallback(async () => {
    setIsOverwriteWarnOpen(false);
    const next = pendingAnalyze;
    setPendingAnalyze(null);
    if (next) {
      await analyze(next.path, next.max);
    }
  }, [analyze, pendingAnalyze]);

  const cancelOverwriteWarning = useCallback(() => {
    setIsOverwriteWarnOpen(false);
    setPendingAnalyze(null);
    setFiles([]);
    setFolderPath(null);
    setStatusText(t('app_select_hint'));
  }, [setFiles, setFolderPath, setPendingAnalyze, setStatusText, t]);

  const performPackFlow = useCallback(async () => {
    if (!folderPath || typeof maxSize !== 'number') {
      setStatusText(t('pack_error_disabled'));
      return;
    }
    if (metadataMissingRequired) {
      setStatusText(t('btn_pack_disabled_missing_required'));
      openMetadata('pack');
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
    } catch (e: unknown) {
      console.warn('Check existing zips failed', e);
    }
    await performPack();
  }, [folderPath, maxSize, metadataMissingRequired, openMetadata, performPack, setStatusText, t]);

  const createTestData = useCallback(async () => {
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
    } catch (error: unknown) {
      console.error(error);
      setStatusText(`${t('common_error_title')}: ${(error as Error).message}`);
    }
  }, [locale, setStatusText, t]);

  const handleDropPath = useCallback(
    async (path: string) => {
      await handleFolderSelection(path);
    },
    [handleFolderSelection]
  );

  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onPackProgress !== 'function') {
      return () => {};
    }
    const removeListener = window.electronAPI.onPackProgress((event) => {
      progressStateRef.current = event.state;
      setProgress(event);
      switch (event.state) {
        case 'preparing':
          emit({ type: 'dismiss', id: 'estimate' });
          setStatusText(
            t(event.message, {
              percent: event.percent
            })
          );
          break;
        case 'packing':
          emit({ type: 'dismiss', id: 'estimate' });
          if (event.currentArchive) {
            setStatusText(
              t(event.message, {
                name: event.currentArchive,
                percent: event.percent
              })
            );
          } else {
            setStatusText(t('pack_progress_packing_generic', { percent: event.percent }));
          }
          break;
        case 'finalizing':
          setStatusText(t(event.message));
          emit({ type: 'dismiss', id: 'estimate' });
          break;
        case 'done':
          setStatusText(t('pack_status_done'));
          emit({ type: 'dismiss', id: 'estimate' });
          break;
        case 'error':
          setStatusText(
            event.errorMessage
              ? `${t('common_error_title')}: ${event.errorMessage}`
              : t('common_error_title')
          );
          emit({ type: 'dismiss', id: 'estimate' });
          break;
        default:
          break;
      }
    });
    return removeListener;
  }, [emit, setStatusText, t]);

  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onPackStatus !== 'function') {
      return () => {};
    }
    const removeListener = window.electronAPI.onPackStatus((event: PackStatusEvent) => {
      if (event.type !== 'toast') {
        return;
      }
      const titleKey = event.toast.level === 'warning' ? 'toast_warning_title' : 'toast_info_title';
      emit({
        type: 'toast',
        toast: {
          id: event.toast.id,
          title: formatMessage(locale, titleKey),
          message: formatMessage(locale, event.toast.messageKey, event.toast.params),
          timeoutMs: 10_000,
          closeLabel: t('common_close')
        }
      });
    });
    return removeListener;
  }, [emit, locale, t]);
  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onPackDone !== 'function') {
      return () => {};
    }
    const removeListener = window.electronAPI.onPackDone((result) => {
      setLastPackCount(result.archives.length);
      setStatusText(t('pack_result_success', { count: result.archives.length }));
      setIsRevealOpen(true);
    });
    return removeListener;
  }, [setIsRevealOpen, setLastPackCount, setStatusText, t]);

  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.onPackError !== 'function') {
      return () => {};
    }
    const removeListener = window.electronAPI.onPackError((payload) => {
      setStatusText(`${t('common_error_title')}: ${payload.message}`);
      emit({ type: 'dismiss', id: 'estimate' });
    });
    return removeListener;
  }, [emit, setStatusText, t]);


  const formatInteger = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0
    });
    return (value: number) => formatter.format(value);
  }, [locale]);

  const formatSize = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return (value: number) => formatter.format(value);
  }, [locale]);

  const filesPlanSignature = useMemo(
    () =>
      files
        .map((file, index) => `${index}:${file.path}:${file.sizeBytes}`)
        .join('|'),
    [files]
  );

  const triggerEstimate = useMemo(() => {
    return debounce(() => {
      if (estimateModeRef.current !== 'auto') {
        return;
      }
      if (!files.length) {
        emit({ type: 'dismiss', id: 'estimate' });
        return;
      }
      if (typeof maxSize !== 'number' || Number.isNaN(maxSize)) {
        emit({ type: 'dismiss', id: 'estimate' });
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
        emit({ type: 'dismiss', id: 'estimate' });
        return;
      }

      const estimateToken = nextEstimateTokenFromAnalyze(analyzeTokenRef.current);
      estimatorErrorLoggedRef.current = false;

      emit({
        type: 'toast',
        toast: {
          id: 'estimate',
          title: t('toast_info_title'),
          message: t('toast_estimate_start'),
          timeoutMs: 10_000,
          closeLabel: formatMessage(locale, 'common_close')
        }
      });

      window.electronAPI
        .estimateZipCount({ files: requestFiles, targetMB: maxSize, token: estimateToken })
        .then((response: EstimateResponse) => {
          if (!isLatestEstimateToken(estimateToken)) {
            return;
          }
          estimatorErrorLoggedRef.current = false;
          const formattedCount = formatInteger(response.zips);
          const formattedSize = `${formatSize(response.bytesLogical / (1024 * 1024))} ${formatMessage(
            locale,
            'common_size_unit_megabyte'
          )}`;
          emit({
            type: 'toast',
            toast: {
              id: 'estimate',
              title: t('toast_info_title'),
              message: t('toast_estimate_result', { count: formattedCount, size: formattedSize }),
              timeoutMs: 10_000,
              closeLabel: formatMessage(locale, 'common_close')
            }
          });
        })
        .catch((error: unknown) => {
          if (!isLatestEstimateToken(estimateToken)) {
            return;
          }
          if (!estimatorErrorLoggedRef.current) {
            console.error('Failed to estimate ZIP count', error);
            estimatorErrorLoggedRef.current = true;
          }
          emit({
            type: 'toast',
            toast: {
              id: 'estimate',
              title: t('toast_warning_title'),
              message: t('toast_estimate_error'),
              timeoutMs: 10_000,
              closeLabel: formatMessage(locale, 'common_close')
            }
          });
        });
    }, 150);
  }, [emit, files, formatInteger, formatSize, isLatestEstimateToken, locale, maxSize, nextEstimateTokenFromAnalyze, t]);

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
    const method: PackingPlanRequest['method'] = packMethod === 'seven_z_split' ? '7z' : 'zip';
    const zipDisallowedReason = tNS('pack', 'row_reason_too_large_zip', undefined, locale);
    const normalizedSize =
      typeof maxSize === 'number' && Number.isFinite(maxSize) && maxSize > 0 ? maxSize : null;
    const last = lastPlanStateRef.current;

    if (last.signature === filesPlanSignature && last.method === method && last.size === normalizedSize) {
      return;
    }

    if (!files.length) {
      lastPlanStateRef.current = { signature: filesPlanSignature, method, size: normalizedSize };
      setFiles((previous) =>
        previous.map((file) => {
          if (method !== '7z') {
            return file;
          }
          const intended =
            typeof file.userIntendedSelected === 'boolean'
              ? file.userIntendedSelected
              : typeof file.selected === 'boolean'
                ? file.selected
                : true;
          return {
            ...file,
            selectable: true,
            selected: intended,
            userIntendedSelected: intended,
            estimate: file.estimate
              ? { archiveIndex: file.estimate.archiveIndex, archiveLabel: file.estimate.archiveLabel }
              : undefined
          };
        })
      );
      return;
    }

    if (!window.electronAPI || typeof window.electronAPI.estimatePackingPlan !== 'function') {
      lastPlanStateRef.current = { signature: filesPlanSignature, method, size: normalizedSize };
      setFiles((previous) => mergePackingPlan(previous, [], { method, zipDisallowedReason }));
      return;
    }

    if (normalizedSize === null) {
      lastPlanStateRef.current = { signature: filesPlanSignature, method, size: normalizedSize };
      setFiles((previous) => mergePackingPlan(previous, [], { method, zipDisallowedReason }));
      return;
    }

    const requestFiles = files.map((file) => ({ path: file.path, sizeBytes: file.sizeBytes }));
    const request: PackingPlanRequest = {
      method,
      maxArchiveSizeMb: normalizedSize,
      files: requestFiles,
      splitStereo: false
    };

    lastPlanStateRef.current = { signature: filesPlanSignature, method, size: normalizedSize };
    let cancelled = false;
    window.electronAPI
      .estimatePackingPlan(request)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setFiles((previous) => mergePackingPlan(previous, response.plan, { method, zipDisallowedReason }));
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        console.error('Failed to compute packing plan', error);
        setFiles((previous) => mergePackingPlan(previous, [], { method, zipDisallowedReason }));
      });

    return () => {
      cancelled = true;
    };
  }, [files, filesPlanSignature, locale, maxSize, packMethod, setFiles]);

  const value = useMemo<PackContextValue>(
    () => ({
      progress,
      isPacking,
      packMethod,
      setPackMethod: setPackMethodState,
      isRevealOpen,
      setIsRevealOpen,
      lastPackCount,
      isOverwriteOpen,
      setIsOverwriteOpen,
      isOverwriteWarnOpen,
      selectFolder,
      handleMaxSizeBlur,
      performPack: performPackFlow,
      confirmOverwriteAndPack,
      confirmOverwriteWarning,
      cancelOverwriteWarning,
      handleDropPath,
      subscribe,
      isDragActive,
      setIsDragActive,
      createTestData
    }),
    [
      confirmOverwriteAndPack,
      confirmOverwriteWarning,
      cancelOverwriteWarning,
      createTestData,
      handleMaxSizeBlur,
      handleDropPath,
      isDragActive,
      isOverwriteOpen,
      isOverwriteWarnOpen,
      isPacking,
      isRevealOpen,
      lastPackCount,
      packMethod,
      performPackFlow,
      progress,
      selectFolder,
      setIsDragActive,
      setIsOverwriteOpen,
      setIsRevealOpen,
      setPackMethodState,
      subscribe
    ]
  );

  return <PackContext.Provider value={value}>{children}</PackContext.Provider>;
}

export function usePackState(): PackContextValue {
  const context = useContext(PackContext);
  if (!context) {
    throw new Error('usePackState must be used within a PackStateProvider');
  }
  return context;
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, delayMs: number) {
  let handle: number | null = null;
  const debounced = ((...args: Parameters<T>) => {
    if (handle !== null) {
      window.clearTimeout(handle);
    }
    handle = window.setTimeout(() => {
      handle = null;
      fn(...args);
    }, delayMs);
  }) as T & { cancel: () => void };
  debounced.cancel = () => {
    if (handle !== null) {
      window.clearTimeout(handle);
      handle = null;
    }
  };
  return debounced;
}
