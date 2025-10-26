export function getFileExtension(filePath: string): string {
  if (!filePath) {
    return '';
  }

  const lastSeparatorIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  const basename = lastSeparatorIndex >= 0 ? filePath.slice(lastSeparatorIndex + 1) : filePath;
  if (!basename || basename === '.' || basename === '..') {
    return '';
  }

  const lastDotIndex = basename.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === basename.length - 1) {
    return '';
  }

  return basename.slice(lastDotIndex).toLowerCase();
}
