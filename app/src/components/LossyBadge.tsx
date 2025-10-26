import { MaterialIcon } from './icons/MaterialIcon';

interface LossyBadgeProps {
  label: string;
  tooltip: string;
}

export function LossyBadge({ label, tooltip }: LossyBadgeProps) {
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-200"
      title={tooltip}
      aria-label={tooltip}
    >
      <MaterialIcon icon="warning" className="h-4 w-4 text-amber-300" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}
