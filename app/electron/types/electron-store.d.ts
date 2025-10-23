declare module 'electron-store' {
  type StoreKey<T> = T extends object ? Extract<keyof T, string> : string;

  export interface ElectronStoreOptions<T> {
    cwd?: string;
    name?: string;
    defaults?: T;
    encryptionKey?: string | Buffer;
  }

  export default class ElectronStore<T = Record<string, unknown>> {
    constructor(options?: ElectronStoreOptions<T>);
    public get<Key extends StoreKey<T>>(key: Key): Key extends keyof T ? T[Key] : unknown;
    public get<Key extends StoreKey<T>>(key: Key, defaultValue: Key extends keyof T ? NonNullable<T[Key]> : unknown): Key extends keyof T ? NonNullable<T[Key]> : unknown;
    public get<Result = unknown>(key: string, defaultValue?: Result): Result;
    public set<Key extends StoreKey<T>>(key: Key, value: Key extends keyof T ? T[Key] : unknown): void;
    public set(key: string, value: unknown): void;
    public delete<Key extends StoreKey<T>>(key: Key): void;
    public delete(key: string): void;
  }
}
