import { diffDays } from '@form/domain';

export type TrendPointInput = { localDate: string; valueKg: number };

export type TrendGeometry = {
  width: number;
  height: number;
  pad: number;
  xForDate: (date: string) => number;
  y: (value: number) => number;
  segments: string[][];
  areaPaths: string[];
};

export function buildTrendGeometry(points: TrendPointInput[], width = 620, height = 170, pad = 28): TrendGeometry | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const values = sorted.map((point) => point.valueKg);
  const min = Math.min(...values) - 0.3;
  const max = Math.max(...values) + 0.3;
  const firstPoint = sorted[0];
  const lastPoint = sorted.at(-1);
  if (!firstPoint || !lastPoint) return null;
  const first = firstPoint.localDate;
  const last = lastPoint.localDate;
  const span = Math.max(1, diffDays(last, first));
  const xForDate = (date: string) => sorted.length === 1 || first === last ? width / 2 : pad + (diffDays(date, first) / span) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - min) / Math.max(0.1, max - min)) * (height - pad * 2);
  const groups: TrendPointInput[][] = [];
  for (const point of sorted) {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    if (group && previous && diffDays(point.localDate, previous.localDate) === 1) group.push(point);
    else groups.push([point]);
  }
  const segments = groups.filter((group) => group.length > 1).map((group) => group.map((point, index) => `${index === 0 ? 'M' : 'L'}${xForDate(point.localDate)},${y(point.valueKg)}`));
  const areaPaths = segments.map((segment) => {
    const group = groups.find((candidate) => {
      const candidateFirst = candidate[0];
      const firstCommand = segment[0];
      return candidate.length > 1 && candidateFirst && firstCommand && xForDate(candidateFirst.localDate) === Number(firstCommand.slice(1).split(',')[0]);
    });
    const groupFirst = group?.[0];
    const groupLast = group?.at(-1);
    if (!group || !groupFirst || !groupLast) return '';
    return `${segment.join(' ')} L${xForDate(groupLast.localDate)},${height - pad} L${xForDate(groupFirst.localDate)},${height - pad} Z`;
  }).filter(Boolean);
  return { width, height, pad, xForDate, y, segments, areaPaths };
}
