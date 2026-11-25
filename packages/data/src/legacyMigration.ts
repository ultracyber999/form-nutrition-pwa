import type { DiaryDay, ExportBundle, FoodEntry, FoodVersion, LegacyState, MealType, Measurement, DailyCheckin, NutritionPlan, Goal, Profile } from '@form/contracts';
import { legacyStateSchema } from '@form/contracts';
import { deriveCarbTargetG } from '@form/domain';
import { builtinFoods, SYNTHETIC_NOW } from '@form/test-data';
import { deterministicUuid } from './id';

export type LegacyMigrationResult = {
  bundle: ExportBundle;
  report: {
    days: number;
    entries: number;
    customFoods: number;
    measurements: number;
    checkins: number;
    skippedEmptyCompletionMarkers: number;
    warnings: string[];
    dateRange: [string, string] | null;
  };
};

const mealMap: Record<string, MealType> = {
  בוקר: 'breakfast',
  צהריים: 'lunch',
  ביניים: 'snack',
  ערב: 'dinner',
  אחר: 'other'
};

function migratedAt(): string {
  return new Date().toISOString();
}

export function buildLegacyMigration(input: unknown): LegacyMigrationResult {
  const parsed = legacyStateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid legacy backup: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  const legacy: LegacyState = parsed.data;
  const now = migratedAt();
  const warnings: string[] = [];
  const profile: Profile = {
    id: deterministicUuid('legacy-profile', 'form.cut.v1'),
    locale: 'he-IL',
    timezone: 'Asia/Jerusalem',
    unitPreference: 'metric',
    heightCm: null,
    createdAt: now,
    updatedAt: now
  };
  const goal: Goal = {
    id: deterministicUuid('legacy-goal', `${legacy.settings.start}:${legacy.settings.goal}:${legacy.settings.since}`),
    type: legacy.settings.goal < legacy.settings.start ? 'weight-loss' : legacy.settings.goal > legacy.settings.start ? 'weight-gain' : 'maintenance',
    baselineKg: legacy.settings.start,
    targetKg: legacy.settings.goal,
    effectiveFrom: legacy.settings.since,
    status: 'active',
    createdAt: now,
    updatedAt: now
  };
  const plan: NutritionPlan = {
    id: deterministicUuid('legacy-plan', `${legacy.settings.calSince}:${legacy.settings.calories}:${legacy.settings.protein}:${legacy.settings.fat}`),
    effectiveFrom: legacy.settings.calSince,
    kcal: legacy.settings.calories,
    proteinG: legacy.settings.protein,
    fatG: legacy.settings.fat,
    carbG: deriveCarbTargetG(legacy.settings.calories, legacy.settings.protein, legacy.settings.fat),
    fiberG: legacy.settings.fiber,
    steps: legacy.settings.steps,
    waterMl: legacy.settings.water,
    sleepMinutesMin: null,
    sleepMinutesMax: null,
    strengthSessionsPerWeek: Math.round(legacy.settings.training),
    reason: 'Migrated from FORM 2.0 single settings snapshot; earlier target history is unknown',
    policyVersion: 'legacy-import-v1',
    createdAt: now
  };

  const builtinByExternalId = new Map(builtinFoods.map((food) => [food.source.externalId, food]));
  const customFoods: FoodVersion[] = legacy.custom.map((food) => ({
    id: deterministicUuid('legacy-custom-food-version', food.id),
    foodId: deterministicUuid('legacy-custom-food', food.id),
    source: {
      id: deterministicUuid('legacy-custom-food-source', food.id),
      provider: 'legacy-import',
      license: null,
      attribution: 'Migrated user custom food from FORM 2.0',
      externalId: food.id
    },
    name: food.name,
    brand: null,
    aliases: [],
    preparationState: 'unknown',
    basis: 'per-100g',
    nutrients: { kcal: food.k, proteinG: food.p, carbG: food.c, fatG: food.f, fiberG: food.fi ?? null },
    servingGrams: null,
    version: 1,
    createdAt: now,
    updatedAt: now
  }));
  const customByExternalId = new Map(customFoods.map((food) => [food.source.externalId, food]));

  const entries: FoodEntry[] = [];
  const diaryDays: DiaryDay[] = [];
  const measurements: Measurement[] = [];
  const checkins: DailyCheckin[] = [];
  let skippedEmptyCompletionMarkers = 0;
  const dates = Object.keys(legacy.days).sort();

  for (const localDate of dates) {
    const day = legacy.days[localDate];
    if (!day) continue;
    let foodRevision = 0;
    for (const legacyEntry of day.food) {
      foodRevision += 1;
      const catalog = builtinByExternalId.get(legacyEntry.id) ?? customByExternalId.get(legacyEntry.id) ?? null;
      const factor = legacyEntry.q / 100;
      entries.push({
        id: deterministicUuid('legacy-food-entry', `${localDate}:${legacyEntry.id}:${legacyEntry.q}:${legacyEntry.meal}`),
        localDate,
        mealType: mealMap[legacyEntry.meal] ?? 'other',
        foodVersionId: catalog?.id ?? null,
        labelSnapshot: legacyEntry.name,
        quantity: legacyEntry.q,
        unit: 'g',
        basis: 'mass-grams',
        nutrientSnapshot: {
          kcal: legacyEntry.k * factor,
          proteinG: legacyEntry.p * factor,
          carbG: legacyEntry.c * factor,
          fatG: legacyEntry.f * factor,
          fiberG: legacyEntry.fi == null ? null : legacyEntry.fi * factor
        },
        confidence: catalog?.source.provider === 'builtin-generic' ? 'generic-estimate' : 'manual-estimate',
        source: 'legacy-import',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        version: 1
      });
    }
    const hasFood = day.food.length > 0;
    const complete = day.complete === true && hasFood;
    if (day.complete === true && !hasFood) skippedEmptyCompletionMarkers += 1;
    diaryDays.push({
      id: deterministicUuid('legacy-diary-day', localDate),
      localDate,
      completionState: complete ? 'complete' : hasFood ? 'partial' : 'missing',
      completionRevision: complete ? foodRevision : 0,
      foodRevision,
      completedAt: complete ? now : null,
      zone: 'Asia/Jerusalem',
      createdAt: now,
      updatedAt: now
    });

    if (day.weight != null) {
      measurements.push({
        id: deterministicUuid('legacy-measurement-weight', localDate),
        type: 'weight',
        value: day.weight,
        unit: 'kg',
        measuredAt: `${localDate}T06:00:00+02:00`,
        localDate,
        source: 'legacy-import',
        externalSampleId: null,
        preferred: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        version: 1
      });
    }
    if (day.waist != null) {
      measurements.push({
        id: deterministicUuid('legacy-measurement-waist', localDate),
        type: 'waist',
        value: day.waist,
        unit: 'cm',
        measuredAt: `${localDate}T06:00:00+02:00`,
        localDate,
        source: 'legacy-import',
        externalSampleId: null,
        preferred: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        version: 1
      });
    }
    const hasCheckin = day.steps != null || day.water != null || day.sleep != null || day.training != null || day.hunger != null || day.energy != null || day.notes != null;
    if (hasCheckin) {
      checkins.push({
        id: deterministicUuid('legacy-checkin', localDate),
        localDate,
        steps: day.steps == null ? null : Math.round(day.steps),
        waterMl: day.water == null ? null : Math.round(day.water),
        sleepMinutes: day.sleep == null ? null : Math.round(day.sleep * 60),
        trainingStatus: day.training ?? null,
        hunger1to5: day.hunger ?? null,
        energy1to5: day.energy ?? null,
        notes: day.notes ?? null,
        createdAt: now,
        updatedAt: now,
        version: 1
      });
    }
  }
  if (legacy.theme) warnings.push(`Theme preference '${legacy.theme}' is not part of the v1 export contract and should be reapplied in settings.`);

  return {
    bundle: {
      format: 'form-export',
      schemaVersion: 1,
      exportedAt: now,
      profile,
      goal,
      nutritionPlans: [plan],
      foodVersions: [...builtinFoods, ...customFoods],
      foodEntries: entries,
      diaryDays,
      measurements,
      dailyCheckins: checkins,
      mealTemplates: [],
      recipes: [],
      coachReviews: []
    },
    report: {
      days: dates.length,
      entries: entries.length,
      customFoods: customFoods.length,
      measurements: measurements.length,
      checkins: checkins.length,
      skippedEmptyCompletionMarkers,
      warnings,
      dateRange: dates.length ? [dates[0] ?? '', dates.at(-1) ?? ''] : null
    }
  };
}

export function parseLegacyJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid legacy backup: not valid JSON');
  }
}

export const legacyFixtureHint = {
  storageKey: 'form.cut.v1',
  fixtureGeneratedAt: SYNTHETIC_NOW
} as const;
