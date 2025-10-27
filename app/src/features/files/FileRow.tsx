import clsx from 'clsx';
import type { ReactNode } from 'react';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import type { FileRow as FileRowModel } from '../../types/fileRow';

interface FileRowProps {
  file: FileRowModel;
  actionName: string;
  sizeUnitLabel: string;
  formatSize: (value: number) => string;
  renderBadge?: (file: FileRowModel) => ReactNode;
  renderEstimate?: (file: FileRowModel) => ReactNode;
  onToggle: (fileId: string) => void;
  selectLabel: string;
  formatTooltip: (reason: string) => string;
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
  formatTooltip
}: FileRowProps) {
  const tooltip = file.estimate?.reason ? formatTooltip(file.estimate.reason) : undefined;
  const rowClass = clsx('hover:bg-slate-800/50', !file.selectable && 'opacity-50');

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
          />
        </div>
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
