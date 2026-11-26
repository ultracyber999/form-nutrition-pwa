import { z } from 'zod';

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'invalid calendar date');
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const uuidSchema = z.uuid();
export const nullableNumber = z.number().nullable();

export const nutrientProfileSchema = z.object({
  kcal: z.number().min(0).max(10000).nullable(),
  proteinG: z.number().min(0).max(1000).nullable(),
  carbG: z.number().min(0).max(1200).nullable(),
  fatG: z.number().min(0).max(1000).nullable(),
  fiberG: z.number().min(0).max(300).nullable()
});
export type NutrientProfile = z.infer<typeof nutrientProfileSchema>;

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'snack', 'dinner', 'other']);
export type MealType = z.infer<typeof mealTypeSchema>;

export const unitPreferenceSchema = z.enum(['metric', 'imperial']);
export const localeSchema = z.enum(['he-IL', 'en-US']);
export const themeSchema = z.enum(['dark', 'light', 'system']);

export const profileSchema = z.object({
  id: uuidSchema,
  locale: localeSchema,
  timezone: z.string().min(1).max(100),
  unitPreference: unitPreferenceSchema,
  heightCm: z.number().positive().max(260).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type Profile = z.infer<typeof profileSchema>;

export const goalSchema = z.object({
  id: uuidSchema,
  type: z.enum(['weight-loss', 'maintenance', 'weight-gain']),
  baselineKg: z.number().min(35).max(350),
  targetKg: z.number().min(35).max(350),
  effectiveFrom: isoDateSchema,
  status: z.enum(['active', 'paused', 'completed', 'archived']),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type Goal = z.infer<typeof goalSchema>;

export const nutritionPlanSchema = z.object({
  id: uuidSchema,
  effectiveFrom: isoDateSchema,
  kcal: z.number().min(800).max(6000),
  proteinG: z.number().min(0).max(400),
  fatG: z.number().min(0).max(300),
  carbG: z.number().min(0).max(1000),
  fiberG: z.number().min(0).max(120),
  steps: z.number().int().min(0).max(100000).nullable(),
  waterMl: z.number().int().min(0).max(10000).nullable(),
  sleepMinutesMin: z.number().int().min(0).max(1440).nullable(),
  sleepMinutesMax: z.number().int().min(0).max(1440).nullable(),
  strengthSessionsPerWeek: z.number().int().min(0).max(14).nullable(),
  reason: z.string().max(500).nullable(),
  policyVersion: z.string().min(1).max(50),
  createdAt: isoDateTimeSchema
});
export type NutritionPlan = z.infer<typeof nutritionPlanSchema>;

export const foodSourceSchema = z.object({
  id: uuidSchema,
  provider: z.enum(['builtin-generic', 'user-label', 'user-estimate', 'open-food-facts', 'usda-fdc', 'legacy-import']),
  license: z.string().nullable(),
  attribution: z.string().nullable(),
  externalId: z.string().nullable()
});
export type FoodSource = z.infer<typeof foodSourceSchema>;

export const foodVersionSchema = z.object({
  id: uuidSchema,
  foodId: uuidSchema,
  source: foodSourceSchema,
  name: z.string().min(1).max(160),
  brand: z.string().max(160).nullable(),
  aliases: z.array(z.string().min(1).max(160)).default([]),
  preparationState: z.enum(['raw', 'cooked', 'prepared', 'packaged', 'unknown']),
  basis: z.enum(['per-100g', 'per-serving', 'consumed-total']),
  nutrients: nutrientProfileSchema,
  servingGrams: z.number().positive().max(5000).nullable(),
  version: z.number().int().positive(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type FoodVersion = z.infer<typeof foodVersionSchema>;

export const entryBasisSchema = z.enum(['mass-grams', 'serving-count', 'consumed-total']);
export const confidenceSchema = z.enum(['verified-label', 'provider', 'generic-estimate', 'manual-estimate']);

export const foodEntrySchema = z.object({
  id: uuidSchema,
  localDate: isoDateSchema,
  mealType: mealTypeSchema,
  foodVersionId: uuidSchema.nullable(),
  labelSnapshot: z.string().min(1).max(200),
  quantity: z.number().positive().max(5000),
  unit: z.enum(['g', 'serving', 'total']),
  basis: entryBasisSchema,
  nutrientSnapshot: nutrientProfileSchema,
  confidence: confidenceSchema,
  source: z.enum(['catalog', 'custom-food', 'manual', 'recipe', 'template', 'legacy-import']),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
  version: z.number().int().positive()
});
export type FoodEntry = z.infer<typeof foodEntrySchema>;

export const diaryDaySchema = z.object({
  id: uuidSchema,
  localDate: isoDateSchema,
  completionState: z.enum(['missing', 'partial', 'complete']),
  completionRevision: z.number().int().nonnegative(),
  foodRevision: z.number().int().nonnegative(),
  completedAt: isoDateTimeSchema.nullable(),
  zone: z.string().min(1).max(100),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type DiaryDay = z.infer<typeof diaryDaySchema>;

export const measurementSchema = z.object({
  id: uuidSchema,
  type: z.enum(['weight', 'waist']),
  value: z.number().positive().max(500),
  unit: z.enum(['kg', 'cm']),
  measuredAt: isoDateTimeSchema,
  localDate: isoDateSchema,
  source: z.enum(['manual', 'apple-health', 'health-connect', 'legacy-import']),
  externalSampleId: z.string().nullable(),
  preferred: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
  version: z.number().int().positive()
});
export type Measurement = z.infer<typeof measurementSchema>;

export const dailyCheckinSchema = z.object({
  id: uuidSchema,
  localDate: isoDateSchema,
  steps: z.number().int().min(0).max(100000).nullable(),
  waterMl: z.number().int().min(0).max(10000).nullable(),
  sleepMinutes: z.number().int().min(0).max(1440).nullable(),
  trainingStatus: z.enum(['strength', 'rest', 'other', 'unknown']).nullable(),
  hunger1to5: z.number().int().min(1).max(5).nullable(),
  energy1to5: z.number().int().min(1).max(5).nullable(),
  notes: z.string().max(2000).nullable(),
  concerningSymptoms: z.boolean().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  version: z.number().int().positive()
});
export type DailyCheckin = z.infer<typeof dailyCheckinSchema>;

export const mealTemplateItemSchema = z.object({
  id: uuidSchema,
  foodVersionId: uuidSchema.nullable(),
  labelSnapshot: z.string().min(1).max(200),
  quantity: z.number().positive().max(5000),
  unit: z.enum(['g', 'serving', 'total']),
  basis: entryBasisSchema,
  nutrientSnapshot: nutrientProfileSchema,
  sortOrder: z.number().int().nonnegative()
});
export type MealTemplateItem = z.infer<typeof mealTemplateItemSchema>;

export const mealTemplateSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(160),
  items: z.array(mealTemplateItemSchema).min(1),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
  version: z.number().int().positive()
});
export type MealTemplate = z.infer<typeof mealTemplateSchema>;

export const recipeIngredientSchema = z.object({
  id: uuidSchema,
  foodVersionId: uuidSchema.nullable(),
  labelSnapshot: z.string().min(1).max(200),
  quantityG: z.number().positive().max(20000),
  nutrientSnapshotPer100g: nutrientProfileSchema,
  sortOrder: z.number().int().nonnegative()
});
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

export const recipeSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(160),
  ingredients: z.array(recipeIngredientSchema).min(1),
  yieldG: z.number().positive().max(20000).nullable(),
  servingCount: z.number().positive().max(100).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
  version: z.number().int().positive()
}).refine((recipe) => recipe.yieldG !== null || recipe.servingCount !== null, {
  message: 'recipe requires yieldG or servingCount'
});
export type Recipe = z.infer<typeof recipeSchema>;

export const coachReviewSchema = z.object({
  id: uuidSchema,
  asOfDate: isoDateSchema,
  planId: uuidSchema.nullable(),
  policyVersion: z.string().min(1).max(50),
  inputFingerprint: z.string().min(8).max(128),
  evidenceJson: z.record(z.string(), z.unknown()),
  status: z.enum([
    'collecting-data',
    'maintain',
    'monitor',
    'review-logging-and-context',
    'consider-small-adjustment',
    'monitor-fast-loss',
    'fast-loss-review',
    'recovery-review',
    'safety-review',
    'goal-review'
  ]),
  reasonCodes: z.array(z.string().min(1).max(120)),
  suggestionJson: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoDateTimeSchema
});
export type CoachReview = z.infer<typeof coachReviewSchema>;

export const exportBundleSchema = z.object({
  format: z.literal('form-export'),
  schemaVersion: z.literal(1),
  exportedAt: isoDateTimeSchema,
  profile: profileSchema.nullable(),
  goal: goalSchema.nullable(),
  nutritionPlans: z.array(nutritionPlanSchema),
  foodVersions: z.array(foodVersionSchema),
  foodEntries: z.array(foodEntrySchema),
  diaryDays: z.array(diaryDaySchema),
  measurements: z.array(measurementSchema),
  dailyCheckins: z.array(dailyCheckinSchema),
  mealTemplates: z.array(mealTemplateSchema),
  recipes: z.array(recipeSchema),
  coachReviews: z.array(coachReviewSchema)
});
export type ExportBundle = z.infer<typeof exportBundleSchema>;

export const legacyFoodSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  k: z.number().min(0).max(1000),
  p: z.number().min(0).max(100),
  c: z.number().min(0).max(100),
  f: z.number().min(0).max(100),
  fi: z.number().min(0).max(100).nullish()
});

export const legacyEntrySchema = legacyFoodSchema.extend({
  id: z.string().min(1),
  q: z.number().min(1).max(5000),
  meal: z.enum(['בוקר', 'צהריים', 'ביניים', 'ערב', 'אחר'])
});

export const legacyDaySchema = z.object({
  food: z.array(legacyEntrySchema).default([]),
  weight: z.number().positive().max(350).nullish(),
  waist: z.number().positive().max(250).nullish(),
  steps: z.number().min(0).max(100000).nullish(),
  water: z.number().min(0).max(10000).nullish(),
  sleep: z.number().min(0).max(24).nullish(),
  training: z.enum(['strength', 'rest', 'other', 'unknown']).nullish(),
  hunger: z.number().int().min(1).max(5).nullish(),
  energy: z.number().int().min(1).max(5).nullish(),
  notes: z.string().max(2000).nullish(),
  complete: z.boolean().nullish()
});

export const legacyStateSchema = z.object({
  version: z.literal(1),
  settings: z.object({
    start: z.number().min(35).max(350),
    goal: z.number().min(35).max(350),
    calories: z.number().min(1200).max(6000),
    protein: z.number().min(30).max(400),
    fat: z.number().min(25).max(250),
    fiber: z.number().min(10).max(70),
    steps: z.number().min(0).max(100000),
    water: z.number().min(0).max(10000),
    training: z.number().min(0).max(14),
    since: isoDateSchema,
    calSince: isoDateSchema
  }),
  days: z.record(isoDateSchema, legacyDaySchema),
  custom: z.array(legacyFoodSchema.extend({ id: z.string().min(1) })),
  theme: z.enum(['dark', 'light'])
});
export type LegacyState = z.infer<typeof legacyStateSchema>;

export type EntityMap = {
  profiles: Profile[];
  goals: Goal[];
  nutritionPlans: NutritionPlan[];
  foodVersions: FoodVersion[];
  foodEntries: FoodEntry[];
  diaryDays: DiaryDay[];
  measurements: Measurement[];
  dailyCheckins: DailyCheckin[];
  mealTemplates: MealTemplate[];
  recipes: Recipe[];
  coachReviews: CoachReview[];
};
