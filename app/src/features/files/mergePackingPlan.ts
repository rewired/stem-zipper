import type { PackingPlanEntry, PackingEstimatorMethod } from '@common/ipc/contracts';
import type { FileRow } from '../../types/fileRow';

interface MergeOptions {
  method: PackingEstimatorMethod;
  zipDisallowedReason: string;
}

function resolveIntendedSelection(file: FileRow): boolean {
  if (typeof file.userIntendedSelected === 'boolean') {
    return file.userIntendedSelected;
  }
  if (typeof file.selected === 'boolean') {
    return file.selected;
  }
  return true;
}

export function mergePackingPlan(
  files: FileRow[],
  plan: PackingPlanEntry[],
  options: MergeOptions
): FileRow[] {
  const map = new Map(plan.map((entry) => [entry.path, entry]));
  const { method, zipDisallowedReason } = options;
  const isZip = method === 'zip';

  return files.map((file) => {
    const entry = map.get(file.path);
    const intended = resolveIntendedSelection(file);

    if (!entry) {
      if (isZip) {
        return {
          ...file,
          userIntendedSelected: intended,
          selected: intended,
          estimate: file.estimate ? { ...file.estimate, reason: file.estimate.reason } : file.estimate
        };
      }
      return {
        ...file,
        selectable: true,
        selected: intended,
        userIntendedSelected: intended,
        estimate: file.estimate
          ? { archiveIndex: file.estimate.archiveIndex, archiveLabel: file.estimate.archiveLabel }
          : undefined
      };
    }

    if (isZip) {
      if (!entry.allowed) {
        return {
          ...file,
          selectable: false,
          selected: false,
          userIntendedSelected: intended,
          estimate: {
            archiveIndex: entry.archiveIndex,
            archiveLabel: entry.archiveLabel,
            reason: zipDisallowedReason
          }
        };
      }
      return {
        ...file,
        selectable: true,
        selected: intended,
        userIntendedSelected: intended,
        estimate: {
          archiveIndex: entry.archiveIndex,
          archiveLabel: entry.archiveLabel
        }
      };
    }

    return {
      ...file,
      selectable: true,
      selected: intended,
      userIntendedSelected: intended,
      estimate: {
        archiveIndex: entry.archiveIndex,
        archiveLabel: entry.archiveLabel
      }
    };
  });
}
