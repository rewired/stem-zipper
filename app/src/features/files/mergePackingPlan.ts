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
      const nextEstimate = file.estimate
        ? {
            archiveIndex: file.estimate.archiveIndex,
            archiveLabel: file.estimate.archiveLabel,
            reason: file.estimate.reason,
            splitTargets: file.estimate.splitTargets,
            suggestSplitMono: file.estimate.suggestSplitMono
          }
        : undefined;
      return {
        ...file,
        selectable: isZip ? file.selectable : true,
        selected: intended,
        userIntendedSelected: intended,
        estimate: nextEstimate,
        suggest_split_mono: file.suggest_split_mono
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
          },
          suggest_split_mono: entry.suggestSplitMono ? true : undefined
        };
      }
      return {
        ...file,
        selectable: true,
        selected: intended,
        userIntendedSelected: intended,
        estimate: {
          archiveIndex: entry.archiveIndex,
          archiveLabel: entry.archiveLabel,
          splitTargets: entry.splitTargets?.map((target) => ({
            archiveIndex: target.archiveIndex,
            archiveLabel: target.archiveLabel,
            channel: target.channel
          })),
          suggestSplitMono: entry.suggestSplitMono ?? false
        },
        suggest_split_mono: entry.suggestSplitMono ? true : undefined
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
      },
      suggest_split_mono: entry.suggestSplitMono ? true : file.suggest_split_mono
    };
  });
}
