import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FileEntry } from '@common/ipc';
import { FileTable } from '../components/FileTable';
import { LossyBadge } from '../components/LossyBadge';
import { useZipEstimator } from '../hooks/useZipEstimator';
import { formatMessage, type TranslationKey } from '@common/i18n';
import { DEFAULT_MAX_SIZE_MB } from '@common/constants';
import { Fragment } from 'react';

const MB = 1024 * 1024;

type HarnessProps = {
  files: FileEntry[];
  maxSizeMb: number;
};

function TestHarness({ files, maxSizeMb }: HarnessProps) {
  const { warnings } = useZipEstimator(files, { maxSizeMb });
  const badgeLabel = formatMessage('en', 'badge_label_zip_poor_gain');
  const maxLabel = `${new Intl.NumberFormat('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(maxSizeMb)} ${formatMessage('en', 'common_size_unit_megabyte')}`;

  return (
    <FileTable
      files={files}
      fileLabel="File"
      sizeLabel="Size"
      actionLabel="Action"
      actionNames={{ normal: 'Normal', split_mono: 'Split Mono', split_zip: 'Split ZIP' }}
      emptyLabel="Empty"
      helperLabel="Helper"
      sizeUnitLabel="MB"
      formatSize={(value) => value.toFixed(2)}
      renderBadge={(file) => {
        const warning = warnings.get(file.path);
        if (!warning) {
          return null;
        }
        const key: TranslationKey =
          warning.reason === 'file_exceeds_limit'
            ? 'batch_warn_file_exceeds_max_zip'
            : 'batch_warn_lossy_zip_gain_low';
        const tooltip = formatMessage('en', key, { max_zip_size: maxLabel });
        return <LossyBadge label={badgeLabel} tooltip={tooltip} />;
      }}
    />
  );
}

describe('useZipEstimator integration', () => {
  it('renders a badge for lossy files that overflow and includes the max size in the tooltip', () => {
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
        sizeMb: 12,
        action: 'normal',
        path: '/vocals.mp3',
        sizeBytes: 12 * MB,
        kind: 'mp3'
      }
    ];

    render(
      <Fragment>
        <TestHarness files={files} maxSizeMb={DEFAULT_MAX_SIZE_MB} />
      </Fragment>
    );

    const badgeNode = screen.getByText('~no zip gain');
    const badge = badgeNode.closest('span[title]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('title')).toContain(`${DEFAULT_MAX_SIZE_MB.toFixed(2)} MB`);

    const wavRow = screen.getByText('bass.wav');
    expect(wavRow.parentElement?.textContent).not.toContain('~no zip gain');
  });
});
