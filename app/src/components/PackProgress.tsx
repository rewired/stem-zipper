import type { PackProgressView } from '../features/pack/usePackState';

interface PackProgressProps {
  progress: PackProgressView;
  statusText: string;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 100) {
    return 100;
  }
  return value;
}

export function PackProgress({ progress, statusText }: PackProgressProps) {
  const phase = progress.phase;
  const inFlight = phase === 'preparing' || phase === 'packing' || phase === 'finalizing';
  const percent = inFlight ? clampPercent(progress.percent) : clampPercent(progress.percent || 0);
  const label = inFlight ? progress.label || statusText : statusText;

  if (phase === 'error') {
    const detail = progress.errorMessage ?? (statusText !== progress.label ? statusText : null);
    return (
      <section className="rounded-lg border border-red-700/70 bg-red-950/50 px-5 py-4 text-red-200 shadow">
        <p className="text-sm font-semibold">
          {progress.label || statusText}
        </p>
        {detail ? <p className="mt-1 text-xs text-red-200/80">{detail}</p> : null}
      </section>
    );
  }

  if (phase === 'done') {
    return (
      <section className="rounded-lg border border-emerald-700/60 bg-emerald-900/30 px-5 py-4 text-emerald-200 shadow">
        <p className="text-sm font-semibold">{statusText}</p>
        {progress.label && (
          <p className="mt-1 text-xs text-emerald-200/80">{progress.label}</p>
        )}
      </section>
    );
  }

  if (inFlight) {
    return (
      <section className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-5 py-4 shadow sm:px-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-200">{label}</p>
          <p className="text-xs uppercase tracking-wide text-slate-400">{Math.round(percent)}%</p>
        </div>
        <div
          className="h-3 overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        {progress.archiveLabel ? (
          <p className="text-xs text-slate-400" data-testid="pack-progress-archive">
            {progress.archiveLabel}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 px-5 py-4 text-slate-200 shadow">
      <p className="text-sm font-medium">{statusText}</p>
    </section>
  );
}
