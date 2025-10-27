import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackProgress } from '@common/ipc';
import {
  buildProgressUpdate,
  initialProgressView,
  packProgressReducer,
  type PackProgressAction,
  type PackProgressView
} from '../usePackState';

describe('buildProgressUpdate', () => {
  const translate = vi.fn<(key: string, params?: Record<string, string | number>) => string>(
    (key, params) => `${key}:${JSON.stringify(params ?? {})}`
  );

  beforeEach(() => {
    translate.mockClear();
  });

  function makeEvent(overrides: Partial<PackProgress> = {}): PackProgress {
    return {
      state: 'preparing',
      current: 0,
      total: 0,
      percent: 0,
      message: 'pack_progress_preparing',
      ...overrides
    };
  }

  it('returns preparing progress updates with percent placeholder', () => {
    const event = makeEvent({ percent: 12 });
    const action = buildProgressUpdate(event, translate);

    expect(action).toEqual({
      type: 'progress',
      phase: 'preparing',
      percent: 12,
      label: 'pack_progress_preparing:{"percent":12}'
    });
    expect(translate).toHaveBeenCalledWith('pack_progress_preparing', { percent: 12 });
  });

  it('returns packing updates with archive context when provided', () => {
    const event = makeEvent({
      state: 'packing',
      message: 'pack_progress_packing',
      currentArchive: 'Archive A',
      percent: 54
    });
    const action = buildProgressUpdate(event, translate);

    expect(action).toEqual({
      type: 'progress',
      phase: 'packing',
      percent: 54,
      label: 'pack_progress_packing:{"name":"Archive A","percent":54}',
      archiveLabel: 'Archive A'
    });
    expect(translate).toHaveBeenCalledWith('pack_progress_packing', {
      name: 'Archive A',
      percent: 54
    });
  });

  it('falls back to generic packing message when archive is missing', () => {
    const event = makeEvent({ state: 'packing', percent: 33, currentArchive: undefined });
    const action = buildProgressUpdate(event, translate);

    expect(action).toEqual({
      type: 'progress',
      phase: 'packing',
      percent: 33,
      label: 'pack_progress_packing_generic:{"percent":33}',
      archiveLabel: null
    });
    expect(translate).toHaveBeenCalledWith('pack_progress_packing_generic', { percent: 33 });
  });

  it('marks completion with a done label', () => {
    const event = makeEvent({ state: 'done', message: 'pack_progress_done', percent: 100 });
    const action = buildProgressUpdate(event, translate);

    expect(action).toEqual({
      type: 'progress',
      phase: 'done',
      percent: 100,
      label: 'pack_progress_done:{}'
    });
    expect(translate).toHaveBeenCalledWith('pack_progress_done');
  });

  it('captures error details', () => {
    const event = makeEvent({ state: 'error', errorMessage: 'network down', percent: 0 });
    const action = buildProgressUpdate(event, translate);

    expect(action).toEqual({
      type: 'progress',
      phase: 'error',
      percent: 0,
      label: 'pack_progress_error:{}',
      errorMessage: 'network down'
    });
    expect(translate).toHaveBeenCalledWith('pack_progress_error');
  });
});

describe('packProgressReducer', () => {
  it('updates state with the latest progress and clamps percent', () => {
    const action: PackProgressAction = {
      type: 'progress',
      phase: 'packing',
      percent: 150,
      label: 'packing',
      archiveLabel: 'Archive B'
    };

    const state = packProgressReducer(initialProgressView, action);

    expect(state).toEqual({
      phase: 'packing',
      percent: 100,
      label: 'packing',
      archiveLabel: 'Archive B',
      errorMessage: null
    });
  });

  it('clears error information on reset', () => {
    const errored: PackProgressView = {
      phase: 'error',
      percent: 0,
      label: 'failed',
      archiveLabel: null,
      errorMessage: 'boom'
    };

    const state = packProgressReducer(errored, { type: 'reset' });
    expect(state).toEqual(initialProgressView);
  });

  it('removes error details when returning to an in-flight state', () => {
    const errored: PackProgressView = {
      phase: 'error',
      percent: 0,
      label: 'failed',
      archiveLabel: null,
      errorMessage: 'boom'
    };

    const next = packProgressReducer(errored, {
      type: 'progress',
      phase: 'preparing',
      percent: 0,
      label: 'start'
    });

    expect(next).toEqual({
      phase: 'preparing',
      percent: 0,
      label: 'start',
      archiveLabel: null,
      errorMessage: null
    });
  });
});
