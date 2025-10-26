import type { FileEntry } from '@common/ipc';

export interface FileEstimate {
  archiveIndex: number;
  archiveLabel: string;
  reason?: string;
}

export interface FileRow extends FileEntry {
  id: string;
  selectable: boolean;
  selected: boolean;
  userIntendedSelected?: boolean;
  estimate?: FileEstimate;
}
