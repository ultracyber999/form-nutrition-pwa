export function assertIsoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid ISO date: ${value}`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return value;
}

export function addDays(date: string, days: number): string {
  assertIsoDate(date);
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function diffDays(later: string, earlier: string): number {
  assertIsoDate(later);
  assertIsoDate(earlier);
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

export function compareDates(a: string, b: string): number {
  assertIsoDate(a);
  assertIsoDate(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function dateRange(endInclusive: string, lengthDays: number): string[] {
  if (!Number.isInteger(lengthDays) || lengthDays <= 0) throw new Error('lengthDays must be positive');
  return Array.from({ length: lengthDays }, (_, index) => addDays(endInclusive, index - lengthDays + 1));
}

export function rollingWindows(asOfDate: string, count = 3, lengthDays = 7): string[][] {
  const end = addDays(asOfDate, -1);
  return Array.from({ length: count }, (_, index) => {
    const windowEnd = addDays(end, -index * lengthDays);
    return dateRange(windowEnd, lengthDays);
  });
}

export function todayInTimeZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return assertIsoDate(`${get('year')}-${get('month')}-${get('day')}`);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function formatIsoInTimeZone(date: Date, timeZone: string): string {
  return todayInTimeZone(timeZone, date);
}
