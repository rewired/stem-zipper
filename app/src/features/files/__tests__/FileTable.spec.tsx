import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileTable } from '../FileTable';
import type { FileRow } from '../../../types/fileRow';

describe('FileTable', () => {
  function createRows(): FileRow[] {
    return [
      {
        id: 'bass',
        name: 'bass.wav',
        path: '/bass.wav',
        sizeMb: 4,
        action: 'normal',
        sizeBytes: 4,
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
        sizeBytes: 6,
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
        toggleAllLabel="Toggle all"
        estimateLabel="Estimate"
        masterChecked={false}
        masterIndeterminate={false}
        masterDisabled={false}
        formatTooltip={(reason) => reason}
      />
    );

    const masterSwitch = screen.getByRole('switch', { name: 'Toggle all' });
    fireEvent.click(masterSwitch);
    expect(handleToggleAll).toHaveBeenCalledTimes(1);

    const rowCheckbox = screen.getByRole('checkbox', { name: 'Select bass.wav' });
    fireEvent.click(rowCheckbox);
    expect(handleToggleRow).toHaveBeenCalledWith('bass');
  });

  it('renders disabled rows with tooltip information', () => {
    render(
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
        toggleAllLabel="Toggle all"
        estimateLabel="Estimate"
        masterChecked={false}
        masterIndeterminate={false}
        masterDisabled={false}
        formatTooltip={(reason) => `Reason: ${reason}`}
      />
    );

    const [disabledCheckbox] = screen.getAllByRole('checkbox', { name: 'Select vox.wav' });
    expect((disabledCheckbox as HTMLInputElement).disabled).toBe(true);
    const tooltipIcon = screen.getByLabelText('Reason: Too large');
    expect(tooltipIcon).toBeTruthy();
  });
});
