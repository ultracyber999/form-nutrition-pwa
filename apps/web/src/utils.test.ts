import { describe, expect, it } from 'vitest';
import { csvEscape, fmt, nullableNumber } from './utils';

describe('web utilities', () => {
  it('formats decimal values without losing required precision', () => {
    expect(fmt(89.5, 1)).toBe('89.5');
    expect(fmt(null, 1)).toBe('—');
  });

  it('parses blank input as unknown rather than zero', () => {
    expect(nullableNumber('')).toBeNull();
    expect(nullableNumber('180')).toBe(180);
    expect(nullableNumber('not-a-number')).toBeNull();
  });

  it('escapes spreadsheet formula-like text in csv cells', () => {
    expect(csvEscape('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvEscape('normal')).toBe('"normal"');
  });
});
