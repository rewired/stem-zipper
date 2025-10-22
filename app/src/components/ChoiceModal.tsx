import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';

import { MaterialIcon } from './icons/MaterialIcon';

interface ChoiceModalProps {
  title: string;
  text: ReactNode;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}

export function ChoiceModal({
  title,
  text,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary
}: ChoiceModalProps) {
  const labelId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSecondary();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSecondary]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
      onClick={onSecondary}
    >
      <div
        className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={labelId} className="text-lg font-semibold">
          {title}
        </h2>
        <div id={descriptionId} className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
          {text}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onSecondary}
            className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <MaterialIcon icon="close" />
            {secondaryLabel}
          </button>
          <button
            type="button"
            onClick={onPrimary}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            <MaterialIcon icon="folder_open" />
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

