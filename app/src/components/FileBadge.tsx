import { clsx } from 'clsx';
import { MaterialIcon } from './icons/MaterialIcon';

type FileBadgeVariant = 'warning' | 'info';

interface FileBadgeProps {
  label: string;
  tooltip?: string;
  icon?: 'warning' | 'info';
  variant?: FileBadgeVariant;
}

const variantStyles: Record<FileBadgeVariant, string> = {
  warning: 'rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-200',
  info: 'badge badge-info'
};

const iconStyles: Record<FileBadgeVariant, string> = {
  warning: 'text-amber-300',
  info: 'text-sky-300'
};

export function FileBadge({ label, tooltip, icon, variant = 'warning' }: FileBadgeProps) {
  const accessibleLabel = tooltip ?? label;
  const resolvedTooltip = tooltip ?? label;
  const resolvedIcon = icon ?? (variant === 'info' ? 'info' : 'warning');

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold',
        variantStyles[variant]
      )}
      title={resolvedTooltip}
      aria-label={accessibleLabel}
    >
      <MaterialIcon icon={resolvedIcon} className={clsx('h-4 w-4', iconStyles[variant])} />
      <span>{label}</span>
    </span>
  );
}
