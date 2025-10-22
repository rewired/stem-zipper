import type { ChangeEvent } from 'react';
import { clsx } from 'clsx';
import { MaterialIcon } from './icons/MaterialIcon';

interface HeaderProps {
  title: string;
  folderPath: string | null;
  selectLabel: string;
  browseLabel: string;
  maxSizeLabel: string;
  maxSizeTooltip: string;
  maxSize: number | '';
  maxSizeLimit: number;
  onSelectFolder: () => void;
  onMaxSizeChange: (value: number | '') => void;
  onMaxSizeBlur: () => void;
  dropHelper: string;
}

export function Header({
  title,
  folderPath,
  selectLabel,
  browseLabel,
  maxSizeLabel,
  maxSizeTooltip,
  maxSize,
  maxSizeLimit,
  onSelectFolder,
  onMaxSizeChange,
  onMaxSizeBlur,
  dropHelper
}: HeaderProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value === '') {
      onMaxSizeChange('');
      return;
    }
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      onMaxSizeChange(parsed);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 px-8 py-6 backdrop-blur">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="md:flex-1">
          <div className="flex items-center gap-3 text-2xl font-semibold text-slate-50">
            <MaterialIcon icon="inventory_2" className="h-8 w-8 text-blue-300" title={title} />
            <span>{title}</span>
          </div>
          <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">{dropHelper}</p>
          <p
            className={clsx(
              'mt-2 w-full max-w-4xl overflow-x-auto whitespace-nowrap rounded bg-slate-800/80 px-3 py-2 text-sm shadow-inner',
              folderPath ? 'text-slate-200' : 'text-slate-500 italic'
            )}
            aria-live="polite"
            title={folderPath ?? undefined}
          >
            {folderPath ?? browseLabel}
          </p>
        </div>
        <div className="flex flex-col items-start gap-4 md:items-end">
          <button
            type="button"
            onClick={onSelectFolder}
            className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
          >
            <MaterialIcon icon="folder_open" />
            {selectLabel}
          </button>
          <div className="flex items-center gap-3 text-sm text-slate-200">
            <label htmlFor="max-size" className="font-medium">
              {maxSizeLabel}
            </label>
            <input
              id="max-size"
              type="number"
              min={1}
              max={maxSizeLimit}
              step={1}
              value={maxSize}
              onChange={handleChange}
              onBlur={onMaxSizeBlur}
              className="w-28 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-right text-sm text-slate-100 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              title={maxSizeTooltip}
            />
          </div>
          <p className="text-xs text-slate-400">{browseLabel}</p>
        </div>
      </div>
    </header>
  );
}
