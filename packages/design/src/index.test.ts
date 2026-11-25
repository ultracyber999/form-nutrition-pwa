import { describe, expect, it } from 'vitest';
import { tokens } from './index';

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}
function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('semantic design tokens', () => {
  it('uses contrast-tested accent foreground pairs in both themes', () => {
    expect(contrast(tokens.themes.dark.accent, tokens.themes.dark.onAccent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.themes.light.accent, tokens.themes.light.onAccent)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps body foreground readable on surfaces', () => {
    expect(contrast(tokens.themes.dark.fg, tokens.themes.dark.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.themes.light.fg, tokens.themes.light.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('preserves mandated touch target and breakpoints', () => {
    expect(tokens.touchMin).toBe(44);
    expect(tokens.breakpoints).toEqual({ tablet: 768, desktop: 1200 });
  });
});
