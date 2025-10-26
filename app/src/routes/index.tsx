import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AppStoreProvider } from '../store/appStore';
import { MetadataProvider } from '../features/metadata/useMetadata';
import { PackStateProvider } from '../features/pack/usePackState';
import { AppShell } from './AppShell';

const router = createHashRouter([
  {
    path: '/',
    element: (
      <AppStoreProvider>
        <MetadataProvider>
          <PackStateProvider>
            <AppShell />
          </PackStateProvider>
        </MetadataProvider>
      </AppStoreProvider>
    )
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
