import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from '../ui/ToastProvider';

function createHarness() {
  let trigger: ((message: number) => void) | undefined;

  function Harness() {
    const { show } = useToast();
    trigger = (zips: number) => {
      show({
        id: 'estimate',
        title: 'Estimate',
        message: `This run will likely produce ≈ ${zips} ZIP archive(s).`,
        note: 'Note text',
        closeLabel: 'Close',
        timeoutMs: 10_000
      });
    };
    return null;
  }

  return { Harness, trigger: () => trigger };
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows estimate toasts for at least 10 seconds and replaces older entries', () => {
    const { Harness, trigger } = createHarness();

    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    );

    const showEstimate = trigger();
    expect(showEstimate).toBeDefined();

    act(() => {
      showEstimate?.(3);
    });

    expect(screen.getByText('Estimate')).toBeTruthy();
    expect(screen.getByText(/≈ 3 ZIP archive/)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(screen.getByText(/≈ 3 ZIP archive/)).toBeTruthy();

    act(() => {
      showEstimate?.(5);
    });

    const messages = screen.getAllByText(/This run will likely produce/);
    expect(messages).toHaveLength(1);
    expect(messages[0].textContent).toContain('5');

    act(() => {
      vi.advanceTimersByTime(9_999);
    });
    expect(screen.queryByText(/≈ 5 ZIP archive/)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText(/This run will likely produce/)).toBeNull();
  });
});
