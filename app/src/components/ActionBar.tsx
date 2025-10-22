import { clsx } from 'clsx';
import { MaterialIcon } from './icons/MaterialIcon';

interface ActionBarProps {
  onPack: () => void;
  onExit: () => void;
  onCreateTestData?: () => void;
  onShowInfo?: () => void;
  canPack: boolean;
  isPacking: boolean;
  packLabel: string;
  exitLabel: string;
  createTestDataLabel: string;
  devMode: boolean;
  infoLabel: string;
}

export function ActionBar({
  onPack,
  onExit,
  onCreateTestData,
  onShowInfo,
  canPack,
  isPacking,
  packLabel,
  exitLabel,
  createTestDataLabel,
  devMode,
  infoLabel
}: ActionBarProps) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPack}
            disabled={!canPack || isPacking}
            className={clsx(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              canPack && !isPacking
                ? 'bg-blue-500 text-white hover:bg-blue-400 focus-visible:outline-blue-300'
                : 'cursor-not-allowed bg-slate-700 text-slate-300 opacity-70'
            )}
          >
            <MaterialIcon icon="inventory_2" />
            {isPacking ? `${packLabel}…` : packLabel}
          </button>
          {onShowInfo ? (
            <button
              type="button"
              onClick={onShowInfo}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 shadow transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              aria-label={infoLabel}
              title={infoLabel}
            >
              <MaterialIcon icon="info" />
              <span>{infoLabel}</span>
            </button>
          ) : null}
        </div>
        {devMode && onCreateTestData ? (
          <button
            type="button"
            onClick={onCreateTestData}
            className="inline-flex items-center gap-2 rounded-md border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <MaterialIcon icon="science" />
            {createTestDataLabel}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onExit}
        className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        <MaterialIcon icon="logout" />
        {exitLabel}
      </button>
    </div>
  );
}
