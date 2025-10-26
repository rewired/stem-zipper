import type { FileEntry } from '@common/ipc';
import type { ReactNode } from 'react';

interface FileRowProps {
  file: FileEntry;
  actionName: string;
  sizeUnitLabel: string;
  formatSize: (value: number) => string;
  renderBadge?: (file: FileEntry) => ReactNode;
}

export function FileRow({ file, actionName, sizeUnitLabel, formatSize, renderBadge }: FileRowProps) {
  return (
    <tr className="hover:bg-slate-800/50" key={file.path}>
      <td className="w-7/12 px-4 py-3 text-slate-100">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">{file.name}</span>
          {renderBadge ? renderBadge(file) : null}
        </div>
      </td>
      <td className="w-24 px-4 py-3 text-slate-300">{actionName}</td>
      <td className="w-32 px-4 py-3 text-right tabular-nums text-slate-200">
        {formatSize(file.sizeMb)} {sizeUnitLabel}
      </td>
    </tr>
  );
}
