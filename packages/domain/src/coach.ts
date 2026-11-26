import type { CoachReview, DailyCheckin, DiaryDay, FoodEntry, Goal, Measurement, NutritionPlan } from '@form/contracts';
import { addDays, compareDates, rollingWindows } from './dates';
import { adherenceWithinTarget, completeDayIntakes, coverageCounts, mean, preferredDailyMeasurements } from './analytics';
import { stablePlanAcrossDates } from './plan';
import { sumEntryNutrients } from './nutrition';

export const POLICY_VERSION = 'form-coach-v1.0';

export type SafetyContext = {
  paused?: boolean;
  concerningSymptoms?: boolean;
  notes?: string;
};

export type CoachInput = {
  asOfDate: string;
  timezone: string;
  plans: NutritionPlan[];
  goal: Goal | null;
  measurements: Measurement[];
  diaryDays: DiaryDay[];
  foodEntries: FoodEntry[];
  checkins: DailyCheckin[];
  safety?: SafetyContext;
  policyVersion?: string;
};

export type WindowEvidence = {
  index: number;
  startDate: string;
  endDate: string;
  weightDays: number;
  weightMeanKg: number | null;
  completeFoodDays: number;
  intakeMeanKcal: number | null;
  adherentDays: number;
  eligibleIntakeDays: number;
  stepDays: number;
  meanSteps: number | null;
  sleepDays: number;
  meanHunger: number | null;
  meanEnergy: number | null;
};

export type CoachResult = {
  status: CoachReview['status'];
  reasonCodes: string[];
  evidence: {
    policyVersion: string;
    asOfDate: string;
    timezone: string;
    windows: WindowEvidence[];
    deltas: { recentKg: number | null; priorKg: number | null };
    stablePlan: boolean;
    planId: string | null;
    goalAchieved: boolean;
    nextEligibleReviewDate: string | null;
  };
  suggestion: { kind: 'none' } | { kind: 'small-calorie-adjustment-discussion'; rangeKcal: [number, number]; requiresConfirmation: true } | { kind: 'maintenance-review'; requiresConfirmation: true };
  inputFingerprint: string;
  policyVersion: string;
};

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}

export function stableFingerprint(value: unknown): string {
  // Deterministic non-cryptographic fingerprint for reproducibility/change detection, not tamper resistance.
  const text = canonicalize(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `fnv128-${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

function avgWeights(points: Array<{ localDate: string; valueKg: number }>, dates: string[]): number | null {
  const set = new Set(dates);
  const values = points.filter((point) => set.has(point.localDate)).map((point) => point.valueKg);
  return mean(values);
}

function avgCheckin(values: Array<number | null>): number | null {
  return mean(values.filter((value): value is number => value !== null));
}

export function reviewCoach(input: CoachInput): CoachResult {
  const policyVersion = input.policyVersion ?? POLICY_VERSION;
  const windows = rollingWindows(input.asOfDate, 3, 7);
  const allDates = windows.flat();
  const weightPoints = preferredDailyMeasurements(input.measurements, 'weight');
  const intakes = completeDayIntakes(input.foodEntries, input.diaryDays);
  const stablePlan = stablePlanAcrossDates(input.plans, allDates);
  const checkinByDate = new Map(input.checkins.map((checkin) => [checkin.localDate, checkin]));

  const evidenceWindows: WindowEvidence[] = windows.map((dates, index) => {
    const coverage = coverageCounts(dates, input.measurements, input.diaryDays, input.checkins);
    const windowIntakes = intakes.filter((intake) => dates.includes(intake.localDate));
    const adherence = stablePlan ? adherenceWithinTarget(windowIntakes, stablePlan) : { eligibleDays: 0, adherentDays: 0, meanKcal: null };
    const checkins = dates.map((date) => checkinByDate.get(date)).filter((value): value is DailyCheckin => value !== undefined);
    return {
      index,
      startDate: dates[0] ?? input.asOfDate,
      endDate: dates.at(-1) ?? input.asOfDate,
      weightDays: coverage.weightDays,
      weightMeanKg: avgWeights(weightPoints, dates),
      completeFoodDays: coverage.completeFoodDays,
      intakeMeanKcal: adherence.meanKcal,
      adherentDays: adherence.adherentDays,
      eligibleIntakeDays: adherence.eligibleDays,
      stepDays: coverage.stepDays,
      meanSteps: avgCheckin(checkins.map((checkin) => checkin.steps)),
      sleepDays: coverage.sleepDays,
      meanHunger: avgCheckin(checkins.map((checkin) => checkin.hunger1to5)),
      meanEnergy: avgCheckin(checkins.map((checkin) => checkin.energy1to5))
    };
  });

  const recentMean = evidenceWindows[0]?.weightMeanKg ?? null;
  const priorMean = evidenceWindows[1]?.weightMeanKg ?? null;
  const oldestMean = evidenceWindows[2]?.weightMeanKg ?? null;
  const deltaRecent = recentMean !== null && priorMean !== null ? recentMean - priorMean : null;
  const deltaPrior = priorMean !== null && oldestMean !== null ? priorMean - oldestMean : null;
  const latestWeight = weightPoints.at(-1)?.valueKg ?? null;
  const goalAchieved = input.goal !== null && latestWeight !== null && (
    input.goal.type === 'weight-loss' ? latestWeight <= input.goal.targetKg :
    input.goal.type === 'weight-gain' ? latestWeight >= input.goal.targetKg :
    Math.abs(latestWeight - input.goal.targetKg) <= 1
  );

  const reasonCodes: string[] = [];
  let status: CoachReview['status'] = 'collecting-data';
  let suggestion: CoachResult['suggestion'] = { kind: 'none' };

  const latestCheckins = input.checkins.filter((checkin) => compareDates(checkin.localDate, addDays(input.asOfDate, -7)) >= 0 && compareDates(checkin.localDate, input.asOfDate) < 0);
  const repeatedLowEnergy = latestCheckins.filter((checkin) => checkin.energy1to5 !== null && checkin.energy1to5 <= 2).length >= 3;
  const repeatedHighHunger = latestCheckins.filter((checkin) => checkin.hunger1to5 !== null && checkin.hunger1to5 >= 4).length >= 3;

  if (input.safety?.paused || input.safety?.concerningSymptoms) {
    status = 'safety-review';
    reasonCodes.push(input.safety.paused ? 'user-or-clinician-paused-review' : 'concerning-symptoms-reported');
  } else if (repeatedLowEnergy || repeatedHighHunger) {
    status = 'recovery-review';
    if (repeatedLowEnergy) reasonCodes.push('repeated-low-energy');
    if (repeatedHighHunger) reasonCodes.push('repeated-high-hunger');
  } else if (goalAchieved) {
    status = 'goal-review';
    reasonCodes.push('configured-goal-reached');
    suggestion = { kind: 'maintenance-review', requiresConfirmation: true };
  } else if (!stablePlan) {
    status = 'collecting-data';
    reasonCodes.push('plan-changed-during-calibration-window');
  } else {
    const enoughWeight = evidenceWindows.every((window) => window.weightDays >= 5);
    const enoughFood = evidenceWindows.every((window) => window.completeFoodDays >= 5);
    if (!enoughWeight || !enoughFood) {
      status = 'collecting-data';
      if (!enoughWeight) reasonCodes.push('insufficient-weight-coverage');
      if (!enoughFood) reasonCodes.push('insufficient-complete-food-logs');
    } else if (deltaRecent !== null && deltaPrior !== null && deltaRecent < -1 && deltaPrior < -1) {
      status = 'fast-loss-review';
      reasonCodes.push('two-week-loss-faster-than-1kg-per-week');
    } else if (deltaRecent !== null && deltaRecent < -1) {
      status = 'monitor-fast-loss';
      reasonCodes.push('recent-loss-faster-than-1kg-per-week');
    } else if (deltaRecent !== null && deltaPrior !== null && deltaRecent >= -0.2 && deltaPrior >= -0.2) {
      const adequateAdherence = evidenceWindows.every((window) => window.eligibleIntakeDays >= 5 && window.adherentDays >= 4);
      const adequateActivityRecovery = evidenceWindows.every((window) => window.stepDays >= 5);
      const priorSteps = evidenceWindows[1]?.meanSteps ?? null;
      const recentSteps = evidenceWindows[0]?.meanSteps ?? null;
      const majorActivityShift = priorSteps !== null && priorSteps > 0 && recentSteps !== null && Math.abs(recentSteps - priorSteps) / priorSteps > 0.2;
      if (!adequateAdherence || !adequateActivityRecovery || majorActivityShift) {
        status = 'review-logging-and-context';
        if (!adequateAdherence) reasonCodes.push('intake-not-consistently-near-target');
        if (!adequateActivityRecovery) reasonCodes.push('insufficient-activity-context');
        if (majorActivityShift) reasonCodes.push('major-activity-shift-requires-review');
      } else {
        status = 'consider-small-adjustment';
        reasonCodes.push('two-week-stall-with-adequate-context');
        suggestion = { kind: 'small-calorie-adjustment-discussion', rangeKcal: [100, 150], requiresConfirmation: true };
      }
    } else if (deltaRecent !== null && deltaRecent <= -0.4 && deltaRecent >= -0.8) {
      status = 'maintain';
      reasonCodes.push('weekly-loss-within-target-range');
    } else {
      status = 'monitor';
      reasonCodes.push('trend-not-yet-actionable');
    }
  }

  if (reasonCodes.length === 0) reasonCodes.push('policy-evaluation-complete');
  const nextEligibleReviewDate = stablePlan ? addDays(stablePlan.effectiveFrom, 21) : null;
  const evidence = {
    policyVersion,
    asOfDate: input.asOfDate,
    timezone: input.timezone,
    windows: evidenceWindows,
    deltas: { recentKg: deltaRecent, priorKg: deltaPrior },
    stablePlan: stablePlan !== null,
    planId: stablePlan?.id ?? null,
    goalAchieved,
    nextEligibleReviewDate
  };
  const fingerprintInput = {
    asOfDate: input.asOfDate,
    timezone: input.timezone,
    planIds: input.plans.map((plan) => [plan.id, plan.effectiveFrom, plan.kcal, plan.proteinG, plan.fatG, plan.carbG]),
    weights: weightPoints.map((point) => [point.localDate, point.valueKg, point.measurementId]),
    diary: input.diaryDays.map((day) => [day.localDate, day.completionState, day.completionRevision, day.foodRevision]),
    entries: input.foodEntries.filter((entry) => entry.deletedAt === null).map((entry) => [entry.id, entry.localDate, entry.quantity, entry.nutrientSnapshot]),
    checkins: input.checkins.map((checkin) => [checkin.localDate, checkin.steps, checkin.sleepMinutes, checkin.hunger1to5, checkin.energy1to5]),
    safety: input.safety ?? {},
    policyVersion
  };
  return {
    status,
    reasonCodes,
    evidence,
    suggestion,
    inputFingerprint: stableFingerprint(fingerprintInput),
    policyVersion
  };
}

export function entryEnergySnapshot(entries: FoodEntry[]): { kcalKnownSubtotal: number; kcalUnknownCount: number } {
  const totals = sumEntryNutrients(entries);
  return { kcalKnownSubtotal: totals.totals.kcal, kcalUnknownCount: totals.unknownCounts.kcal };
}
