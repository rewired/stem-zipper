import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileRow } from '../FileRow';
import type { FileRow as FileRowModel } from '../../../types/fileRow';
import { FileBadge } from '../../../components/FileBadge';

function createFile(): FileRowModel {
  return {
    id: 'fixture',
    name: 'fixture.wav',
    path: '/tmp/fixture.wav',
    sizeMb: 12,
    sizeBytes: 12 * 1024 * 1024,
    action: 'split_mono',
    kind: 'wav',
    selectable: true,
    selected: true,
    userIntendedSelected: true,
    suggest_split_mono: true,
    estimate: { archiveIndex: 1, archiveLabel: 'stems-01.zip' }
  };
}

describe('FileRow split-mono behaviour', () => {
  it('renders the split mono badge with accessibility labels', () => {
    const file = createFile();
    const hint = 'Will split';
    render(
      <table>
        <tbody>
          <FileRow
            file={file}
            actionName="Split Mono"
            sizeUnitLabel="MB"
            formatSize={(value) => value.toFixed(2)}
            renderBadge={(row) =>
              row.suggest_split_mono ? (
                <FileBadge label="Split Mono" tooltip={hint} ariaLabel="Split mono badge" variant="info" icon="info" />
              ) : null
            }
            renderEstimate={() => null}
            onToggle={vi.fn()}
            selectLabel="Select"
            formatTooltip={(reason) => reason}
            splitMonoHint={hint}
          />
        </tbody>
      </table>
    );

    const badge = screen.getByLabelText('Split mono badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent?.includes('Split Mono')).toBe(true);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.disabled).toBe(false);
    expect(checkbox.getAttribute('title')).toBe(hint);
  });
});
