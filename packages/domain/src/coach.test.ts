import type { DailyCheckin, DiaryDay, FoodEntry, Goal, Measurement, NutritionPlan } from '@form/contracts';
import { describe, expect, it } from 'vitest';
import { addDays, rollingWindows } from './dates';
import { reviewCoach, POLICY_VERSION, type CoachInput } from './coach';

const asOf = '2026-11-25';
const dates = rollingWindows(asOf).flat().sort();
const now = '2026-11-25T06:00:00.000Z';
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

const plan: NutritionPlan = {
  id: uuid(1),
  effectiveFrom: '2026-10-01',
  kcal: 2300,
  proteinG: 170,
  fatG: 75,
  carbG: 236.25,
  fiberG: 35,
  steps: 8000,
  waterMl: 2500,
  sleepMinutesMin: 420,
  sleepMinutesMax: 540,
  strengthSessionsPerWeek: 4,
  reason: 'test',
  policyVersion: 'form-plan-v1',
  createdAt: now
};

function weightMeasurement(date: string, value: number, index: number): Measurement {
  return {
    id: uuid(1000 + index), type: 'weight', value, unit: 'kg', measuredAt: `${date}T06:00:00.000Z`, localDate: date,
    source: 'manual', externalSampleId: null, preferred: true, createdAt: now, updatedAt: now, deletedAt: null, version: 1
  };
}

function completeDiary(date: string, index: number, kcal = 2300): { day: DiaryDay; entry: FoodEntry } {
  const entry: FoodEntry = {
    id: uuid(2000 + index), localDate: date, mealType: 'lunch', foodVersionId: null, labelSnapshot: 'synthetic meal', quantity: 1, unit: 'total', basis: 'consumed-total',
    nutrientSnapshot: { kcal, proteinG: 170, carbG: 236.25, fatG: 75, fiberG: 35 }, confidence: 'manual-estimate', source: 'manual',
    createdAt: now, updatedAt: now, deletedAt: null, version: 1
  };
  const day: DiaryDay = {
    id: uuid(3000 + index), localDate: date, completionState: 'complete', completionRevision: 1, foodRevision: 1, completedAt: now, zone: 'Asia/Jerusalem', createdAt: now, updatedAt: now
  };
  return { day, entry };
}

function checkin(date: string, index: number, energy = 4, hunger = 2): DailyCheckin {
  return {
    id: uuid(4000 + index), localDate: date, steps: 8000, waterMl: 2500, sleepMinutes: 450, trainingStatus: 'unknown', hunger1to5: hunger, energy1to5: energy,
    notes: null, createdAt: now, updatedAt: now, version: 1
  };
}

function fixture(weeklyMeans: [number, number, number], options: { weightsPerWeek?: number; intakeKcal?: number; energy?: number; hunger?: number; planEffectiveFrom?: string; sparseDiary?: boolean } = {}): CoachInput {
  const [oldestMean, priorMean, recentMean] = weeklyMeans;
  const weightsPerWeek = options.weightsPerWeek ?? 7;
  const measurements: Measurement[] = [];
  const diaryDays: DiaryDay[] = [];
  const foodEntries: FoodEntry[] = [];
  const checkins: DailyCheckin[] = [];
  dates.forEach((date, index) => {
    const weekIndex = Math.floor(index / 7); // sorted oldest -> recent: 0 oldest, 2 recent
    const value = weekIndex === 0 ? oldestMean : weekIndex === 1 ? priorMean : recentMean;
    if (index % 7 < weightsPerWeek) measurements.push(weightMeasurement(date, value, index));
    if (!options.sparseDiary || index % 7 < 5) {
      const { day, entry } = completeDiary(date, index, options.intakeKcal ?? 2300);
      diaryDays.push(day);
      foodEntries.push(entry);
    }
    checkins.push(checkin(date, index, options.energy ?? 4, options.hunger ?? 2));
  });
  return {
    asOfDate: asOf,
    timezone: 'Asia/Jerusalem',
    plans: [{ ...plan, effectiveFrom: options.planEffectiveFrom ?? plan.effectiveFrom }],
    goal: null,
    measurements,
    diaryDays,
    foodEntries,
    checkins,
    policyVersion: POLICY_VERSION
  };
}

describe('deterministic coach policy', () => {
  it('golden case: no logged weights produces collecting data and no recommendation', () => {
    const input = fixture([105, 104.4, 103.8]);
    input.measurements = [];
    const result = reviewCoach(input);
    expect(result.status).toBe('collecting-data');
    expect(result.suggestion.kind).toBe('none');
  });

  it('golden case: 4 weights per week is insufficient even after 21 days', () => {
    const result = reviewCoach(fixture([105, 104.4, 103.8], { weightsPerWeek: 4 }));
    expect(result.status).toBe('collecting-data');
    expect(result.reasonCodes).toContain('insufficient-weight-coverage');
  });

  it('golden case: adequate data and 105→104.4→103.8 means maintain', () => {
    const result = reviewCoach(fixture([105, 104.4, 103.8]));
    expect(result.status).toBe('maintain');
    expect(result.evidence.deltas.recentKg).toBeCloseTo(-0.6, 6);
  });

  it('golden case: stall with inconsistent intake requires logging/context review', () => {
    const result = reviewCoach(fixture([105, 104.9, 104.8], { intakeKcal: 3000 }));
    expect(result.status).toBe('review-logging-and-context');
    expect(result.suggestion.kind).toBe('none');
  });

  it('golden case: stall with adequate adherence and activity only suggests a non-binding adjustment', () => {
    const result = reviewCoach(fixture([105, 104.9, 104.8]));
    expect(result.status).toBe('consider-small-adjustment');
    expect(result.suggestion).toEqual({ kind: 'small-calorie-adjustment-discussion', rangeKcal: [100, 150], requiresConfirmation: true });
  });

  it('golden case: 105→103.8→102.6 triggers fast-loss review', () => {
    const result = reviewCoach(fixture([105, 103.8, 102.6]));
    expect(result.status).toBe('fast-loss-review');
  });

  it('golden case: plan changes inside the evaluation window restart calibration', () => {
    const result = reviewCoach(fixture([105, 104.4, 103.8], { planEffectiveFrom: addDays(asOf, -10) }));
    expect(result.status).toBe('collecting-data');
    expect(result.reasonCodes).toContain('plan-changed-during-calibration-window');
  });

  it('golden case: repeated low energy overrides deficit suggestions', () => {
    const result = reviewCoach(fixture([105, 104.9, 104.8], { energy: 1 }));
    expect(result.status).toBe('recovery-review');
    expect(result.suggestion.kind).toBe('none');
  });

  it('golden case: achieved weight-loss goal produces maintenance review, not further deficit', () => {
    const input = fixture([105, 104.4, 103.8]);
    const goal: Goal = {
      id: uuid(99), type: 'weight-loss', baselineKg: 105, targetKg: 104, effectiveFrom: '2026-10-01', status: 'active', createdAt: now, updatedAt: now
    };
    input.goal = goal;
    const result = reviewCoach(input);
    expect(result.status).toBe('goal-review');
    expect(result.suggestion.kind).toBe('maintenance-review');
  });

  it('same inputs are reproducible and changed inputs invalidate the fingerprint', () => {
    const input = fixture([105, 104.4, 103.8]);
    const first = reviewCoach(input);
    const second = reviewCoach(input);
    expect(second.inputFingerprint).toBe(first.inputFingerprint);
    input.foodEntries[0]!.nutrientSnapshot.kcal = 2400;
    const changed = reviewCoach(input);
    expect(changed.inputFingerprint).not.toBe(first.inputFingerprint);
  });
});

describe('coach branch safety hardening', () => {
  it('paused and concerning-symptom safety states override all other branches', () => {
    const paused = reviewCoach({ ...fixture([105, 104.9, 104.8]), safety: { paused: true, concerningSymptoms: false } });
    expect(paused.status).toBe('safety-review');
    expect(paused.reasonCodes).toContain('user-or-clinician-paused-review');
    const symptoms = reviewCoach({ ...fixture([105, 104.9, 104.8]), safety: { paused: false, concerningSymptoms: true } });
    expect(symptoms.reasonCodes).toContain('concerning-symptoms-reported');
  });
  it('high hunger alone, sparse food logs, rapid recent loss and ambiguous trend use distinct safe branches', () => {
    expect(reviewCoach(fixture([105, 104.9, 104.8], { hunger: 5 })).reasonCodes).toContain('repeated-high-hunger');
    const sparseInput = fixture([105, 104.4, 103.8]);
    sparseInput.diaryDays = sparseInput.diaryDays.filter((_, index) => index % 7 < 4);
    sparseInput.foodEntries = sparseInput.foodEntries.filter((_, index) => index % 7 < 4);
    const sparse = reviewCoach(sparseInput);
    expect(sparse.reasonCodes).toContain('insufficient-complete-food-logs');
    expect(reviewCoach(fixture([105, 104.8, 103.6])).status).toBe('monitor-fast-loss');
    expect(reviewCoach(fixture([105, 104.5, 104.2])).status).toBe('monitor');
  });
  it('weight-gain and maintenance goal achievement are detected and custom policy versions are preserved', () => {
    const input = fixture([105, 104.4, 103.8]);
    input.goal = { id: uuid(98), type: 'weight-gain', baselineKg: 100, targetKg: 103, effectiveFrom: '2026-10-01', status: 'active', createdAt: now, updatedAt: now };
    input.policyVersion = 'custom-policy-test';
    const result = reviewCoach(input);
    expect(result.status).toBe('goal-review');
    expect(result.policyVersion).toBe('custom-policy-test');
    input.goal = { ...input.goal, type: 'maintenance', targetKg: 103.5 };
    expect(reviewCoach(input).status).toBe('goal-review');
  });
});
