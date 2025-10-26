import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from '../../providers/ToastProvider';

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
          title: 'Heads up',
          message: `Estimated: ${zips} pack(s) ~ 12.34 MB`,
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

    expect(screen.getByText('Heads up')).toBeTruthy();
    expect(screen.getByText(/Estimated: 3 pack\(s\)/)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(screen.getByText(/Estimated: 3 pack\(s\)/)).toBeTruthy();

    act(() => {
      api?.showEstimate(5);
    });

    const messages = screen.getAllByText(/Estimated:/);
    expect(messages).toHaveLength(1);
    expect(messages[0].textContent).toContain('5');

    act(() => {
      vi.advanceTimersByTime(9_999);
    });
    expect(screen.queryByText(/Estimated: 5 pack\(s\)/)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText(/Estimated:/)).toBeNull();
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

    expect(screen.getByText(/Estimated: 7 pack\(s\)/)).toBeTruthy();

    act(() => {
      api?.dismissEstimate();
    });

    expect(screen.queryByText(/Estimated:/)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(screen.queryByText(/Estimated:/)).toBeNull();
  });
});
