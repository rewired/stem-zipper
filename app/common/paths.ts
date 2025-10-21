import os from 'node:os';

export function formatPathForDisplay(folderPath: string): string {
  const home = os.homedir();
  if (folderPath.startsWith(home)) {
    return folderPath.replace(home, '~');
  }
  return folderPath;
}
