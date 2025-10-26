import type { FileEntry } from '@common/ipc';
import type { ReactNode } from 'react';
import { FileRow } from './FileRow';

interface FileTableProps {
  files: FileEntry[];
  fileLabel: string;
  sizeLabel: string;
  actionLabel: string;
  actionNames: Record<FileEntry['action'], string>;
  emptyLabel: string;
  helperLabel: string;
  sizeUnitLabel: string;
  formatSize: (value: number) => string;
  renderBadge?: (file: FileEntry) => ReactNode;
}

export function FileTable({
  files,
  fileLabel,
  sizeLabel,
  actionLabel,
  actionNames,
  emptyLabel,
  helperLabel,
  sizeUnitLabel,
  formatSize,
  renderBadge
}: FileTableProps) {
  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/50 p-12 text-center text-slate-400">
        <div>
          <p className="text-lg font-semibold text-slate-200">{emptyLabel}</p>
          <p className="mt-2 text-sm text-slate-400">{helperLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80 shadow">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-900/90 text-slate-300">
          <tr>
            <th
              scope="col"
              className="w-7/12 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              {fileLabel}
            </th>
            <th
              scope="col"
              className="w-24 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              {actionLabel}
            </th>
            <th
              scope="col"
              className="w-32 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              {sizeLabel}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {files.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              actionName={actionNames[file.action]}
              sizeUnitLabel={sizeUnitLabel}
              formatSize={formatSize}
              renderBadge={renderBadge}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
