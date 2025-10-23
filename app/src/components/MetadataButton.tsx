import { clsx } from 'clsx';
import { MaterialIcon } from './icons/MaterialIcon';

interface MetadataButtonProps {
  onClick: () => void;
  label: string;
  badgeLabel: string;
  showBadge: boolean;
  disabled?: boolean;
}

export function MetadataButton({ onClick, label, badgeLabel, showBadge, disabled }: MetadataButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'relative inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 shadow transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
        disabled ? 'opacity-60' : 'hover:bg-slate-700'
      )}
      aria-label={label}
    >
      <MaterialIcon icon="description" />
      <span>{label}</span>
      {showBadge ? (
        <span
          aria-label={badgeLabel}
          title={badgeLabel}
          className="absolute -top-1 right-0 inline-flex h-3 w-3 items-center justify-center"
        >
          <span className="inline-flex h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_0_2px_rgba(15,23,42,1)]" />
        </span>
      ) : null}
    </button>
  );
}
