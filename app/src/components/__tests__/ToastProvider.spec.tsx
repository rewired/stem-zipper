import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from '../ui/ToastProvider';

function createHarness() {
  let controls:
    | {
        showEstimate: (zips: number) => void;
        dismissEstimate: () => void;
      }
    | undefined;

  function Harness() {
    const { show, dismiss } = useToast();
    controls = {
      showEstimate: (zips: number) => {
        show({
          id: 'estimate',
          title: 'Estimate',
          message: `This run will likely produce ≈ ${zips} ZIP archive(s).`,
          note: 'Note text',
          closeLabel: 'Close',
          timeoutMs: 10_000
        });
      },
      dismissEstimate: () => {
        dismiss('estimate');
      }
    };
    return null;
  }

  return { Harness, controls: () => controls };
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
    const { Harness, controls } = createHarness();

    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    );

    const api = controls();
    expect(api).toBeDefined();

    act(() => {
      api?.showEstimate(3);
    });

    expect(screen.getByText('Estimate')).toBeTruthy();
    expect(screen.getByText(/≈ 3 ZIP archive/)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(screen.getByText(/≈ 3 ZIP archive/)).toBeTruthy();

    act(() => {
      api?.showEstimate(5);
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

  it('dismisses estimate toasts via the toast context', () => {
    const { Harness, controls } = createHarness();

    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    );

    const api = controls();
    expect(api).toBeDefined();

    act(() => {
      api?.showEstimate(7);
    });

    expect(screen.getByText(/≈ 7 ZIP archive/)).toBeTruthy();

    act(() => {
      api?.dismissEstimate();
    });

    expect(screen.queryByText(/This run will likely produce/)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(screen.queryByText(/This run will likely produce/)).toBeNull();
  });
});
