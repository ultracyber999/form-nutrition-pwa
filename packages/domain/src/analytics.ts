import type { DailyCheckin, DiaryDay, FoodEntry, Goal, Measurement, NutritionPlan } from '@form/contracts';
import { addDays, compareDates, diffDays } from './dates';
import { sumEntryNutrients } from './nutrition';

export type DailyWeightPoint = {
  localDate: string;
  valueKg: number;
  measurementId: string;
  source: Measurement['source'];
  measuredAt: string;
};

export function preferredDailyMeasurements(measurements: Measurement[], type: Measurement['type'] = 'weight'): DailyWeightPoint[] {
  const active = measurements.filter((measurement) => measurement.type === type && measurement.deletedAt === null);
  const byDate = new Map<string, Measurement[]>();
  for (const measurement of active) {
    const list = byDate.get(measurement.localDate) ?? [];
    list.push(measurement);
    byDate.set(measurement.localDate, list);
  }
  return [...byDate.entries()].map(([localDate, rows]) => {
    const selected = rows.find((row) => row.preferred) ?? [...rows].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
    if (!selected) throw new Error('unreachable measurement selection');
    return { localDate, valueKg: selected.value, measurementId: selected.id, source: selected.source, measuredAt: selected.measuredAt };
  }).sort((a, b) => compareDates(a.localDate, b.localDate));
}

export function trailingAverage(points: DailyWeightPoint[], endDate: string, lengthDays = 7, minCoverage = 4): { average: number | null; coverage: number; points: DailyWeightPoint[] } {
  const start = addDays(endDate, -(lengthDays - 1));
  const window = points.filter((point) => compareDates(point.localDate, start) >= 0 && compareDates(point.localDate, endDate) <= 0);
  const coverage = window.length;
  return {
    average: coverage >= minCoverage ? window.reduce((sum, point) => sum + point.valueKg, 0) / coverage : null,
    coverage,
    points: window
  };
}

export type RangeKey = '7d' | '30d' | '90d' | 'all';

export function filterRange<T extends { localDate: string }>(rows: T[], endDate: string, range: RangeKey): T[] {
  if (range === 'all') return rows;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const start = addDays(endDate, -(days - 1));
  return rows.filter((row) => compareDates(row.localDate, start) >= 0 && compareDates(row.localDate, endDate) <= 0);
}

export function completeDayIntakes(entries: FoodEntry[], diaryDays: DiaryDay[]): Array<{ localDate: string; kcal: number; proteinG: number; completeEnergy: boolean }> {
  const completeDates = new Set(diaryDays.filter((day) => day.completionState === 'complete' && day.completionRevision === day.foodRevision).map((day) => day.localDate));
  const byDate = new Map<string, FoodEntry[]>();
  for (const entry of entries) {
    if (!completeDates.has(entry.localDate)) continue;
    const list = byDate.get(entry.localDate) ?? [];
    list.push(entry);
    byDate.set(entry.localDate, list);
  }
  return [...byDate.entries()].map(([localDate, rows]) => {
    const totals = sumEntryNutrients(rows);
    return { localDate, kcal: totals.totals.kcal, proteinG: totals.totals.proteinG, completeEnergy: totals.complete.kcal };
  }).sort((a, b) => compareDates(a.localDate, b.localDate));
}

export function goalProgress(goal: Goal | null, latestWeightKg: number | null): { ratio: number | null; clampedPercent: number | null; signedChangeKg: number | null } {
  if (!goal || latestWeightKg === null) return { ratio: null, clampedPercent: null, signedChangeKg: null };
  const denominator = goal.baselineKg - goal.targetKg;
  const signedChangeKg = latestWeightKg - goal.baselineKg;
  if (denominator === 0) return { ratio: null, clampedPercent: null, signedChangeKg };
  const ratio = (goal.baselineKg - latestWeightKg) / denominator;
  return { ratio, clampedPercent: Math.max(0, Math.min(100, ratio * 100)), signedChangeKg };
}

export function coverageCounts(dates: string[], measurements: Measurement[], diaryDays: DiaryDay[], checkins: DailyCheckin[]): {
  weightDays: number;
  completeFoodDays: number;
  stepDays: number;
  sleepDays: number;
} {
  const dateSet = new Set(dates);
  const weightDays = new Set(measurements.filter((m) => m.type === 'weight' && m.deletedAt === null && dateSet.has(m.localDate)).map((m) => m.localDate)).size;
  const completeFoodDays = diaryDays.filter((d) => dateSet.has(d.localDate) && d.completionState === 'complete' && d.completionRevision === d.foodRevision).length;
  const stepDays = checkins.filter((c) => dateSet.has(c.localDate) && c.steps !== null).length;
  const sleepDays = checkins.filter((c) => dateSet.has(c.localDate) && c.sleepMinutes !== null).length;
  return { weightDays, completeFoodDays, stepDays, sleepDays };
}

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function adherenceWithinTarget(intakes: Array<{ localDate: string; kcal: number; completeEnergy: boolean }>, plan: NutritionPlan, toleranceKcal = 150): { eligibleDays: number; adherentDays: number; meanKcal: number | null } {
  const valid = intakes.filter((intake) => intake.completeEnergy);
  const adherentDays = valid.filter((intake) => Math.abs(intake.kcal - plan.kcal) <= toleranceKcal).length;
  return { eligibleDays: valid.length, adherentDays, meanKcal: mean(valid.map((intake) => intake.kcal)) };
}

export function daysSince(latestDate: string | null, asOfDate: string): number | null {
  return latestDate === null ? null : diffDays(asOfDate, latestDate);
}
