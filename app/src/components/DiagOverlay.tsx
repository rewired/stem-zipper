import React from 'react';

type Props = {
  hasElectronAPI: boolean;
  hasRuntimeConfig: boolean;
  isDev: boolean;
};

export function DiagOverlay({ hasElectronAPI, hasRuntimeConfig, isDev }: Props) {
  const show = !hasElectronAPI || !hasRuntimeConfig;
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4">
      <div className="mt-8 w-full max-w-2xl rounded-xl border border-red-500/40 bg-slate-900/95 p-5 text-red-100 shadow-2xl backdrop-blur">
        <h2 className="text-lg font-semibold text-red-300">Diagnostics: Preload/Bridge Unavailable</h2>
        <p className="mt-2 text-sm text-slate-200">
          The renderer could not access the Electron preload bridge. The app UI may be limited.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
          <div>
            <span className="font-mono text-slate-300">window.electronAPI</span>: {String(hasElectronAPI)}
          </div>
          <div>
            <span className="font-mono text-slate-300">window.runtimeConfig</span>: {String(hasRuntimeConfig)}
          </div>
          <div>
            <span className="font-mono text-slate-300">mode</span>: {isDev ? 'dev' : 'prod'}
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-100">
          <p className="font-medium text-slate-200">How to fix</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {isDev ? (
              <>
                <li>Run <span className="font-mono">pnpm run dev:start</span> from the <span className="font-mono">app</span> folder.</li>
                <li>Ensure <span className="font-mono">electron/tsconfig.preload.json</span> compiles the preload to <span className="font-mono">dist-electron/preload</span>.</li>
              </>
            ) : (
              <>
                <li>Build before packaging: <span className="font-mono">pnpm run build</span> or <span className="font-mono">pnpm run preview</span>.</li>
                <li>Verify packaged files contain <span className="font-mono">dist-renderer/index.html</span> and <span className="font-mono">dist-electron/preload/electron/preload.js</span>.</li>
              </>
            )}
            <li>
              Check <span className="font-mono">main.ts</span> preload path resolution and CSP in <span className="font-mono">index.html</span> if issues persist.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

