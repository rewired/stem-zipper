import clsx from 'clsx';
import { useEffect, useRef, type ReactNode } from 'react';
import { FileRow } from './FileRow';
import type { FileRow as FileRowModel } from '../../types/fileRow';

interface FileTableProps {
  files: FileRowModel[];
  fileLabel: string;
  sizeLabel: string;
  actionLabel: string;
  actionNames: Record<FileRowModel['action'], string>;
  emptyLabel: string;
  helperLabel: string;
  sizeUnitLabel: string;
  formatSize: (value: number) => string;
  renderBadge?: (file: FileRowModel) => ReactNode;
  renderEstimate?: (file: FileRowModel) => ReactNode;
  onToggleRow: (fileId: string) => void;
  onToggleAll: () => void;
  selectLabel: string;
  selectAllLabel: string;
  previewLabel: string;
  estimateLabel: string;
  masterChecked: boolean;
  masterIndeterminate: boolean;
  masterDisabled: boolean;
  formatTooltip: (reason: string) => string;
  splitMonoHint: string;
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
  renderBadge,
  renderEstimate,
  onToggleRow,
  onToggleAll,
  selectLabel,
  selectAllLabel,
  previewLabel,
  estimateLabel,
  masterChecked,
  masterIndeterminate,
  masterDisabled,
  formatTooltip,
  splitMonoHint
}: FileTableProps) {
  const masterCheckboxRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!masterCheckboxRef.current) {
      return;
    }
    masterCheckboxRef.current.indeterminate = masterIndeterminate && !masterChecked;
  }, [masterChecked, masterIndeterminate]);

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

  const masterCheckboxClasses = clsx(
    'h-4 w-4 rounded border border-slate-600 bg-slate-900 text-emerald-400 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed',
    masterDisabled && 'opacity-50'
  );

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80 shadow">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-900/90 text-slate-300">
          <tr>
            <th
              scope="col"
              className="w-12 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              <div className="flex items-center justify-center">
                <span className="sr-only">{selectLabel}</span>
                <input
                  ref={masterCheckboxRef}
                  type="checkbox"
                  className={masterCheckboxClasses}
                  checked={masterChecked}
                  onChange={() => {
                    if (masterDisabled) {
                      return;
                    }
                    onToggleAll();
                  }}
                  disabled={masterDisabled}
                  aria-label={selectAllLabel}
                />
              </div>
            </th>
            <th scope="col" className="w-12 px-4 py-3 text-center">
              <span className="sr-only">{previewLabel}</span>
            </th>
            <th
              scope="col"
              className="w-5/12 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              {fileLabel}
            </th>
            <th
              scope="col"
              className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              {sizeLabel}
            </th>
            <th
              scope="col"
              className="w-28 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              {actionLabel}
            </th>
            <th scope="col" className="w-44 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span className="sr-only">{estimateLabel}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              actionName={actionNames[file.action]}
              sizeUnitLabel={sizeUnitLabel}
              formatSize={formatSize}
              renderBadge={renderBadge}
              renderEstimate={renderEstimate}
              onToggle={onToggleRow}
              selectLabel={selectLabel}
              previewLabel={previewLabel}
              formatTooltip={formatTooltip}
              splitMonoHint={splitMonoHint}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
