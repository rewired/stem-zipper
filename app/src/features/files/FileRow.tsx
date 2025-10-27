import clsx from 'clsx';
import type { ReactNode } from 'react';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import type { FileRow as FileRowModel } from '../../types/fileRow';
import { usePlayer } from '../player/PlayerProvider';
import { isPreviewable } from '../player/previewUtils';

interface FileRowProps {
  file: FileRowModel;
  actionName: string;
  sizeUnitLabel: string;
  formatSize: (value: number) => string;
  renderBadge?: (file: FileRowModel) => ReactNode;
  renderEstimate?: (file: FileRowModel) => ReactNode;
  onToggle: (fileId: string) => void;
  selectLabel: string;
  previewLabel: string;
  playLabel: string;
  previewUnavailableLabel: string;
  formatTooltip: (reason: string) => string;
  splitMonoHint: string;
}

export function FileRow({
  file,
  actionName,
  sizeUnitLabel,
  formatSize,
  renderBadge,
  renderEstimate,
  onToggle,
  selectLabel,
  previewLabel,
  playLabel,
  previewUnavailableLabel,
  formatTooltip,
  splitMonoHint
}: FileRowProps) {
  const player = usePlayer();
  const tooltip = file.estimate?.reason ? formatTooltip(file.estimate.reason) : undefined;
  const rowClass = clsx('hover:bg-slate-800/50', !file.selectable && 'opacity-50');
  const checkboxTitle = file.suggest_split_mono ? splitMonoHint : undefined;
  const previewable = isPreviewable(file);
  const isActivePreview = previewable && player.isOpen && player.file?.id === file.id;
  const previewButtonClasses = clsx(
    'inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-200 transition hover:bg-slate-700 focus-visible:ring focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
    isActivePreview && 'bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30',
    !previewable && 'cursor-not-allowed opacity-50 hover:bg-slate-800'
  );
  const buttonLabel = previewable ? playLabel : previewLabel;
  const previewTitle = previewable
    ? `${playLabel} — ${file.name}`
    : `${previewUnavailableLabel} — ${file.name}`;

  const handlePreviewClick = () => {
    if (!previewable) {
      return;
    }
    player.open(file);
  };

  return (
    <tr className={rowClass} key={file.id} aria-disabled={!file.selectable}>
      <td className="w-12 px-4 py-3">
        <div className="flex justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-emerald-400 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed"
            checked={file.selected}
            onChange={() => onToggle(file.id)}
            disabled={!file.selectable}
            aria-label={`${selectLabel} ${file.name}`}
            title={checkboxTitle}
          />
        </div>
      </td>
      <td className="w-12 px-4 py-3 text-center">
        <button
          type="button"
          onClick={handlePreviewClick}
          className={previewButtonClasses}
          disabled={!previewable}
          aria-label={buttonLabel}
          title={previewTitle}
        >
          <MaterialIcon icon="play_arrow" />
        </button>
      </td>
      <td className="w-5/12 px-4 py-3 text-slate-100">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">{file.name}</span>
          {renderBadge ? renderBadge(file) : null}
        </div>
      </td>
      <td className="w-28 px-4 py-3 text-right tabular-nums text-slate-200">
        {formatSize(file.sizeMb)} {sizeUnitLabel}
      </td>
      <td className="w-28 px-4 py-3 text-slate-300">{actionName}</td>
      <td className="w-44 px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {renderEstimate ? renderEstimate(file) : null}
          {tooltip ? (
            <MaterialIcon
              icon="info"
              className="h-4 w-4 text-slate-300"
              title={tooltip}
              aria-label={tooltip}
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
}
