import { Transition } from '@headlessui/react';
import React, { Fragment } from 'react';

type NoticeTone = 'info' | 'success' | 'warning' | 'error';

const toneStyles: Record<NoticeTone, string> = {
  info: 'bg-sky-500/10 text-sky-100 border-sky-400/40',
  success: 'bg-emerald-500/10 text-emerald-100 border-emerald-400/40',
  warning: 'bg-amber-500/10 text-amber-100 border-amber-400/40',
  error: 'bg-rose-500/10 text-rose-100 border-rose-400/40'
};

export interface NoticeProps {
  show: boolean;
  message: string;
  tone?: NoticeTone;
  onDismiss?: () => void;
}

const Notice: React.FC<NoticeProps> = ({ show, message, tone = 'info', onDismiss }) => {
  return (
    <Transition
      as={Fragment}
      show={show}
      enter="transition ease-out duration-200"
      enterFrom="opacity-0 -translate-y-2"
      enterTo="opacity-100 translate-y-0"
      leave="transition ease-in duration-150"
      leaveFrom="opacity-100 translate-y-0"
      leaveTo="opacity-0 -translate-y-1"
    >
      <div className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm shadow ${toneStyles[tone]}`}>
        <span className="whitespace-pre-line leading-relaxed">{message}</span>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-transparent px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            ×
          </button>
        ) : null}
      </div>
    </Transition>
  );
};

export default Notice;
