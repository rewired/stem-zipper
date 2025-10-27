import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode } from 'react';
import { DEFAULT_MAX_SIZE_MB } from '@common/constants';
import { formatMessage, resolveLocale, type LocaleKey } from '@common/i18n';
import type { FileRow } from '../types/fileRow';

interface AppStoreValue {
  locale: LocaleKey;
  maxSize: number | '';
  setMaxSize: (value: number | '') => void;
  folderPath: string | null;
  setFolderPath: (value: string | null) => void;
  files: FileRow[];
  setFiles: Dispatch<React.SetStateAction<FileRow[]>>;
  statusText: string;
  setStatusText: (text: string) => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

function detectInitialLocale(): LocaleKey {
  const languages = Array.isArray(navigator.languages) ? navigator.languages : [];
  const runtime = (window as unknown as { runtimeConfig?: { locale?: string } }).runtimeConfig;
  return resolveLocale(runtime?.locale, languages, navigator.language);
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const initialLocale = detectInitialLocale();
  const [locale] = useState<LocaleKey>(initialLocale);
  const [maxSize, setMaxSize] = useState<number | ''>(DEFAULT_MAX_SIZE_MB);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [statusText, setStatusText] = useState(() =>
    formatMessage(initialLocale, 'pack_status_ready')
  );

  const value = useMemo<AppStoreValue>(
    () => ({
      locale,
      maxSize,
      setMaxSize,
      folderPath,
      setFolderPath,
      files,
      setFiles,
      statusText,
      setStatusText
    }),
    [files, folderPath, locale, maxSize, statusText]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppStoreProvider');
  }
  return context;
}
