import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FileEntry } from '@common/ipc';
import { Fragment, type JSX } from 'react';
import { FileTable } from '../features/files/FileTable';
import { FileBadge } from '../components/FileBadge';
import { useZipEstimator } from '../hooks/useZipEstimator';
import { formatMessage } from '@common/i18n';
import { DEFAULT_MAX_SIZE_MB } from '@common/constants';
import type { FileRow } from '../types/fileRow';
import { PlayerProvider } from '../features/player';

const MB = 1024 * 1024;

type HarnessProps = {
  files: FileEntry[];
  maxSizeMb: number;
};

function TestHarness({ files, maxSizeMb }: HarnessProps) {
  const rows: FileRow[] = files.map((file) => ({
    ...file,
    id: file.path,
    selectable: true,
    selected: true
  }));

  const { badges } = useZipEstimator(rows, { maxSizeMb });
  const badgeLabel = formatMessage('en', 'pack_badge_no_zip_gain');
  const badgeHint = formatMessage('en', 'pack_badge_no_zip_gain_hint');
  const volumeLabel = formatMessage('en', 'pack_badge_try_7z_volumes');

  return (
    <PlayerProvider>
      <FileTable
        files={rows}
        fileLabel="File"
        sizeLabel="Size"
        actionLabel="Action"
        actionNames={{ normal: 'Normal', split_mono: 'Split Mono', split_zip: 'Split ZIP' }}
        emptyLabel="Empty"
        helperLabel="Helper"
        sizeUnitLabel="MB"
        formatSize={(value) => value.toFixed(2)}
        renderBadge={(file) => {
          const flags = badges.get(file.path);
          if (!flags) {
            return null;
          }
          const elements: JSX.Element[] = [];
          if (flags.noZipGain) {
            elements.push(
              <FileBadge
                key="no-zip"
                label={badgeLabel}
                tooltip={badgeHint}
                variant="info"
                icon="info"
              />
            );
          }
          if (flags.consider7zVolumes) {
            elements.push(<FileBadge key="7z" label={volumeLabel} />);
          }
          if (elements.length === 0) {
            return null;
          }
          return <span className="flex gap-1">{elements}</span>;
        }}
        renderEstimate={() => null}
        onToggleRow={() => {}}
        onToggleAll={() => {}}
        selectLabel="Select"
        selectAllLabel="Select all"
        previewLabel="Open audio preview"
        playLabel="Play"
        previewUnavailableLabel="Cannot decode this file"
        estimateLabel="Estimate"
        masterChecked
        masterIndeterminate={false}
        masterDisabled={false}
        formatTooltip={(reason) => reason}
        splitMonoHint="Split"
      />
    </PlayerProvider>
  );
}

describe('useZipEstimator integration', () => {
  it('renders badges for compressed formats and suggests 7z volumes when they exceed the limit', () => {
    const files: FileEntry[] = [
      {
        name: 'bass.wav',
        sizeMb: 40,
        action: 'normal',
        path: '/bass.wav',
        sizeBytes: 40 * MB,
        kind: 'wav'
      },
      {
        name: 'vocals.mp3',
        sizeMb: 30,
        action: 'normal',
        path: '/vocals.mp3',
        sizeBytes: 30 * MB,
        kind: 'mp3'
      },
      {
        name: 'drums.flac',
        sizeMb: 60,
        action: 'normal',
        path: '/drums.flac',
        sizeBytes: 60 * MB,
        kind: 'flac'
      },
      {
        name: 'fx.ogg',
        sizeMb: 10,
        action: 'normal',
        path: '/fx.ogg',
        sizeBytes: 10 * MB,
        kind: 'ogg'
      }
    ];

    render(
      <Fragment>
        <TestHarness files={files} maxSizeMb={DEFAULT_MAX_SIZE_MB} />
      </Fragment>
    );

    const badges = screen.getAllByText('~ no zip gain');
    expect(badges).toHaveLength(3);
    for (const badge of badges) {
      const container = badge.closest('span[aria-label]');
      expect(container).not.toBeNull();
      expect(container?.classList.contains('badge-info')).toBe(true);
      expect(container?.getAttribute('title')).toBe(
        "Already compressed; ZIP usually won't shrink it."
      );
    }

    expect(screen.queryByText('try 7z volumes')).not.toBeNull();

    const wavRow = screen.getByText('bass.wav');
    expect(wavRow.parentElement?.textContent).not.toContain('~ no zip gain');
  });
});
