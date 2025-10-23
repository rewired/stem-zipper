import type Store from 'electron-store';

type ElectronStoreModule = typeof import('electron-store');
type ElectronStoreConstructor = ElectronStoreModule['default'];

// TypeScript transpiles `import()` calls to `require()` in our CommonJS bundle, which
// fails against the ESM-only electron-store package. Using `new Function` keeps the
// dynamic import intact so Node can resolve the module at runtime.
// eslint-disable-next-line no-new-func
const dynamicImportElectronStore = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<ElectronStoreModule>;

let electronStoreConstructorPromise: Promise<ElectronStoreConstructor> | null = null;

export async function loadElectronStore(): Promise<ElectronStoreConstructor> {
  if (!electronStoreConstructorPromise) {
    electronStoreConstructorPromise = dynamicImportElectronStore('electron-store').then((module) => {
      const ElectronStore = module?.default as ElectronStoreConstructor | undefined;
      if (!ElectronStore) {
        throw new Error('electron-store default export is not available');
      }
      return ElectronStore;
    });
  }
  return electronStoreConstructorPromise;
}

export function __resetElectronStoreLoaderForTests(): void {
  electronStoreConstructorPromise = null;
}

export type { Store as ElectronPreferencesStore };
