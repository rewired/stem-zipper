declare module 'react-router-dom' {
  import type { ReactNode } from 'react';

  export function createHashRouter(...args: unknown[]): unknown;

  export interface RouterProviderProps {
    router: unknown;
    fallbackElement?: ReactNode;
    future?: unknown;
    [key: string]: unknown;
  }

  export function RouterProvider(props: RouterProviderProps): JSX.Element;
}
