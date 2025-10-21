import React from 'react';
import { useTranslation } from 'react-i18next';
import Notice from './components/Notice';
import { initI18n } from './i18n';
import type { AppConfiguration, PackProgress, StemAnalysisEntry } from '@common/types';

interface NoticeState {
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

const App: React.FC = () => {
  const [configuration, setConfiguration] = React.useState<AppConfiguration | null>(null);
  const [i18nReady, setI18nReady] = React.useState(false);

  React.useEffect(() => {
    const bootstrap = async () => {
      const config = await window.stemZipper.getConfiguration();
      setConfiguration(config);
      await initI18n(config.language);
      setI18nReady(true);
    };
    bootstrap().catch((error) => {
      console.error('Failed to bootstrap renderer', error);
    });
  }, []);

  if (!configuration || !i18nReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-slate-200">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-primary"></div>
        <p className="text-sm font-medium tracking-wide">Loading Stem ZIPper…</p>
      </div>
    );
  }

  return <AppContent configuration={configuration} />;
};

interface AppContentProps {
  configuration: AppConfiguration;
}

const AppContent: React.FC<AppContentProps> = ({ configuration }) => {
  const { t } = useTranslation();
  const [folder, setFolder] = React.useState('');
  const [maxSize, setMaxSize] = React.useState(configuration.defaultMaxSizeMb);
  const [analysis, setAnalysis] = React.useState<StemAnalysisEntry[]>([]);
  const [loadingAnalysis, setLoadingAnalysis] = React.useState(false);
  const [packing, setPacking] = React.useState(false);
  const [progress, setProgress] = React.useState<PackProgress | null>(null);
  const [notice, setNotice] = React.useState<NoticeState | null>(null);
  const [statusKey, setStatusKey] = React.useState<'ready' | 'done'>('ready');

  React.useEffect(() => {
    const unsubscribe = window.stemZipper.onProgress((value) => {
      setProgress(value);
    });
    return unsubscribe;
  }, []);

  const progressPercent = React.useMemo(() => {
    if (!progress || progress.total === 0) {
      return 0;
    }
    const percent = Math.round((progress.current / progress.total) * 100);
    return Math.max(0, Math.min(100, percent));
  }, [progress]);

  const statusMessage = React.useMemo(() => {
    if (packing && progress && progress.total > 0) {
      const archiveLabel = progress.archiveName ? `${progress.archiveName}.zip` : '';
      const percentLabel = progressPercent > 0 ? ` (${progressPercent}%)` : '';
      return `${t('status_packing', { archive: archiveLabel })}${percentLabel}`;
    }
    if (statusKey === 'done') {
      return t('status_done');
    }
    return t('ready');
  }, [packing, progress, progressPercent, statusKey, t]);

  const dismissNotice = React.useCallback(() => setNotice(null), []);

  const translateError = React.useCallback(
    (code: string, fallback: string) => {
      switch (code) {
        case 'NO_SUPPORTED_FILES':
          return t('msg_no_files');
        case 'INVALID_PATH':
          return t('msg_no_files');
        default:
          return fallback;
      }
    },
    [t]
  );

  const runAnalysis = React.useCallback(
    async (selectedFolder: string, sizeMb: number) => {
      setLoadingAnalysis(true);
      const response = await window.stemZipper.analyzeDirectory({ folder: selectedFolder, maxSizeMb: sizeMb });
      setLoadingAnalysis(false);
      if (!response.success) {
        setAnalysis([]);
        setNotice({ message: translateError(response.error.code, response.error.message), tone: 'error' });
        setStatusKey('ready');
        setProgress(null);
        return;
      }
      setAnalysis(response.data.files);
      setNotice(
        response.data.files.length > 0
          ? { message: t('found_files', { count: response.data.files.length }), tone: 'info' }
          : { message: t('msg_no_files'), tone: 'warning' }
      );
      setStatusKey('ready');
      setProgress(null);
    },
    [t, translateError]
  );

  const handleSelectFolder = async () => {
    const selected = await window.stemZipper.chooseDirectory();
    if (!selected) {
      return;
    }
    setFolder(selected);
    await runAnalysis(selected, maxSize);
    setStatusKey('ready');
  };

  const sanitizeMaxSize = React.useCallback(
    (value: number): number => {
      if (!Number.isFinite(value) || value <= 0) {
        setNotice({
          message: t('msg_invalid_max_size', {
            limit: configuration.maxSizeLimitMb,
            reset: configuration.defaultMaxSizeMb
          }),
          tone: 'warning'
        });
        return configuration.defaultMaxSizeMb;
      }
      if (value > configuration.maxSizeLimitMb) {
        setNotice({
          message: t('msg_invalid_max_size', {
            limit: configuration.maxSizeLimitMb,
            reset: configuration.maxSizeLimitMb
          }),
          tone: 'warning'
        });
        return configuration.maxSizeLimitMb;
      }
      return value;
    },
    [configuration.defaultMaxSizeMb, configuration.maxSizeLimitMb, t]
  );

  const handleMaxSizeBlur = async () => {
    const sanitized = sanitizeMaxSize(maxSize);
    setMaxSize(sanitized);
    if (folder) {
      await runAnalysis(folder, sanitized);
    }
  };

  const handlePack = async () => {
    if (!folder) {
      return;
    }
    setPacking(true);
    setStatusKey('ready');
    setProgress(null);
    const response = await window.stemZipper.packDirectory({ folder, maxSizeMb: maxSize });
    setPacking(false);
    if (!response.success) {
      setNotice({ message: translateError(response.error.code, response.error.message), tone: 'error' });
      setProgress(null);
      return;
    }
    setNotice({ message: t('msg_finished', { count: response.data.totalArchives }), tone: 'success' });
    setStatusKey('done');
    setProgress(null);
    await runAnalysis(folder, maxSize);
  };

  const handleCreateTestData = async () => {
    const target = await window.stemZipper.chooseDirectory();
    if (!target) {
      return;
    }
    const response = await window.stemZipper.createTestData({ outputDir: target });
    if (!response.success) {
      setNotice({ message: translateError(response.error.code, response.error.message), tone: 'error' });
      return;
    }
    setNotice({
      message: t('msg_testdata_done', { count: response.data.count, path: response.data.outputDir }),
      tone: 'success'
    });
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-8 py-8">
          <div>
            <h1 className="text-3xl font-semibold text-white">🎧 {t('app_title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">{t('header_label')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleSelectFolder}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              {t('select_folder')}
            </button>
            <div className="flex items-center gap-2">
              <label htmlFor="max-size" className="text-sm font-medium text-slate-200">
                {t('max_size_label')}
              </label>
              <input
                id="max-size"
                type="number"
                min={1}
                max={configuration.maxSizeLimitMb}
                step={1}
                value={maxSize}
                onChange={(event) => setMaxSize(Number(event.target.value))}
                onBlur={handleMaxSizeBlur}
                title={t('max_size_tooltip')}
                className="w-24 rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-right text-sm text-slate-100 shadow focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {folder ? (
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-400">{t('choose_folder')}</span>
                <span className="truncate text-sm text-slate-200" title={folder}>
                  {folder}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-8 py-8">
        <Notice show={Boolean(notice)} message={notice?.message ?? ''} tone={notice?.tone ?? 'info'} onDismiss={dismissNotice} />

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 shadow">
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-100">{t('pack_now')}</h2>
            <span className="text-sm text-slate-400">
              {t('found_files', { count: analysis.length })}
            </span>
          </div>
          <div className="relative">
            {loadingAnalysis ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-primary"></div>
              </div>
            ) : null}
            <div className="max-h-[400px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th scope="col" className="px-6 py-3">
                      {t('table_file')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-right">
                      {t('table_size')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-right">
                      {t('table_action')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm text-slate-200">
                  {analysis.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                        {folder ? t('msg_no_files') : t('choose_folder')}
                      </td>
                    </tr>
                  ) : (
                    analysis.map((file) => (
                      <tr key={file.fileName} className="hover:bg-slate-900/60">
                        <td className="px-6 py-3 font-medium">{file.fileName}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{file.sizeMb.toFixed(2)}</td>
                        <td className="px-6 py-3 text-right text-slate-300">{t(file.action)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 shadow">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('status_done')}</p>
              <p className="text-lg font-semibold text-slate-100">{statusMessage}</p>
            </div>
            <div className="flex w-full flex-col gap-3 md:w-1/2">
              <div className="h-2 w-full rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handlePack}
                  disabled={packing || analysis.length === 0}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed"
                >
                  {packing ? t('now_packing') : t('pack_now')}
                </button>
                {configuration.devMode ? (
                  <button
                    type="button"
                    onClick={handleCreateTestData}
                    className="inline-flex items-center justify-center rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200/30"
                  >
                    {t('create_testdata')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <footer className="py-6 text-center text-xs text-slate-500">
          Stem ZIPper v{configuration.version} · Max {configuration.maxSizeLimitMb} MB ·{' '}
          {configuration.supportedExtensions.join(', ')}
        </footer>
      </main>
    </div>
  );
};

export default App;
