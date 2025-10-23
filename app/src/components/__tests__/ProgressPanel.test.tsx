import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProgressPanel } from '../ProgressPanel';
import type { PackProgress } from '@common/ipc';

const baseProgress: PackProgress = {
  state: 'idle',
  current: 0,
  total: 0,
  percent: 0,
  message: 'status.ready'
};

describe('ProgressPanel', () => {
  it('renders Ready when no files are present', () => {
    const markup = renderToStaticMarkup(
      <ProgressPanel progress={baseProgress} primaryText="Ready" />
    );
    expect(markup).toContain('Ready');
  });

  it('renders the ZIP estimate text when provided', () => {
    const estimateText = 'Estimate: ≈ 3 ZIP archive(s)';
    const markup = renderToStaticMarkup(
      <ProgressPanel
        progress={baseProgress}
        primaryText={estimateText}
        primaryTooltip="tooltip"
        secondaryText="Secondary"
      />
    );
    expect(markup).toContain(estimateText);
    expect(markup).toContain('Secondary');
  });
});
