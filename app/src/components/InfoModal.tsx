import { useEffect, useId } from 'react';
import { APP_VERSION } from '@common/version';

interface InfoModalProps {
  title: string;
  text: string;
  closeLabel: string;
  onClose: () => void;
  version?: string;
}

export function InfoModal({ title, text, closeLabel, onClose, version = APP_VERSION }: InfoModalProps) {
  const labelId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const resolvedText = text.split('{version}').join(version);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={labelId} className="text-lg font-semibold">
          {title}
        </h2>
        <p id={descriptionId} className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
          {resolvedText}
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <span aria-hidden>✖️</span>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
