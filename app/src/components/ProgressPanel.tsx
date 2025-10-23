import type { PackProgress } from '@common/ipc';

interface ProgressPanelProps {
  progress: PackProgress;
  primaryText: string;
  primaryTooltip?: string;
  secondaryText?: string;
}

export function ProgressPanel({ progress, primaryText, primaryTooltip, secondaryText }: ProgressPanelProps) {
  const percent = Math.min(100, Math.max(0, progress.percent ?? 0));

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-5 py-4 shadow sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1" aria-live="polite">
          <span
            className="inline-flex items-center rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200"
            title={primaryTooltip ?? undefined}
          >
            {primaryText}
          </span>
          {secondaryText ? (
            <p className="text-xs text-slate-400">{secondaryText}</p>
          ) : null}
        </div>
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
