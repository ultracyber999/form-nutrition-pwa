import Dexie, { type Table } from 'dexie';
import type {
  CoachReview,
  DailyCheckin,
  DiaryDay,
  FoodEntry,
  FoodVersion,
  Goal,
  MealTemplate,
  Measurement,
  NutritionPlan,
  Profile,
  Recipe
} from '@form/contracts';

export type OutboxOperation = {
  mutationId: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  baseVersion: number;
  schemaVersion: number;
  payloadJson: string;
  createdAt: string;
  sentAt: string | null;
};

export type MetaRow = { key: string; value: unknown };

export class FormDatabase extends Dexie {
  profiles!: Table<Profile, string>;
  goals!: Table<Goal, string>;
  nutritionPlans!: Table<NutritionPlan, string>;
  foodVersions!: Table<FoodVersion, string>;
  foodEntries!: Table<FoodEntry, string>;
  diaryDays!: Table<DiaryDay, string>;
  measurements!: Table<Measurement, string>;
  dailyCheckins!: Table<DailyCheckin, string>;
  mealTemplates!: Table<MealTemplate, string>;
  recipes!: Table<Recipe, string>;
  coachReviews!: Table<CoachReview, string>;
  outbox!: Table<OutboxOperation, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'form-local') {
    super(name);
    this.version(1).stores({
      profiles: 'id, updatedAt',
      goals: 'id, status, effectiveFrom',
      nutritionPlans: 'id, effectiveFrom',
      foodVersions: 'id, foodId, name, source.provider',
      foodEntries: 'id, localDate, mealType, foodVersionId, deletedAt, updatedAt',
      diaryDays: 'id, localDate, completionState',
      measurements: 'id, localDate, type, measuredAt, preferred, deletedAt, [type+localDate]',
      dailyCheckins: 'id, localDate',
      mealTemplates: 'id, name, deletedAt',
      recipes: 'id, name, deletedAt',
      coachReviews: 'id, asOfDate, inputFingerprint',
      outbox: 'mutationId, entityType, entityId, createdAt, sentAt',
      meta: 'key'
    });
  }
}

export const allEntityTables = [
  'profiles',
  'goals',
  'nutritionPlans',
  'foodVersions',
  'foodEntries',
  'diaryDays',
  'measurements',
  'dailyCheckins',
  'mealTemplates',
  'recipes',
  'coachReviews'
] as const;
