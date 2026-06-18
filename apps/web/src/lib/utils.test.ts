import { describe, it, expect } from 'vitest';
import { cn, formatBytes } from './utils';

describe('formatBytes', () => {
  it('formats common sizes (accepting string input from the API)', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes('1048576')).toBe('1.0 MB');
    expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GB');
  });
});

describe('cn', () => {
  it('merges and dedupes tailwind classes', () => {
    const hidden = false;
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', hidden && 'hidden', 'font-bold')).toBe('text-sm font-bold');
  });
});
