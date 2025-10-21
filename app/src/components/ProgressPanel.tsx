import type { PackProgress } from '@common/ipc';

interface ProgressPanelProps {
  progress: PackProgress;
  statusText: string;
}

export function ProgressPanel({ progress, statusText }: ProgressPanelProps) {
  const percent = Math.min(100, Math.max(0, progress.percent ?? 0));
  const label = statusText;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-5 py-4 shadow sm:px-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-xs uppercase tracking-wide text-slate-500">{percent}%</p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </section>
  );
}
