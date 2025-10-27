import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerProvider, usePlayer } from '../PlayerProvider';
import type { FileRow } from '../../../types/fileRow';

const sampleFile: FileRow = {
  id: 'id-1',
  name: 'clip.wav',
  path: '/tmp/clip.wav',
  sizeMb: 1,
  sizeBytes: 1,
  action: 'normal',
  kind: 'wav',
  selectable: true,
  selected: true
};

function Harness() {
  const player = usePlayer();
  return (
    <div>
      <button type="button" onClick={() => player.open(sampleFile)}>
        open
      </button>
      <button type="button" onClick={() => player.close()}>
        close
      </button>
      <span data-testid="status">{player.isOpen ? 'open' : 'closed'}</span>
    </div>
  );
}

describe('PlayerProvider', () => {
  it('opens and closes the preview state', () => {
    render(
      <PlayerProvider>
        <Harness />
      </PlayerProvider>
    );

    expect(screen.getByTestId('status').textContent).toBe('closed');
    fireEvent.click(screen.getByText('open'));
    expect(screen.getByTestId('status').textContent).toBe('open');
    fireEvent.click(screen.getByText('close'));
    expect(screen.getByTestId('status').textContent).toBe('closed');
  });
});
