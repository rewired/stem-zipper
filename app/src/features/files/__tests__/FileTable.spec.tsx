import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileTable } from '../FileTable';
import type { FileRow } from '../../../types/fileRow';
import { PlayerProvider } from '../../player';

describe('FileTable', () => {
  afterEach(() => {
    cleanup();
  });
  function createRows(): FileRow[] {
    return [
      {
        id: 'bass',
        name: 'bass.wav',
        path: '/bass.wav',
        sizeMb: 4,
        action: 'normal',
        sizeBytes: 4 * 1024 * 1024,
        kind: 'wav',
        selectable: true,
        selected: true
      },
      {
        id: 'vox',
        name: 'vox.wav',
        path: '/vox.wav',
        sizeMb: 6,
        action: 'normal',
        sizeBytes: 70 * 1024 * 1024,
        kind: 'wav',
        selectable: false,
        selected: false,
        estimate: { archiveIndex: 2, archiveLabel: 'stems-02.zip', reason: 'Too large' }
      }
    ];
  }

  it('calls toggle handlers for master switch and individual rows', () => {
    const handleToggleRow = vi.fn();
    const handleToggleAll = vi.fn();

    render(
      <PlayerProvider>
        <FileTable
          files={createRows()}
          fileLabel="File"
          sizeLabel="Size"
          actionLabel="Action"
          actionNames={{ normal: 'Normal', split_mono: 'Split Mono', split_zip: 'Split ZIP' }}
          emptyLabel="Empty"
          helperLabel="Helper"
          sizeUnitLabel="MB"
          formatSize={(value) => value.toFixed(2)}
          renderBadge={() => null}
          renderEstimate={() => <span data-testid="estimate">~ stems-01.zip</span>}
          onToggleRow={handleToggleRow}
          onToggleAll={handleToggleAll}
          selectLabel="Select"
          selectAllLabel="Select all"
          previewLabel="Open audio preview"
          playLabel="Play"
          previewUnavailableLabel="Cannot decode this file"
          estimateLabel="Estimate"
          masterChecked={false}
          masterIndeterminate={false}
          masterDisabled={false}
          formatTooltip={(reason) => reason}
          splitMonoHint="Split"
        />
      </PlayerProvider>
    );

    const masterCheckbox = screen.getByRole('checkbox', { name: 'Select all' });
    fireEvent.click(masterCheckbox);
    expect(handleToggleAll).toHaveBeenCalledTimes(1);

    const rowCheckbox = screen.getByRole('checkbox', { name: 'Select bass.wav' });
    fireEvent.click(rowCheckbox);
    expect(handleToggleRow).toHaveBeenCalledWith('bass');

    const previewButton = screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement;
    expect(previewButton.disabled).toBe(false);
    const disabledPreview = screen.getByRole('button', { name: 'Open audio preview' }) as HTMLButtonElement;
    expect(disabledPreview.disabled).toBe(true);
  });

  it('renders disabled rows with tooltip information', () => {
    render(
      <PlayerProvider>
        <FileTable
          files={createRows()}
          fileLabel="File"
          sizeLabel="Size"
          actionLabel="Action"
          actionNames={{ normal: 'Normal', split_mono: 'Split Mono', split_zip: 'Split ZIP' }}
          emptyLabel="Empty"
          helperLabel="Helper"
          sizeUnitLabel="MB"
          formatSize={(value) => value.toFixed(2)}
          renderBadge={() => null}
          renderEstimate={() => null}
          onToggleRow={() => {}}
          onToggleAll={() => {}}
          selectLabel="Select"
          selectAllLabel="Select all"
          previewLabel="Open audio preview"
          playLabel="Play"
          previewUnavailableLabel="Cannot decode this file"
          estimateLabel="Estimate"
          masterChecked={false}
          masterIndeterminate={false}
          masterDisabled={false}
          formatTooltip={(reason) => `Reason: ${reason}`}
          splitMonoHint="Split"
        />
      </PlayerProvider>
    );

    const [disabledCheckbox] = screen.getAllByRole('checkbox', { name: 'Select vox.wav' });
    expect((disabledCheckbox as HTMLInputElement).disabled).toBe(true);
    const tooltipIcon = screen.getByLabelText('Reason: Too large');
    expect(tooltipIcon).toBeTruthy();
  });
  it('renders Play only for previewable files', () => {
    render(
      <PlayerProvider>
        <FileTable
          files={createRows()}
          fileLabel="File"
          sizeLabel="Size"
          actionLabel="Action"
          actionNames={{ normal: 'Normal', split_mono: 'Split Mono', split_zip: 'Split ZIP' }}
          emptyLabel="Empty"
          helperLabel="Helper"
          sizeUnitLabel="MB"
          formatSize={(value) => value.toFixed(2)}
          renderBadge={() => null}
          renderEstimate={() => null}
          onToggleRow={() => {}}
          onToggleAll={() => {}}
          selectLabel="Select"
          selectAllLabel="Select all"
          previewLabel="Open audio preview"
          playLabel="Play"
          previewUnavailableLabel="Cannot decode this file"
          estimateLabel="Estimate"
          masterChecked={false}
          masterIndeterminate={false}
          masterDisabled={false}
          formatTooltip={(reason) => reason}
          splitMonoHint="Split"
        />
      </PlayerProvider>
    );

    const playButtons = screen.getAllByRole('button', { name: 'Play' });
    expect(playButtons).toHaveLength(1);
    const disabledPreview = screen.getByRole('button', { name: 'Open audio preview' }) as HTMLButtonElement;
    expect(disabledPreview.disabled).toBe(true);
  });
});
