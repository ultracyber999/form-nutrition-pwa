import { describe, expect, it } from 'vitest';
import { addDays, dateRange, diffDays, rollingWindows, todayInTimeZone } from './dates';

describe('local calendar dates', () => {
  it('uses calendar arithmetic independent of UTC timestamp truncation', () => {
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(diffDays('2026-03-30', '2026-03-29')).toBe(1);
  });

  it('creates three non-overlapping complete windows ending yesterday', () => {
    const windows = rollingWindows('2026-11-25');
    expect(windows).toHaveLength(3);
    expect(windows[0]!.at(-1)).toBe('2026-11-24');
    expect(windows[0]![0]).toBe('2026-11-18');
    expect(windows[1]!.at(-1)).toBe('2026-11-17');
    expect(windows[2]![0]).toBe('2026-11-04');
    expect(new Set(windows.flat()).size).toBe(21);
  });

  it('resolves today in the selected IANA zone around midnight', () => {
    const instant = new Date('2026-11-25T22:30:00Z');
    expect(todayInTimeZone('Asia/Jerusalem', instant)).toBe('2026-11-26');
    expect(todayInTimeZone('America/New_York', instant)).toBe('2026-11-25');
  });

  it('date ranges are ascending and exact length', () => {
    expect(dateRange('2026-01-07', 7)).toEqual(['2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05','2026-01-06','2026-01-07']);
  });
});
