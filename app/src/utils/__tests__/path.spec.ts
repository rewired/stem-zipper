import { describe, expect, it } from 'vitest';
import { getFileExtension } from '../path';

describe('getFileExtension', () => {
  it('returns lowercase extensions including the dot for POSIX paths', () => {
    expect(getFileExtension('/var/data/archive.TAR.GZ')).toBe('.gz');
  });

  it('returns lowercase extensions including the dot for Windows paths', () => {
    expect(getFileExtension('C:/Users/Alice/Documents/report.PDF')).toBe('.pdf');
    expect(getFileExtension('C\\\\Temp\\\\music.FLAC')).toBe('.flac');
  });

  it('returns an empty string for files without extensions', () => {
    expect(getFileExtension('README')).toBe('');
    expect(getFileExtension('C:/Users/Alice/.gitignore')).toBe('');
  });

  it('returns an empty string for directories ending with dots', () => {
    expect(getFileExtension('/var/logs/archive.')).toBe('');
    expect(getFileExtension('C:/Temp/backup.')).toBe('');
  });

  it('returns an empty string for dotfiles and path segments', () => {
    expect(getFileExtension('.profile')).toBe('');
    expect(getFileExtension('..')).toBe('');
    expect(getFileExtension('.')).toBe('');
  });

  it('handles empty and undefined-like inputs gracefully', () => {
    expect(getFileExtension('')).toBe('');
  });
});
