import { clsx } from 'clsx';

interface ActionBarProps {
  onPack: () => void;
  onExit: () => void;
  onCreateTestData?: () => void;
  canPack: boolean;
  isPacking: boolean;
  packLabel: string;
  exitLabel: string;
  createTestDataLabel: string;
  devMode: boolean;
}

export function ActionBar({
  onPack,
  onExit,
  onCreateTestData,
  canPack,
  isPacking,
  packLabel,
  exitLabel,
  createTestDataLabel,
  devMode
}: ActionBarProps) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPack}
          disabled={!canPack || isPacking}
          className={clsx(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
            canPack && !isPacking
              ? 'bg-emerald-500 text-white hover:bg-emerald-400 focus-visible:outline-emerald-300'
              : 'cursor-not-allowed bg-slate-700 text-slate-300 opacity-70'
          )}
        >
          <span aria-hidden>📦</span>
          {isPacking ? `${packLabel}…` : packLabel}
        </button>
        {devMode && onCreateTestData ? (
          <button
            type="button"
            onClick={onCreateTestData}
            className="inline-flex items-center gap-2 rounded-md border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <span aria-hidden>🧪</span>
            {createTestDataLabel}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onExit}
        className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        <span aria-hidden>🚪</span>
        {exitLabel}
      </button>
    </div>
  );
}
