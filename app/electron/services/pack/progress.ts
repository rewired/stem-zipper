import type { ProgressEvent, ProgressMessage, ProgressReporter, ProgressState } from './types';

const DEFAULT_MESSAGES: Record<Exclude<ProgressState, 'error'>, ProgressMessage> = {
  preparing: 'pack_progress_preparing',
  packing: 'pack_progress_packing',
  finalizing: 'pack_progress_finalizing',
  done: 'pack_progress_done'
};

const ERROR_MESSAGE: ProgressMessage = 'pack_progress_error';

function resolveMessage(state: ProgressState, override?: ProgressMessage): ProgressMessage {
  if (override) {
    return override;
  }
  if (state === 'error') {
    return ERROR_MESSAGE;
  }
  return DEFAULT_MESSAGES[state] ?? 'pack_progress_packing';
}

function clampPercent(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}

export function createProgressReporter(onProgress: (event: ProgressEvent) => void): ProgressReporter {
  let current = 0;
  let total = 0;
  let lastState: ProgressState = 'preparing';
  let lastMessage: ProgressMessage = resolveMessage('preparing');
  let lastArchive: string | undefined;
  let lastErrorMessage: string | undefined;

  const clampCount = (value: number): number => {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.round(value));
  };

  const emit = (state: ProgressState, payload: Partial<ProgressEvent> = {}) => {
    const percent =
      typeof payload.percent === 'number'
        ? clampPercent(payload.percent)
        : total === 0
          ? 0
          : clampPercent((current / total) * 100);
    const message = resolveMessage(state, payload.message);
    const event: ProgressEvent = {
      state,
      current,
      total,
      percent,
      message,
      currentArchive: payload.currentArchive,
      errorMessage: payload.errorMessage
    };
    lastState = state;
    lastMessage = message;
    lastArchive = event.currentArchive;
    lastErrorMessage = event.errorMessage;
    onProgress(event);
  };

  const reemit = () => {
    if (lastState === 'done' || lastState === 'error') {
      return;
    }
    emit(lastState, {
      message: lastMessage,
      currentArchive: lastArchive,
      errorMessage: lastErrorMessage
    });
  };

  const reporter: ProgressReporter = {
    start({ total: nextTotal, message }) {
      total = clampCount(nextTotal);
      current = 0;
      emit('preparing', { message, percent: 0 });
    },
    setTotal(nextTotal) {
      const clamped = clampCount(nextTotal);
      if (clamped === total) {
        return;
      }
      total = clamped;
      if (current > total) {
        current = total;
      }
      reemit();
    },
    addToTotal(delta) {
      if (delta === 0) {
        return;
      }
      const nextTotal = clampCount(total + delta);
      if (nextTotal === total) {
        return;
      }
      total = nextTotal;
      if (current > total) {
        current = total;
      }
      reemit();
    },
    tick(info) {
      emit(info?.state ?? 'packing', info ?? {});
    },
    fileStart(info) {
      emit(info?.state ?? 'packing', info ?? {});
    },
    fileDone(info) {
      current = Math.min(current + 1, total);
      emit(info?.state ?? 'packing', info ?? {});
    },
    done(info) {
      current = total;
      emit('done', { ...info, percent: 100 });
    },
    error({ error, message }) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      emit('error', { message, errorMessage, percent: 0 });
    }
  };

  return reporter;
}
