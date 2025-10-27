import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AppStoreProvider } from '../store/appStore';
import { MetadataProvider } from '../features/metadata/useMetadata';
import { PackStateProvider } from '../features/pack/usePackState';
import { AppShell } from './AppShell';
import { PlayerProvider } from '../features/player';

const router = createHashRouter([
  {
    path: '/',
    element: (
          <AppStoreProvider>
            <MetadataProvider>
              <PackStateProvider>
                <PlayerProvider>
                  <AppShell />
                </PlayerProvider>
              </PackStateProvider>
            </MetadataProvider>
          </AppStoreProvider>
    )
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
