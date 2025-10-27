import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { formatMessage, type TranslationKey } from '@common/i18n';
import type { PackMetadata, UserPrefsResponse } from '@common/ipc';
import {
  buildPackMetadata,
  createEmptyDraft,
  hasRequiredMetadata,
  mergeDraftData,
  updateAutoAttribution,
  type MetadataDraftData,
  type MetadataDraftState
} from '../../state/metadataStore';
import { useToast } from '../../providers/ToastProvider';
import { useAppStore } from '../../store/appStore';

interface MetadataUserPrefs {
  defaultArtist?: string;
  defaultArtistUrl?: string;
  defaultContactEmail?: string;
  recentArtists: string[];
}

interface MetadataContextValue {
  isMetadataOpen: boolean;
  metadataIntent: 'idle' | 'pack';
  metadataSaving: boolean;
  currentDraft: MetadataDraftState | null;
  userPrefs: MetadataUserPrefs;
  openMetadata: (intent?: 'idle' | 'pack') => void;
  closeMetadata: () => void;
  handleMetadataChange: (updates: Partial<MetadataDraftData>) => void;
  handleRememberDefaultChange: (remember: boolean) => void;
  handleAutoAttributionChange: (value: string | undefined) => void;
  ensureDraft: (folder: string) => void;
  metadataMissingRequired: boolean;
  saveMetadata: (intent: 'save' | 'save_and_pack') => Promise<'saved' | 'validation_error' | 'idle'>;
  getPackMetadata: () => PackMetadata | null;
}

const MetadataContext = createContext<MetadataContextValue | null>(null);

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

export function MetadataProvider({ children }: { children: ReactNode }) {
  const { folderPath, files, locale, setStatusText } = useAppStore();
  const [metadataDrafts, setMetadataDrafts] = useState<Record<string, MetadataDraftState>>({});
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [metadataIntent, setMetadataIntent] = useState<'idle' | 'pack'>('idle');
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [userPrefs, setUserPrefs] = useState<MetadataUserPrefs>({
    defaultArtist: undefined,
    defaultArtistUrl: undefined,
    defaultContactEmail: undefined,
    recentArtists: []
  });
  const { show: showToast } = useToast();

  const t = useCallback(
    (key: TranslationKey, params: Record<string, string | number> = {}) =>
      formatMessage(locale, key, params),
    [locale]
  );

  const ensureDraft = useCallback((folder: string) => {
    setMetadataDrafts((prev) => {
      if (prev[folder]) {
        return prev;
      }
      return { ...prev, [folder]: createEmptyDraft() };
    });
  }, []);

  const updateDraft = useCallback(
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

  const openMetadata = useCallback(
    (intent: 'idle' | 'pack' = 'idle') => {
      if (!folderPath) {
        return;
      }
      ensureDraft(folderPath);
      setMetadataIntent(intent);
      setIsMetadataOpen(true);
      updateDraft(folderPath, (draft) => ({ ...draft, everOpened: true }));
    },
    [ensureDraft, folderPath, updateDraft]
  );

  const closeMetadata = useCallback(() => {
    setIsMetadataOpen(false);
    setMetadataIntent('idle');
  }, []);

  const handleMetadataChange = useCallback(
    (updates: Partial<MetadataDraftData>) => {
      if (!folderPath) {
        return;
      }
      updateDraft(folderPath, (draft) => mergeDraftData(draft, updates));
    },
    [folderPath, updateDraft]
  );

  const handleRememberDefaultChange = useCallback(
    (remember: boolean) => {
      if (!folderPath) {
        return;
      }
      updateDraft(folderPath, (draft) => ({ ...draft, rememberDefault: remember }));
    },
    [folderPath, updateDraft]
  );

  const handleAutoAttributionChange = useCallback(
    (value: string | undefined) => {
      if (!folderPath) {
        return;
      }
      updateDraft(folderPath, (draft) => updateAutoAttribution(draft, value));
    },
    [folderPath, updateDraft]
  );

  useEffect(() => {
    if (!window.electronAPI || typeof window.electronAPI.getUserPrefs !== 'function') {
      return;
    }
    window.electronAPI
      .getUserPrefs({})
      .then((prefs: UserPrefsResponse) => {
        setUserPrefs({
          defaultArtist: prefs?.default_artist?.trim() || undefined,
          defaultArtistUrl: prefs?.default_artist_url?.trim() || undefined,
          defaultContactEmail: prefs?.default_contact_email?.trim() || undefined,
          recentArtists: dedupeRecentArtists(prefs?.recent_artists ?? [])
        });
      })
      .catch((error: unknown) => {
        console.warn('Failed to load user preferences', error);
      });
  }, []);

  const currentDraft = folderPath ? metadataDrafts[folderPath] ?? null : null;

  const metadataMissingRequired = Boolean(folderPath) &&
    (!currentDraft || !hasRequiredMetadata(currentDraft.data));

  useEffect(() => {
    if (!folderPath || !files.length || isMetadataOpen) {
      return;
    }
    const draft = metadataDrafts[folderPath];
    if (!draft) {
      return;
    }
    if (!draft.everOpened && !hasRequiredMetadata(draft.data)) {
      openMetadata('idle');
    }
  }, [files.length, folderPath, isMetadataOpen, metadataDrafts, openMetadata]);

  const getPackMetadata = useCallback((): PackMetadata | null => {
    if (!folderPath) {
      return null;
    }
    const draft = metadataDrafts[folderPath];
    if (!draft) {
      return null;
    }
    try {
      return buildPackMetadata(draft.data);
    } catch (error) {
      console.warn('Failed to build pack metadata', error);
      return null;
    }
  }, [folderPath, metadataDrafts]);

  const saveMetadata = useCallback(
    async (intent: 'save' | 'save_and_pack') => {
      if (!folderPath) {
        return 'idle';
      }
      const draft = metadataDrafts[folderPath] ?? createEmptyDraft();
      let metadata: PackMetadata;
      try {
        metadata = buildPackMetadata(draft.data);
      } catch (error) {
        console.warn('Metadata validation failed before saving', error);
        setStatusText(t('btn_pack_disabled_missing_required'));
        return 'validation_error';
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
        updateDraft(folderPath, (current) => ({
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
          return 'saved';
        }
        return 'saved';
      } catch (error) {
        console.error('Failed to persist metadata preferences', error);
        setStatusText(t('common_error_title'));
        return 'idle';
      } finally {
        setMetadataSaving(false);
      }
    },
    [folderPath, metadataDrafts, setStatusText, showToast, t, updateDraft]
  );

  const value = useMemo<MetadataContextValue>(
    () => ({
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
      ensureDraft,
      metadataMissingRequired,
      saveMetadata,
      getPackMetadata
    }),
    [
      closeMetadata,
      currentDraft,
      ensureDraft,
      getPackMetadata,
      handleAutoAttributionChange,
      handleMetadataChange,
      handleRememberDefaultChange,
      isMetadataOpen,
      metadataIntent,
      metadataMissingRequired,
      metadataSaving,
      openMetadata,
      saveMetadata,
      userPrefs
    ]
  );

  return <MetadataContext.Provider value={value}>{children}</MetadataContext.Provider>;
}

export function useMetadata(): MetadataContextValue {
  const context = useContext(MetadataContext);
  if (!context) {
    throw new Error('useMetadata must be used within a MetadataProvider');
  }
  return context;
}
