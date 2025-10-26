import { useEffect } from 'react';
import { useToast } from '../../providers/ToastProvider';
import { usePackState, type PackToastEvent } from './usePackState';

export function ProgressToastBridge() {
  const { subscribe } = usePackState();
  const { show, dismiss } = useToast();

  useEffect(() => {
    return subscribe((event: PackToastEvent) => {
      if (event.type === 'toast') {
        show({
          id: event.toast.id,
          title: event.toast.title,
          message: event.toast.message,
          note: event.toast.note,
          closeLabel: event.toast.closeLabel,
          timeoutMs: event.toast.timeoutMs
        });
        return;
      }
      if (event.type === 'dismiss') {
        dismiss(event.id);
      }
    });
  }, [dismiss, show, subscribe]);

  return null;
}
