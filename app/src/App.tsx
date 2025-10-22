import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type MouseEvent
} from 'react';
import type { FileEntry, PackProgress } from '@common/ipc';
import { DEFAULT_MAX_SIZE_MB, MAX_SIZE_LIMIT_MB } from '@common/constants';
import { ensureValidMaxSize } from '@common/validation';
import { Header } from './components/Header';
import { FileTable } from './components/FileTable';
import { ProgressPanel } from './components/ProgressPanel';
import { ActionBar } from './components/ActionBar';
import { formatMessage, resolveLocale, translations, type LocaleKey } from '@common/i18n';
import { InfoModal } from './components/InfoModal';
import { APP_VERSION } from '@common/version';

const initialProgress: PackProgress = {
  state: 'idle',
  current: 0,
  total: 0,
  percent: 0,
  message: 'ready'
};

function detectInitialLocale(): LocaleKey {
  const languages = Array.isArray(navigator.languages) ? navigator.languages : [];
  return resolveLocale(window.runtimeConfig.locale, languages, navigator.language);
}

export default function App() {
  const [locale] = useState<LocaleKey>(() => detectInitialLocale());
  const [maxSize, setMaxSize] = useState<number | ''>(DEFAULT_MAX_SIZE_MB);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [progress, setProgress] = useState<PackProgress>(initialProgress);
  const [statusText, setStatusText] = useState(() => formatMessage(locale, 'ready'));
  const [isPacking, setIsPacking] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const t = useCallback(
    (key: keyof typeof translations.en, params: Record<string, string | number> = {}) =>
      formatMessage(locale, key, params),
    [locale]
  );

  const actionNames = useMemo(
    () => ({
      normal: t('normal'),
      split_mono: t('split_mono'),
      split_zip: t('split_zip')
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
    document.title = `${t('app_title')} ${APP_VERSION}`;
  }, [t]);

  const resetProgress = () => {
    setProgress(initialProgress);
  };

  const analyze = useCallback(
    async (targetFolder: string, currentMaxSize: number) => {
      try {
        const response = await window.electronAPI.analyzeFolder(targetFolder, currentMaxSize, locale);
        setFiles(response.files);
        setFolderPath(targetFolder);
        if (response.maxSizeMb !== currentMaxSize) {
          setMaxSize(response.maxSizeMb);
          setStatusText(t('msg_invalid_max_size', { max: MAX_SIZE_LIMIT_MB, reset: response.maxSizeMb }));
        } else {
          setStatusText(
            response.count > 0 ? t('found_files', { count: response.count }) : t('msg_no_files')
          );
        }
      } catch (error) {
        console.error(error);
        setStatusText(`${t('error_title')}: ${(error as Error).message}`);
      }
    },
    [locale, t]
  );

  const handleFolderSelection = useCallback(
    async (selectedPath: string | null) => {
      if (!selectedPath) {
        return;
      }
      resetProgress();
      await analyze(selectedPath, typeof maxSize === 'number' ? maxSize : DEFAULT_MAX_SIZE_MB);
    },
    [analyze, maxSize]
  );

  const handleSelectFolder = async () => {
    const selected = await window.electronAPI.selectFolder();
    await handleFolderSelection(selected);
  };

  const handleMaxSizeBlur = async () => {
    const numericValue = typeof maxSize === 'number' ? maxSize : DEFAULT_MAX_SIZE_MB;
    const sanitized = ensureValidMaxSize(numericValue);
    if (sanitized !== numericValue) {
      setMaxSize(sanitized);
      setStatusText(t('msg_invalid_max_size', { max: MAX_SIZE_LIMIT_MB, reset: sanitized }));
    }
    if (folderPath) {
      await analyze(folderPath, sanitized);
    }
  };

  const handlePack = async () => {
    if (!folderPath || typeof maxSize !== 'number') {
      setStatusText(t('pack_disabled'));
      return;
    }
    setIsPacking(true);
    setStatusText(t('now_packing'));
    try {
      const total = await window.electronAPI.startPack({
        folderPath,
        maxSizeMb: maxSize,
        locale
      });
      if (total > 0) {
        setStatusText(t('msg_finished', { count: total }));
      } else {
        setStatusText(t('msg_no_files'));
      }
      await analyze(folderPath, maxSize);
    } catch (error) {
      console.error(error);
      setStatusText(`${t('error_title')}: ${(error as Error).message}`);
    } finally {
      setIsPacking(false);
    }
  };

  const handleCreateTestData = async () => {
    const target = await window.electronAPI.selectFolder();
    if (!target) {
      return;
    }
    try {
      const response = await window.electronAPI.createTestData(target, locale);
      setStatusText(t('create_testdata_done', { count: response.count, folder: response.folderPath }));
    } catch (error) {
      console.error(error);
      setStatusText(`${t('error_title')}: ${(error as Error).message}`);
    }
  };

  const handleOpenExternal = useCallback((event: MouseEvent<HTMLAnchorElement>, url: string) => {
    event.preventDefault();
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
            github.com/rewired/stem-zipper
          </a>
        </p>
        <p className="mt-4">
          My music by 7OOP3D on ccMixter:{' '}<br />
          <a
            href="https://ccmixter.org/people/7OOP3D"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            onClick={(event) => handleOpenExternal(event, 'https://ccmixter.org/people/7OOP3D')}
          >
            ccmixter.org/people/7OOP3D
          </a>
        </p>
      </>
    ),
    [handleOpenExternal]
  );

  useEffect(() => {
    const removeListener = window.electronAPI.onPackProgress((event) => {
      setProgress(event);
      switch (event.state) {
        case 'analyzing':
          setStatusText(t('now_packing'));
          break;
        case 'packing':
          if (event.currentZip) {
            setStatusText(
              t('status_packing_percent', {
                name: event.currentZip,
                percent: event.percent
              })
            );
          } else {
            setStatusText(t('now_packing'));
          }
          break;
        case 'finished':
          setStatusText(t('status_done'));
          break;
        case 'error':
          setStatusText(
            event.errorMessage ? `${t('error_title')}: ${event.errorMessage}` : t('error_title')
          );
          break;
        default:
          break;
      }
    });
    return removeListener;
  }, [t]);

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

  const canPack = Boolean(folderPath && files.length > 0 && !isPacking && typeof maxSize === 'number');
  const isDevMode = window.runtimeConfig.devMode || import.meta.env.DEV;

  return (
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
        selectLabel={t('select_folder')}
        browseLabel={t('select_hint')}
        maxSizeLabel={t('max_size_label')}
        maxSizeTooltip={t('max_size_tooltip')}
        maxSize={maxSize}
        maxSizeLimit={MAX_SIZE_LIMIT_MB}
        onSelectFolder={handleSelectFolder}
        onMaxSizeChange={setMaxSize}
        onMaxSizeBlur={handleMaxSizeBlur}
        dropHelper={t('drop_helper')}
      />
      <main className="flex flex-1 min-h-0 flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
          <FileTable
            files={files}
            fileLabel={t('table_file')}
            sizeLabel={t('table_size')}
            actionLabel={t('table_action')}
            actionNames={actionNames}
            emptyLabel={t('select_hint')}
            helperLabel={t('drop_helper')}
            sizeUnitLabel={t('size_unit_megabyte')}
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
              canPack={canPack}
              isPacking={isPacking}
              packLabel={t('pack_now')}
              exitLabel={t('exit')}
              createTestDataLabel={t('create_testdata')}
              devMode={isDevMode}
              infoLabel={t('about')}
            />
          </div>
        </div>
      </main>
      {isInfoOpen ? (
        <InfoModal
          title={`Stem ZIPper v${APP_VERSION}`}
          text={infoModalContent}
          closeLabel={t('close')}
          onClose={() => setIsInfoOpen(false)}
        />
      ) : null}
      {isDragActive ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm">
          <div className="rounded-xl border border-blue-400/60 bg-slate-900/90 px-10 py-6 text-center text-lg font-semibold text-blue-100 shadow-xl">
            {t('drop_helper')}
          </div>
        </div>
      ) : null}
    </div>
  );
}
