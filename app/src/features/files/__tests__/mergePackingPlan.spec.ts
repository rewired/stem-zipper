import { describe, expect, it } from 'vitest';
import type { FileRow } from '../../../types/fileRow';
import { mergePackingPlan } from '../mergePackingPlan';

function createRow(overrides: Partial<FileRow> = {}): FileRow {
  return {
    id: overrides.id ?? overrides.path ?? '/file.wav',
    name: 'file.wav',
    sizeMb: 1,
    action: 'normal',
    path: overrides.path ?? '/file.wav',
    sizeBytes: 1,
    kind: 'wav',
    selectable: true,
    selected: true,
    ...overrides
  };
}

describe('mergePackingPlan', () => {
  it('disables ZIP rows that are not allowed while preserving intent', () => {
    const rows: FileRow[] = [createRow({ path: '/bass.wav', id: '/bass.wav', userIntendedSelected: true })];
    const result = mergePackingPlan(rows, [
      { path: '/bass.wav', archiveIndex: 1, archiveLabel: 'stems-01.zip', allowed: false, reason: 'zip_too_large' }
    ], {
      method: 'zip',
      zipDisallowedReason: 'Too large'
    });

    expect(result[0].selectable).toBe(false);
    expect(result[0].selected).toBe(false);
    expect(result[0].userIntendedSelected).toBe(true);
    expect(result[0].estimate).toEqual({ archiveIndex: 1, archiveLabel: 'stems-01.zip', reason: 'Too large' });
  });

  it('restores selection when switching to 7z', () => {
    const rows: FileRow[] = [
      createRow({
        path: '/lead.wav',
        id: '/lead.wav',
        selectable: false,
        selected: false,
        userIntendedSelected: true,
        estimate: { archiveIndex: 1, archiveLabel: 'stems-01.zip', reason: 'Too large' }
      })
    ];

    const result = mergePackingPlan(
      rows,
      [{ path: '/lead.wav', archiveIndex: 1, archiveLabel: 'vol-01.7z', allowed: true }],
      {
        method: '7z',
        zipDisallowedReason: 'Too large'
      }
    );

    expect(result[0].selectable).toBe(true);
    expect(result[0].selected).toBe(true);
    expect(result[0].estimate).toEqual({ archiveIndex: 1, archiveLabel: 'vol-01.7z' });
  });

  it('keeps existing state when plan has no entry', () => {
    const rows: FileRow[] = [createRow({ path: '/drone.wav', id: '/drone.wav', selected: false })];

    const result = mergePackingPlan(rows, [], { method: 'zip', zipDisallowedReason: 'Too large' });
    expect(result[0].selected).toBe(false);
    expect(result[0].selectable).toBe(true);
  });
});
