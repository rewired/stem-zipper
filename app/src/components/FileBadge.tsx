import { MaterialIcon } from './icons/MaterialIcon';

interface FileBadgeProps {
  label: string;
  tooltip?: string;
  icon?: 'warning' | 'info';
}

export function FileBadge({ label, tooltip, icon = 'warning' }: FileBadgeProps) {
  const accessibleLabel = tooltip ?? label;
  const resolvedTooltip = tooltip ?? label;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-200"
      title={resolvedTooltip}
      aria-label={accessibleLabel}
    >
      <MaterialIcon icon={icon} className="h-4 w-4 text-amber-300" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}
