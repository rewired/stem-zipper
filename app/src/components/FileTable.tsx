import type { FileEntry } from '@common/ipc';

interface FileTableProps {
  files: FileEntry[];
  fileLabel: string;
  sizeLabel: string;
  actionLabel: string;
  actionNames: Record<FileEntry['action'], string>;
  emptyLabel: string;
  helperLabel: string;
  formatSize: (value: number) => string;
}

export function FileTable({
  files,
  fileLabel,
  sizeLabel,
  actionLabel,
  actionNames,
  emptyLabel,
  helperLabel,
  formatSize
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
            <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs text-slate-400">
              {fileLabel}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-xs text-slate-400">
              {sizeLabel}
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs text-slate-400">
              {actionLabel}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {files.map((file) => (
            <tr key={file.path} className="hover:bg-slate-800/50">
              <td className="px-4 py-3 text-slate-100">{file.name}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatSize(file.sizeMb)}</td>
              <td className="px-4 py-3 text-slate-300">{actionNames[file.action]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
