import { describe, expect, it } from 'vitest';
import { buildTrendGeometry } from './trendGeometry';

describe('time-accurate trend geometry', () => {
  it('uses calendar spacing and breaks missing-date gaps', () => {
    const geometry = buildTrendGeometry([
      { localDate: '2026-11-01', valueKg: 90 },
      { localDate: '2026-11-02', valueKg: 89 },
      { localDate: '2026-11-10', valueKg: 88 }
    ])!;
    expect(geometry.xForDate('2026-11-02')).toBeCloseTo(90.667, 2);
    expect(geometry.xForDate('2026-11-10')).toBeCloseTo(592, 3);
    expect(geometry.segments).toHaveLength(1);
    expect(geometry.segments[0]?.join(' ')).toBe(`M${geometry.xForDate('2026-11-01')},${geometry.y(90)} L${geometry.xForDate('2026-11-02')},${geometry.y(89)}`);
  });
});
