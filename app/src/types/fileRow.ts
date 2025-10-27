import type { FileEntry } from '@common/ipc';

export interface FileEstimate {
  archiveIndex: number;
  archiveLabel: string;
  reason?: string;
  splitTargets?: { archiveIndex: number; archiveLabel: string; channel: 'L' | 'R' }[];
  suggestSplitMono?: boolean;
}

export interface FileRow extends FileEntry {
  id: string;
  selectable: boolean;
  selected: boolean;
  userIntendedSelected?: boolean;
  estimate?: FileEstimate;
}
