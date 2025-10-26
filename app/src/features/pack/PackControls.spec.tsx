import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PackMethod } from '@common/ipc';
import { PackControls } from './PackControls';

const baseProps = {
  canPack: true,
  isPacking: false,
  packLabel: 'Pack Now',
  onPack: vi.fn(),
  onExit: vi.fn(),
  exitLabel: 'Exit',
  infoLabel: 'Info',
  metadataLabel: 'Metadata',
  metadataBadgeLabel: 'Required fields missing',
  showMetadataBadge: false,
  metadataDisabled: false,
  devMode: false,
  createTestDataLabel: 'Create Test Data',
  packMethod: 'zip_best_fit' as PackMethod,
  packMethodLabel: 'Pack method',
  packMethodOptions: [
    { value: 'zip_best_fit' as PackMethod, label: 'ZIP — best fit' },
    { value: 'seven_z_split' as PackMethod, label: '7z — split volumes' }
  ],
  onPackMethodChange: vi.fn()
};

describe('PackControls', () => {
  it('renders the pack button as a success-styled primary action', () => {
    render(<PackControls {...baseProps} />);

    const button = screen.getByRole('button', { name: 'Pack Now' });
    expect(button.classList.contains('btn')).toBe(true);
    expect(button.classList.contains('btn-success')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Pack Now');
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('disables the pack button while packing', () => {
    render(<PackControls {...baseProps} isPacking />);

    const button = screen.getByRole('button', { name: 'Pack Now' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.classList.contains('btn')).toBe(true);
    expect(button.classList.contains('btn-success')).toBe(true);
  });
});
