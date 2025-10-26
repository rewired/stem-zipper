import { useCallback, useEffect, useMemo, useState, type DragEvent, type JSX } from 'react';
import { formatMessage, tNS, type TranslationKey } from '@common/i18n';
import type { PackMethod } from '@common/ipc';
import { APP_VERSION } from '@common/version';
import { MAX_SIZE_LIMIT_MB } from '@common/constants';
import type { FileEntry } from '@common/ipc';
import { FileToolbar } from '../features/files/FileToolbar';
import { FileTable } from '../features/files/FileTable';
import { PackControls } from '../features/pack/PackControls';
import { ProgressToastBridge } from '../features/pack/ProgressToastBridge';
import { useAppStore } from '../store/appStore';
import { usePackState } from '../features/pack/usePackState';
import { useMetadata } from '../features/metadata/useMetadata';
import { MetadataModal } from '../features/metadata/MetadataModal';
import { ProgressPanel } from '../components/ProgressPanel';
import { ChoiceModal } from '../components/ChoiceModal';
import { InfoModal } from '../components/InfoModal';
import { FileBadge } from '../components/FileBadge';
import { DiagOverlay } from '../components/DiagOverlay';
import { useZipEstimator } from '../hooks/useZipEstimator';

export function AppShell() {
  const { locale, files, folderPath, maxSize, setMaxSize, statusText } = useAppStore();
  const {
    progress,
    isPacking,
    packMethod,
    setPackMethod,
    isRevealOpen,
    setIsRevealOpen,
    lastPackCount,
    isOverwriteOpen,
    setIsOverwriteOpen,
    isOverwriteWarnOpen,
    selectFolder,
    handleMaxSizeBlur,
    performPack,
    confirmOverwriteAndPack,
    confirmOverwriteWarning,
    cancelOverwriteWarning,
    handleDropPath,
    isDragActive,
    setIsDragActive,
    createTestData
  } = usePackState();
  const {
    isMetadataOpen,
    metadataIntent,
    metadataSaving,
    currentDraft,
    userPrefs,
    openMetadata,
    closeMetadata,
    handleMetadataChange,
    handleRememberDefaultChange,
    handleAutoAttributionChange,
    metadataMissingRequired,
    saveMetadata
  } = useMetadata();
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const t = useCallback(
    (key: TranslationKey, params: Record<string, string | number> = {}) =>
      formatMessage(locale, key, params),
    [locale]
  );

  useEffect(() => {
    document.title = `${formatMessage(locale, 'app_title')} ${APP_VERSION}`;
  }, [locale]);

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

  const { badges } = useZipEstimator(files, { maxSizeMb: maxSize });
  const noZipGainLabel = useMemo(() => t('badge_no_zip_gain'), [t]);
  const noZipGainHint = useMemo(() => t('badge_no_zip_gain_hint'), [t]);
  const considerVolumesLabel = useMemo(() => t('badge_consider_7z_volumes'), [t]);

  const packLabel = useMemo(
    () => tNS('app', 'btn_pack_now', undefined, locale),
    [locale]
  );

  const renderFileBadges = useCallback(
    (file: FileEntry) => {
      const flags = badges.get(file.path);
      if (!flags) {
        return null;
      }
      const elements: JSX.Element[] = [];
      if (flags.noZipGain) {
        elements.push(
          <FileBadge
            key="no-zip-gain"
            label={noZipGainLabel}
            tooltip={noZipGainHint}
            variant="info"
            icon="info"
          />
        );
      }
      if (flags.consider7zVolumes) {
        elements.push(<FileBadge key="consider-7z" label={considerVolumesLabel} />);
      }
      if (elements.length === 0) {
        return null;
      }
      return <span className="flex flex-wrap justify-end gap-1">{elements}</span>;
    },
    [badges, considerVolumesLabel, noZipGainHint, noZipGainLabel]
  );

  const packMethodLabel = t('pack_method_label');
  const packMethodOptions = useMemo(
    () => [
      { value: 'zip_best_fit' as PackMethod, label: t('pack_method_zip_best_fit') },
      { value: 'seven_z_split' as PackMethod, label: t('pack_method_seven_z_split') }
    ],
    [t]
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(true);
    },
    [setIsDragActive]
  );

  const onDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(false);
    },
    [setIsDragActive]
  );

  const onDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      const item = event.dataTransfer.files?.[0] as (File & { path?: string }) | undefined;
      const itemPath = item?.path;
      if (itemPath) {
        await handleDropPath(itemPath);
      }
    },
    [handleDropPath, setIsDragActive]
  );

  const handleMetadataSave = useCallback(
    async (intent: 'save' | 'save_and_pack') => {
      const result = await saveMetadata(intent);
      if (intent === 'save_and_pack' && result === 'saved') {
        await performPack();
      }
    },
    [performPack, saveMetadata]
  );

  const handleOpenMetadata = useCallback(() => {
    if (!folderPath) {
      return;
    }
    openMetadata('idle');
  }, [folderPath, openMetadata]);

  const canPack = Boolean(folderPath && files.length > 0 && !isPacking && typeof maxSize === 'number');
  const isDevMode =
    (window as unknown as { runtimeConfig?: { devMode?: boolean } }).runtimeConfig?.devMode ||
    import.meta.env.DEV;
  const hasElectronAPI = Boolean((window as unknown as { electronAPI?: unknown }).electronAPI);
  const hasRuntimeConfig = Boolean((window as unknown as { runtimeConfig?: unknown }).runtimeConfig);

  const infoModalContent = useMemo(
    () => (
      <>
        <p>© 2025 Björn Ahlers — MIT License</p>
        <p className="mt-4">
          Get the source code at:{' '}<br />
          <a
            href="https://github.com/rewired/stem-zipper"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            onClick={(event) => {
              event.preventDefault();
              if (!window.electronAPI || typeof window.electronAPI.openExternal !== 'function') {
                console.error('Failed to open external link: API not available');
                return;
              }
              window.electronAPI
                .openExternal('https://github.com/rewired/stem-zipper')
                .catch((error: unknown) => {
                  console.error('Failed to open external link', error);
                });
            }}
          >
            https://github.com/rewired/stem-zipper
          </a>
        </p>
        <p className="mt-4">
          Music by 7OOP3D at ccMixter:{' '}<br />
          <a
            href="https://ccmixter.org/people/7OOP3D"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            onClick={(event) => {
              event.preventDefault();
              if (!window.electronAPI || typeof window.electronAPI.openExternal !== 'function') {
                console.error('Failed to open external link: API not available');
                return;
              }
              window.electronAPI
                .openExternal('https://ccmixter.org/people/7OOP3D')
                .catch((error: unknown) => {
                  console.error('Failed to open external link', error);
                });
            }}
          >
            https://ccmixter.org/people/7OOP3D
          </a>
        </p>
      </>
    ),
    []
  );

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-950 text-slate-50"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <FileToolbar
        title={t('app_title')}
        version={APP_VERSION}
        folderPath={folderPath}
        selectLabel={t('app_select_folder_label')}
        browseLabel={t('app_select_hint')}
        maxSizeLabel={t('app_max_size_label')}
        maxSizeTooltip={t('app_max_size_tooltip')}
        maxSize={maxSize}
        maxSizeLimit={MAX_SIZE_LIMIT_MB}
        onSelectFolder={selectFolder}
        onMaxSizeChange={setMaxSize}
        onMaxSizeBlur={handleMaxSizeBlur}
        dropHelper={t('app_drop_helper')}
      />
      <main className="flex min-h-0 flex-1 flex-col">
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
            renderBadge={renderFileBadges}
          />
        </div>
        <div className="sticky bottom-0 z-30 border-t border-slate-800 bg-slate-950/90 px-8 py-4 backdrop-blur">
          <div className="space-y-4">
            <ProgressPanel progress={progress} statusText={statusText} />
            <PackControls
              canPack={canPack}
              isPacking={isPacking}
              packLabel={packLabel}
              onPack={performPack}
              onExit={() => window.close()}
              exitLabel={t('common_exit')}
              infoLabel={t('app_about_label')}
              onShowInfo={() => setIsInfoOpen(true)}
              metadataLabel={t('btn_metadata_open')}
              metadataBadgeLabel={t('badge_metadata_missing_required')}
              showMetadataBadge={metadataMissingRequired}
              metadataDisabled={!folderPath || isPacking}
              onShowMetadata={handleOpenMetadata}
              devMode={isDevMode}
              onCreateTestData={isDevMode ? createTestData : undefined}
              createTestDataLabel={t('dev_action_create_test_data')}
              packMethod={packMethod}
              packMethodLabel={packMethodLabel}
              packMethodOptions={packMethodOptions}
              onPackMethodChange={setPackMethod}
            />
          </div>
        </div>
      </main>
      <ProgressToastBridge />
      {isMetadataOpen && folderPath && currentDraft ? (
        <MetadataModal
          modalTitle={t('modal_metadata_title')}
          draft={currentDraft.data}
          rememberDefault={currentDraft.rememberDefault}
          lastAutoAttribution={currentDraft.lastAutoAttribution}
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
            closeMetadata();
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
          onPrimary={confirmOverwriteWarning}
          onSecondary={cancelOverwriteWarning}
        />
      ) : null}
      {isOverwriteOpen ? (
        <ChoiceModal
          title={t('dialog_overwrite_title')}
          text={t('dialog_overwrite_text')}
          primaryLabel={t('pack_action_start')}
          secondaryLabel={t('common_close')}
          onPrimary={confirmOverwriteAndPack}
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
              window.electronAPI
                .openPath(folderPath)
                .catch((error: unknown) => console.error(error));
            }
          }}
          onSecondary={() => setIsRevealOpen(false)}
        />
      ) : null}
      {isDragActive ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm">
          <div className="rounded-xl border border-blue-400/60 bg-slate-900/90 px-10 py-6 text-center text-lg font-semibold text-blue-100 shadow-xl">
            {t('app_drop_helper')}
          </div>
        </div>
      ) : null}
      <DiagOverlay hasElectronAPI={hasElectronAPI} hasRuntimeConfig={hasRuntimeConfig} isDev={isDevMode} />
    </div>
  );
}
