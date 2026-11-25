import type { DailyCheckin, DiaryDay, FoodEntry, Goal, Measurement, NutritionPlan, Recipe } from '@form/contracts';
import { describe, expect, it } from 'vitest';
import { adherenceWithinTarget, completeDayIntakes, coverageCounts, daysSince, filterRange, goalProgress, mean, preferredDailyMeasurements, trailingAverage } from './analytics';
import { assertIsoDate, compareDates, formatIsoInTimeZone, isValidTimeZone } from './dates';
import { calculateConsumed, ingredientNutrients, recipePortionNutrients, recipeTotalNutrients, recipeTotals, remainingKcal, roundDisplay, scaleNutrients, sumEntryNutrients, validatePlanTargets } from './nutrition';
import { assertNoDuplicateEffectiveDates, calibrationElapsedDays, nextPlanEffectiveDate, resolvePlanForDate, sortPlans, stablePlanAcrossDates } from './plan';

const now = '2026-01-01T00:00:00.000Z';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const nutrients = { kcal: 100, proteinG: 10, carbG: 10, fatG: 2, fiberG: 1 };
const plan: NutritionPlan = { id: id(1), effectiveFrom: '2026-01-01', kcal: 2000, proteinG: 150, fatG: 60, carbG: 215, fiberG: 30, steps: null, waterMl: null, sleepMinutesMin: null, sleepMinutesMax: null, strengthSessionsPerWeek: null, reason: null, policyVersion: 'test', createdAt: now };
const newerPlan = { ...plan, id: id(2), effectiveFrom: '2026-02-01', kcal: 2100 };
const measurement = (date: string, value: number, preferred = true, n = 1): Measurement => ({ id: id(n), type: 'weight', value, unit: 'kg', measuredAt: `${date}T08:00:00.000Z`, localDate: date, source: 'manual', externalSampleId: null, preferred, createdAt: now, updatedAt: now, deletedAt: null, version: 1 });
const entry = (date: string, kcal: number | null, n = 1, deletedAt: string | null = null): FoodEntry => ({ id: id(n), localDate: date, mealType: 'lunch', foodVersionId: null, labelSnapshot: 'x', quantity: 1, unit: 'total', basis: 'consumed-total', nutrientSnapshot: { kcal, proteinG: 100, carbG: 100, fatG: 50, fiberG: 20 }, confidence: 'manual-estimate', source: 'manual', createdAt: now, updatedAt: now, deletedAt, version: 1 });
const day = (date: string, complete = true, n = 1): DiaryDay => ({ id: id(n), localDate: date, completionState: complete ? 'complete' : 'partial', completionRevision: complete ? 1 : 0, foodRevision: 1, completedAt: complete ? now : null, zone: 'Asia/Jerusalem', createdAt: now, updatedAt: now });
const checkin = (date: string, n = 1): DailyCheckin => ({ id: id(n), localDate: date, steps: 8000, waterMl: null, sleepMinutes: 450, trainingStatus: null, hunger1to5: null, energy1to5: null, notes: null, createdAt: now, updatedAt: now, version: 1 });

describe('critical nutrition hardening', () => {
  it('rejects invalid scale, quantity, basis and consumed-total combinations', () => {
    expect(() => scaleNutrients(nutrients, -1)).toThrow();
    expect(() => scaleNutrients(nutrients, Number.NaN)).toThrow();
    expect(() => calculateConsumed({ basis: 'per-100g', nutrients }, 0, 'mass-grams')).toThrow();
    expect(() => calculateConsumed({ basis: 'per-serving', nutrients }, 100, 'mass-grams')).toThrow();
    expect(() => calculateConsumed({ basis: 'per-100g', nutrients }, 1, 'serving-count')).toThrow();
    expect(() => calculateConsumed({ basis: 'consumed-total', nutrients }, 2, 'consumed-total')).toThrow();
    expect(() => calculateConsumed({ basis: 'per-100g', nutrients }, 1, 'unexpected' as never)).toThrow();
    expect(calculateConsumed({ basis: 'per-serving', nutrients }, 2, 'serving-count').kcal).toBe(200);
    expect(scaleNutrients({ ...nutrients, kcal: null }, 2).kcal).toBeNull();
    expect(scaleNutrients(nutrients, 2).kcal).toBe(200);
  });
  it('handles deleted/empty totals, validation failures, recipes and portions', () => {
    expect(sumEntryNutrients([]).complete.kcal).toBe(false);
    expect(sumEntryNutrients([entry('2026-01-01', 100, 1, now)]).entryCount).toBe(0);
    expect(remainingKcal(2000, sumEntryNutrients([entry('2026-01-01', null)])).incomplete).toBe(true);
    expect(validatePlanTargets({ kcal: 700, proteinG: 1, fatG: 1, carbG: 1 })).toContain('calorie target below supported input bound');
    expect(validatePlanTargets({ kcal: 2000, proteinG: 100, fatG: 50, carbG: 1 })[0]).toMatch('carb target');
    expect(validatePlanTargets({ kcal: 1200, proteinG: 250, fatG: 100, carbG: 0 })).toContain('protein and fat exceed available calories');
    const recipe: Recipe = { id: id(9), name: 'r', yieldG: 200, servingCount: 2, ingredients: [{ id: id(10), foodVersionId: null, labelSnapshot: 'i', quantityG: 100, nutrientSnapshotPer100g: nutrients, sortOrder: 0 }], createdAt: now, updatedAt: now, deletedAt: null, version: 1 };
    expect(ingredientNutrients(recipe.ingredients[0]!).kcal).toBe(100);
    expect(recipeTotalNutrients(recipe).kcal).toBe(100);
    expect(recipeTotals(recipe).totals.kcal).toBe(100);
    expect(recipePortionNutrients(recipe, { grams: 100 }).kcal).toBe(50);
    expect(recipePortionNutrients(recipe, { servings: 1 }).kcal).toBe(50);
    expect(() => recipePortionNutrients(recipe, {})).toThrow();
    expect(() => recipePortionNutrients({ ...recipe, yieldG: null }, { grams: 1 })).toThrow();
    expect(() => recipePortionNutrients({ ...recipe, servingCount: null }, { servings: 1 })).toThrow();
    const unknown = { ...recipe, ingredients: [{ ...recipe.ingredients[0]!, nutrientSnapshotPer100g: { ...nutrients, kcal: null } }] };
    expect(recipeTotalNutrients(unknown).kcal).toBeNull();
    expect(roundDisplay(1.005, 2)).toBe(1.01);
  });
});

describe('critical plans and dates hardening', () => {
  it('resolves effective-dated plans without rewriting history', () => {
    const sorted = sortPlans([newerPlan, plan]);
    expect(sorted[0]!.id).toBe(plan.id);
    expect(resolvePlanForDate([newerPlan, plan], '2026-01-15')!.id).toBe(plan.id);
    expect(resolvePlanForDate([newerPlan, plan], '2026-02-01')!.id).toBe(newerPlan.id);
    expect(resolvePlanForDate([newerPlan], '2026-01-15')).toBeNull();
    expect(stablePlanAcrossDates([newerPlan, plan], ['2026-01-15','2026-02-15'])).toBeNull();
    expect(stablePlanAcrossDates([newerPlan, plan], ['2026-01-15','2026-01-16'])!.id).toBe(plan.id);
    expect(stablePlanAcrossDates([], ['2026-01-15'])).toBeNull();
    expect(stablePlanAcrossDates([newerPlan], ['2026-01-15'])).toBeNull();
    expect(sortPlans([{ ...plan, id: id(4), createdAt: '2026-01-02T00:00:00.000Z' }, plan])[0]!.id).toBe(plan.id);
    expect(() => assertNoDuplicateEffectiveDates([plan, { ...plan, id: id(3) }])).toThrow();
    expect(calibrationElapsedDays(plan, '2026-01-01')).toBe(1);
    expect(nextPlanEffectiveDate('2026-02-01', '2026-01-01')).toBe('2026-02-01');
    expect(nextPlanEffectiveDate('2026-02-01', '2026-03-01')).toBe('2026-03-01');
  });
  it('validates dates/timezones and compares exactly', () => {
    expect(assertIsoDate('2026-02-28')).toBe('2026-02-28');
    expect(() => assertIsoDate('2026-02-30')).toThrow();
    expect(() => assertIsoDate('bad')).toThrow();
    expect(compareDates('2026-01-01', '2026-01-01')).toBe(0);
    expect(isValidTimeZone('Asia/Jerusalem')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(formatIsoInTimeZone(new Date('2026-01-01T00:30:00Z'), 'Asia/Jerusalem')).toBe('2026-01-01');
  });
});

describe('critical analytics hardening', () => {
  it('selects preferred or latest measurements and calculates windows/ranges', () => {
    const points = preferredDailyMeasurements([measurement('2026-01-01', 80, false, 1), { ...measurement('2026-01-01', 81, true, 2), measuredAt: '2026-01-01T07:00:00.000Z' }, measurement('2026-01-02', 82, true, 3), { ...measurement('2026-01-03', 83, true, 4), deletedAt: now }]);
    expect(points).toHaveLength(2);
    expect(points[0]!.valueKg).toBe(81);
    expect(trailingAverage(points, '2026-01-07', 7, 2).average).toBe(81.5);
    expect(trailingAverage(points, '2026-01-07', 7, 3).average).toBeNull();
    expect(filterRange(points, '2026-01-07', '7d')).toHaveLength(2);
    expect(filterRange(points, '2026-01-07', 'all')).toHaveLength(2);
  });
  it('calculates intake, goal progress, coverage and adherence with incomplete data explicit', () => {
    const entries = [entry('2026-01-01', 2000, 1), entry('2026-01-01', null, 2), entry('2026-01-02', 2200, 3)];
    const days = [day('2026-01-01', true, 1), { ...day('2026-01-02', true, 2), completionRevision: 2 }, day('2026-01-03', false, 3)];
    const intakes = completeDayIntakes(entries, days);
    expect(intakes).toHaveLength(1);
    expect(intakes[0]!.completeEnergy).toBe(false);
    const goal: Goal = { id: id(8), type: 'weight-loss', baselineKg: 90, targetKg: 80, effectiveFrom: '2026-01-01', status: 'active', createdAt: now, updatedAt: now };
    expect(goalProgress(goal, 85).clampedPercent).toBe(50);
    expect(goalProgress(goal, 70).clampedPercent).toBe(100);
    expect(goalProgress(goal, 95).clampedPercent).toBe(0);
    expect(goalProgress({ ...goal, targetKg: 90 }, 85).ratio).toBeNull();
    expect(goalProgress(null, 85).ratio).toBeNull();
    expect(coverageCounts(['2026-01-01'], [measurement('2026-01-01', 80)], days, [checkin('2026-01-01')])).toEqual({ weightDays: 1, completeFoodDays: 1, stepDays: 1, sleepDays: 1 });
    expect(mean([])).toBeNull();
    expect(adherenceWithinTarget([{ localDate: '2026-01-01', kcal: 2100, completeEnergy: true }, { localDate: '2026-01-02', kcal: 3000, completeEnergy: true }, { localDate: '2026-01-03', kcal: 0, completeEnergy: false }], plan)).toEqual({ eligibleDays: 2, adherentDays: 1, meanKcal: 2550 });
    expect(daysSince('2026-01-01', '2026-01-03')).toBe(2);
    expect(daysSince(null, '2026-01-03')).toBeNull();
  });
});
