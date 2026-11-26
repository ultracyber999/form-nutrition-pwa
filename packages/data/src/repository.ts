import type {
  CoachReview,
  DailyCheckin,
  DiaryDay,
  ExportBundle,
  FoodEntry,
  FoodVersion,
  Goal,
  MealTemplate,
  Measurement,
  NutrientProfile,
  NutritionPlan,
  Profile,
  Recipe
} from '@form/contracts';
import { exportBundleSchema, foodEntrySchema, measurementSchema, dailyCheckinSchema, nutritionPlanSchema, profileSchema, goalSchema, foodVersionSchema, mealTemplateSchema, recipeSchema, coachReviewSchema } from '@form/contracts';
import { calculateConsumed, compareDates, deriveCarbTargetG, todayInTimeZone, validatePlanTargets } from '@form/domain';
import { builtinFoods } from '@form/test-data';
import type { Table } from 'dexie';
import { FormDatabase, allEntityTables, type OutboxOperation } from './db';
import { newUuid } from './id';

export type Clock = () => Date;
const defaultClock: Clock = () => new Date();
const iso = (date: Date) => date.toISOString();

export class RepositoryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
  }
}

export type AddFoodEntryInput = {
  localDate: string;
  mealType: FoodEntry['mealType'];
  foodVersionId: string;
  quantity: number;
  unit: 'g' | 'serving';
};

export type ManualEntryInput = {
  localDate: string;
  mealType: FoodEntry['mealType'];
  label: string;
  nutrients: NutrientProfile;
};

export type OnboardingInput = {
  profile: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>;
  goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: Goal['status'] };
  plan: Omit<NutritionPlan, 'id' | 'carbG' | 'createdAt' | 'policyVersion'> & { carbG?: number; policyVersion?: string };
};

export type ImportPreview = {
  valid: boolean;
  errors: string[];
  counts: Record<string, number>;
  duplicates: Record<string, number>;
  bytes: number;
};

async function inTransaction<T>(db: FormDatabase, tables: Table[], work: () => Promise<T>): Promise<T> {
  return db.transaction('rw', tables, work);
}

function parseRow<T>(schema: { safeParse: (value: unknown) => { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> }; data?: T } }, row: T, code: string): T {
  const result = schema.safeParse(row);
  if (!result.success) {
    const details = result.error?.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') ?? 'invalid record';
    throw new RepositoryError(code, details);
  }
  return row;
}

export class FormRepository {
  private timezone = 'Asia/Jerusalem';

  constructor(
    readonly db: FormDatabase = new FormDatabase(),
    private readonly clock: Clock = defaultClock
  ) {}

  setTimeZone(timezone: string): void {
    this.timezone = timezone;
  }

  getTimeZone(): string {
    return this.timezone;
  }

  private now(): string {
    return iso(this.clock());
  }

  async initializeCatalog(): Promise<void> {
    const seeded = await this.db.meta.get('catalog-seeded-v1');
    if (seeded) return;
    await inTransaction(this.db, [this.db.foodVersions, this.db.meta], async () => {
      for (const food of builtinFoods) {
        const existing = await this.db.foodVersions.get(food.id);
        if (!existing) await this.db.foodVersions.add(food);
      }
      await this.db.meta.put({ key: 'catalog-seeded-v1', value: true });
    });
  }

  private async queueOutbox(operation: Omit<OutboxOperation, 'mutationId' | 'createdAt' | 'sentAt'>): Promise<void> {
    await this.db.outbox.add({
      mutationId: newUuid(),
      createdAt: this.now(),
      sentAt: null,
      ...operation
    });
  }

  async createOnboarding(input: OnboardingInput): Promise<{ profile: Profile; goal: Goal; plan: NutritionPlan }> {
    const now = this.now();
    const carbG = input.plan.carbG ?? deriveCarbTargetG(input.plan.kcal, input.plan.proteinG, input.plan.fatG);
    const plan: NutritionPlan = {
      ...input.plan,
      id: newUuid(),
      carbG,
      policyVersion: input.plan.policyVersion ?? 'form-plan-v1',
      createdAt: now
    };
    const validationErrors = validatePlanTargets(plan);
    if (validationErrors.length) throw new RepositoryError('invalid-plan', validationErrors.join('; '));
    const profile: Profile = { ...input.profile, id: newUuid(), createdAt: now, updatedAt: now };
    const goal: Goal = { ...input.goal, status: input.goal.status ?? 'active', id: newUuid(), createdAt: now, updatedAt: now };
    parseRow(profileSchema, profile, 'invalid-profile');
    parseRow(goalSchema, goal, 'invalid-goal');
    parseRow(nutritionPlanSchema, plan, 'invalid-plan');
    await inTransaction(this.db, [this.db.profiles, this.db.goals, this.db.nutritionPlans, this.db.outbox], async () => {
      if ((await this.db.nutritionPlans.where('effectiveFrom').equals(plan.effectiveFrom).count()) > 0) {
        throw new RepositoryError('duplicate-plan-date', 'A plan already exists for this effective date');
      }
      await this.db.profiles.put(profile);
      await this.db.goals.add(goal);
      await this.db.nutritionPlans.add(plan);
      await this.queueOutbox({ entityType: 'profile', entityId: profile.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(profile) });
      await this.queueOutbox({ entityType: 'goal', entityId: goal.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(goal) });
      await this.queueOutbox({ entityType: 'nutritionPlan', entityId: plan.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(plan) });
    });
    return { profile, goal, plan };
  }

  async getProfile(): Promise<Profile | null> {
    return (await this.db.profiles.toCollection().first()) ?? null;
  }

  async getActiveGoal(): Promise<Goal | null> {
    return (await this.db.goals.where('status').equals('active').first()) ?? null;
  }

  async getCurrentGoal(): Promise<Goal | null> {
    return (await this.db.goals.orderBy('effectiveFrom').reverse().first()) ?? null;
  }

  async listPlans(): Promise<NutritionPlan[]> {
    return this.db.nutritionPlans.orderBy('effectiveFrom').toArray();
  }

  async createPlanRevision(input: Omit<NutritionPlan, 'id' | 'createdAt' | 'carbG'> & { carbG?: number }, options: { allowHistoricalCorrection?: boolean } = {}): Promise<NutritionPlan> {
    const now = this.now();
    const plan: NutritionPlan = {
      ...input,
      id: newUuid(),
      carbG: input.carbG ?? deriveCarbTargetG(input.kcal, input.proteinG, input.fatG),
      createdAt: now
    };
    const validationErrors = validatePlanTargets(plan);
    if (validationErrors.length) throw new RepositoryError('invalid-plan', validationErrors.join('; '));
    parseRow(nutritionPlanSchema, plan, 'invalid-plan');
    const profile = await this.getProfile();
    const zone = profile?.timezone ?? this.timezone;
    const today = todayInTimeZone(zone, this.clock());
    if (compareDates(plan.effectiveFrom, today) < 0 && !options.allowHistoricalCorrection) {
      throw new RepositoryError('historical-plan-revision', 'Historical plan corrections require the explicit correction workflow');
    }
    if (options.allowHistoricalCorrection && !plan.reason?.startsWith('historical-correction:')) {
      throw new RepositoryError('historical-correction-reason-required', 'Historical corrections require a reason beginning with historical-correction:');
    }
    await inTransaction(this.db, [this.db.nutritionPlans, this.db.outbox], async () => {
      if ((await this.db.nutritionPlans.where('effectiveFrom').equals(plan.effectiveFrom).count()) > 0) {
        throw new RepositoryError('duplicate-plan-date', 'A plan already exists for this effective date');
      }
      await this.db.nutritionPlans.add(plan);
      await this.queueOutbox({ entityType: 'nutritionPlan', entityId: plan.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(plan) });
    });
    return plan;
  }

  async listFoods(): Promise<FoodVersion[]> {
    return this.db.foodVersions.orderBy('name').toArray();
  }

  async searchFoods(query: string): Promise<FoodVersion[]> {
    const normalize = (value: string) => value.toLocaleLowerCase('he-IL').replace(/[׳'"’`.,()\-\s]+/g, '');
    const needle = normalize(query.trim());
    const foods = await this.listFoods();
    if (!needle) return foods.slice(0, 30);
    return foods.filter((food) => normalize(`${food.name}${food.brand ?? ''}${food.aliases.join(' ')}`).includes(needle)).slice(0, 30);
  }

  async saveCustomFood(input: {
    name: string;
    brand?: string | null;
    aliases?: string[];
    preparationState: FoodVersion['preparationState'];
    basis: FoodVersion['basis'];
    nutrients: NutrientProfile;
    servingGrams?: number | null;
  }): Promise<FoodVersion> {
    const now = this.now();
    const food: FoodVersion = {
      id: newUuid(),
      foodId: newUuid(),
      source: { id: newUuid(), provider: 'user-label', license: null, attribution: 'User-entered label/custom food', externalId: null },
      name: input.name.trim(),
      brand: input.brand ?? null,
      aliases: input.aliases ?? [],
      preparationState: input.preparationState,
      basis: input.basis,
      nutrients: input.nutrients,
      servingGrams: input.servingGrams ?? null,
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    if (!food.name) throw new RepositoryError('invalid-food', 'Food name is required');
    parseRow(foodVersionSchema, food, 'invalid-food');
    await inTransaction(this.db, [this.db.foodVersions, this.db.outbox], async () => {
      await this.db.foodVersions.add(food);
      await this.queueOutbox({ entityType: 'foodVersion', entityId: food.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(food) });
    });
    return food;
  }

  private async diaryRow(localDate: string, zone: string): Promise<DiaryDay> {
    const existing = await this.db.diaryDays.where('localDate').equals(localDate).first();
    if (existing) return existing;
    const now = this.now();
    const row: DiaryDay = {
      id: newUuid(),
      localDate,
      completionState: 'missing',
      completionRevision: 0,
      foodRevision: 0,
      completedAt: null,
      zone,
      createdAt: now,
      updatedAt: now
    };
    await this.db.diaryDays.add(row);
    return row;
  }

  private async invalidateDayAfterFoodMutation(localDate: string, zone: string): Promise<void> {
    const row = await this.diaryRow(localDate, zone ?? this.timezone);
    const activeCount = await this.db.foodEntries.where('localDate').equals(localDate).filter((entry) => entry.deletedAt === null).count();
    const next: DiaryDay = {
      ...row,
      completionState: activeCount > 0 ? 'partial' : 'missing',
      foodRevision: row.foodRevision + 1,
      completedAt: null,
      updatedAt: this.now()
    };
    await this.db.diaryDays.put(next);
  }

  async addFoodEntry(input: AddFoodEntryInput, zone?: string): Promise<FoodEntry> {
    const food = await this.db.foodVersions.get(input.foodVersionId);
    if (!food) throw new RepositoryError('food-not-found', 'Selected food no longer exists');
    const basis = input.unit === 'g' ? 'mass-grams' : 'serving-count';
    const snapshot = calculateConsumed(food, input.quantity, basis);
    const now = this.now();
    const entry: FoodEntry = {
      id: newUuid(),
      localDate: input.localDate,
      mealType: input.mealType,
      foodVersionId: food.id,
      labelSnapshot: food.name,
      quantity: input.quantity,
      unit: input.unit,
      basis,
      nutrientSnapshot: snapshot,
      confidence: food.source.provider === 'user-label' ? 'verified-label' : food.source.provider === 'builtin-generic' ? 'generic-estimate' : 'provider',
      source: 'catalog',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1
    };
    parseRow(foodEntrySchema, entry, 'invalid-entry');
    await inTransaction(this.db, [this.db.foodEntries, this.db.diaryDays, this.db.outbox], async () => {
      await this.db.foodEntries.add(entry);
      await this.invalidateDayAfterFoodMutation(input.localDate, zone ?? this.timezone);
      await this.queueOutbox({ entityType: 'foodEntry', entityId: entry.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(entry) });
    });
    return entry;
  }

  async addManualEntry(input: ManualEntryInput, zone?: string): Promise<FoodEntry> {
    const now = this.now();
    const entry: FoodEntry = {
      id: newUuid(),
      localDate: input.localDate,
      mealType: input.mealType,
      foodVersionId: null,
      labelSnapshot: input.label.trim(),
      quantity: 1,
      unit: 'total',
      basis: 'consumed-total',
      nutrientSnapshot: input.nutrients,
      confidence: 'manual-estimate',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1
    };
    if (!entry.labelSnapshot) throw new RepositoryError('invalid-entry', 'Manual entry label is required');
    parseRow(foodEntrySchema, entry, 'invalid-entry');
    await inTransaction(this.db, [this.db.foodEntries, this.db.diaryDays, this.db.outbox], async () => {
      await this.db.foodEntries.add(entry);
      await this.invalidateDayAfterFoodMutation(input.localDate, zone ?? this.timezone);
      await this.queueOutbox({ entityType: 'foodEntry', entityId: entry.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(entry) });
    });
    return entry;
  }

  async entriesForDate(localDate: string): Promise<FoodEntry[]> {
    return this.db.foodEntries.where('localDate').equals(localDate).sortBy('createdAt');
  }

  async listFoodEntries(): Promise<FoodEntry[]> {
    return this.db.foodEntries.orderBy('localDate').toArray();
  }

  async listDiaryDays(): Promise<DiaryDay[]> {
    return this.db.diaryDays.orderBy('localDate').toArray();
  }

  async updateProfile(patch: Partial<Pick<Profile, 'locale' | 'timezone' | 'unitPreference' | 'heightCm'>>): Promise<Profile> {
    const existing = await this.getProfile();
    if (!existing) throw new RepositoryError('profile-not-found', 'Profile not found');
    const next = { ...existing, ...patch, updatedAt: this.now() };
    parseRow(profileSchema, next, 'invalid-profile');
    await this.db.profiles.put(next);
    return next;
  }

  async updateGoal(patch: Partial<Pick<Goal, 'type' | 'baselineKg' | 'targetKg' | 'status'>>): Promise<Goal> {
    const existing = await this.getCurrentGoal();
    if (!existing) throw new RepositoryError('goal-not-found', 'Goal not found');
    const next = { ...existing, ...patch, updatedAt: this.now() };
    parseRow(goalSchema, next, 'invalid-goal');
    await this.db.goals.put(next);
    return next;
  }

  async updateFoodEntry(id: string, patch: { quantity?: number; mealType?: FoodEntry['mealType']; localDate?: string }, zone?: string): Promise<FoodEntry> {
    const result = await inTransaction(this.db, [this.db.foodEntries, this.db.diaryDays, this.db.foodVersions, this.db.outbox], async () => {
      const existing = await this.db.foodEntries.get(id);
      if (!existing || existing.deletedAt !== null) throw new RepositoryError('entry-not-found', 'Food entry not found');
      const next: FoodEntry = {
        ...existing,
        quantity: patch.quantity ?? existing.quantity,
        mealType: patch.mealType ?? existing.mealType,
        localDate: patch.localDate ?? existing.localDate,
        updatedAt: this.now(),
        version: existing.version + 1
      };
      if (patch.quantity !== undefined && existing.foodVersionId && existing.basis !== 'consumed-total') {
        const food = await this.db.foodVersions.get(existing.foodVersionId);
        if (!food) throw new RepositoryError('food-not-found', 'Food version missing');
        next.nutrientSnapshot = calculateConsumed(food, next.quantity, next.basis);
      } else if (patch.quantity !== undefined && existing.basis === 'consumed-total') {
        next.quantity = 1;
      }
      parseRow(foodEntrySchema, next, 'invalid-entry');
      await this.db.foodEntries.put(next);
      await this.invalidateDayAfterFoodMutation(existing.localDate, zone ?? this.timezone);
      if (next.localDate !== existing.localDate) await this.invalidateDayAfterFoodMutation(next.localDate, zone ?? this.timezone);
      await this.queueOutbox({ entityType: 'foodEntry', entityId: id, operation: 'update', baseVersion: existing.version, schemaVersion: 1, payloadJson: JSON.stringify(next) });
      return next;
    });
    return result;
  }

  async deleteFoodEntry(id: string, zone?: string): Promise<void> {
    await inTransaction(this.db, [this.db.foodEntries, this.db.diaryDays, this.db.outbox], async () => {
      const existing = await this.db.foodEntries.get(id);
      if (!existing || existing.deletedAt !== null) throw new RepositoryError('entry-not-found', 'Food entry not found');
      const next = { ...existing, deletedAt: this.now(), updatedAt: this.now(), version: existing.version + 1 };
      await this.db.foodEntries.put(next);
      await this.invalidateDayAfterFoodMutation(existing.localDate, zone ?? this.timezone);
      await this.queueOutbox({ entityType: 'foodEntry', entityId: id, operation: 'delete', baseVersion: existing.version, schemaVersion: 1, payloadJson: JSON.stringify(next) });
    });
  }

  async undoDeleteFoodEntry(id: string, zone?: string): Promise<void> {
    await inTransaction(this.db, [this.db.foodEntries, this.db.diaryDays, this.db.outbox], async () => {
      const existing = await this.db.foodEntries.get(id);
      if (!existing || existing.deletedAt === null) throw new RepositoryError('entry-not-deleted', 'Food entry is not deleted');
      const next = { ...existing, deletedAt: null, updatedAt: this.now(), version: existing.version + 1 };
      await this.db.foodEntries.put(next);
      await this.invalidateDayAfterFoodMutation(existing.localDate, zone ?? this.timezone);
      await this.queueOutbox({ entityType: 'foodEntry', entityId: id, operation: 'update', baseVersion: existing.version, schemaVersion: 1, payloadJson: JSON.stringify(next) });
    });
  }

  async markDayComplete(localDate: string, zone?: string): Promise<DiaryDay> {
    const result = await inTransaction(this.db, [this.db.diaryDays, this.db.foodEntries, this.db.outbox], async () => {
      const row = await this.diaryRow(localDate, zone ?? this.timezone);
      const count = await this.db.foodEntries.where('localDate').equals(localDate).filter((entry) => entry.deletedAt === null).count();
      if (count === 0) throw new RepositoryError('empty-day', 'An empty day cannot be marked complete');
      const next: DiaryDay = {
        ...row,
        completionState: 'complete',
        completionRevision: row.foodRevision,
        completedAt: this.now(),
        updatedAt: this.now()
      };
      await this.db.diaryDays.put(next);
      await this.queueOutbox({ entityType: 'diaryDay', entityId: row.id, operation: 'update', baseVersion: row.completionRevision, schemaVersion: 1, payloadJson: JSON.stringify(next) });
      return next;
    });
    return result;
  }

  async diaryDay(localDate: string): Promise<DiaryDay | null> {
    return (await this.db.diaryDays.where('localDate').equals(localDate).first()) ?? null;
  }

  async saveMeasurement(input: Omit<Measurement, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version' | 'preferred'> & { preferred?: boolean }): Promise<Measurement> {
    const now = this.now();
    const row: Measurement = {
      ...input,
      id: newUuid(),
      preferred: input.preferred ?? true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1
    };
    parseRow(measurementSchema, row, 'invalid-measurement');
    await inTransaction(this.db, [this.db.measurements, this.db.outbox], async () => {
      if (row.preferred) {
        const sameDay = await this.db.measurements.where('[type+localDate]').equals([row.type, row.localDate]).toArray();
        for (const existing of sameDay) {
          if (existing.preferred) {
            const demoted = { ...existing, preferred: false, updatedAt: now, version: existing.version + 1 };
            await this.db.measurements.put(demoted);
            await this.queueOutbox({ entityType: 'measurement', entityId: existing.id, operation: 'update', baseVersion: existing.version, schemaVersion: 1, payloadJson: JSON.stringify(demoted) });
          }
        }
      }
      await this.db.measurements.add(row);
      await this.queueOutbox({ entityType: 'measurement', entityId: row.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(row) });
    });
    return row;
  }

  async listMeasurements(): Promise<Measurement[]> {
    return this.db.measurements.orderBy('localDate').toArray();
  }

  async saveCheckin(input: Omit<DailyCheckin, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<DailyCheckin> {
    const now = this.now();
    const existing = await this.db.dailyCheckins.where('localDate').equals(input.localDate).first();
    const row: DailyCheckin = existing
      ? { ...existing, ...input, updatedAt: now, version: existing.version + 1 }
      : { ...input, id: newUuid(), createdAt: now, updatedAt: now, version: 1 };
    parseRow(dailyCheckinSchema, row, 'invalid-checkin');
    await inTransaction(this.db, [this.db.dailyCheckins, this.db.outbox], async () => {
      await this.db.dailyCheckins.put(row);
      await this.queueOutbox({ entityType: 'dailyCheckin', entityId: row.id, operation: existing ? 'update' : 'create', baseVersion: existing?.version ?? 0, schemaVersion: 1, payloadJson: JSON.stringify(row) });
    });
    return row;
  }

  async saveDailyCheckinBundle(input: Omit<DailyCheckin, 'id' | 'createdAt' | 'updatedAt' | 'version'>, measurements: Array<Omit<Measurement, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version' | 'preferred'> & { preferred?: boolean }> = []): Promise<{ checkin: DailyCheckin; measurements: Measurement[] }> {
    const now = this.now();
    const existing = await this.db.dailyCheckins.where('localDate').equals(input.localDate).first();
    const checkin: DailyCheckin = existing
      ? { ...existing, ...input, updatedAt: now, version: existing.version + 1 }
      : { ...input, id: newUuid(), createdAt: now, updatedAt: now, version: 1 };
    parseRow(dailyCheckinSchema, checkin, 'invalid-checkin');
    const rows: Measurement[] = measurements.map((measurement) => parseRow(measurementSchema, {
      ...measurement,
      id: newUuid(),
      preferred: measurement.preferred ?? true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1
    }, 'invalid-measurement'));
    await inTransaction(this.db, [this.db.dailyCheckins, this.db.measurements, this.db.outbox], async () => {
      for (const row of rows) {
        if (row.preferred) {
          const sameDay = await this.db.measurements.where('[type+localDate]').equals([row.type, row.localDate]).toArray();
          for (const prior of sameDay) {
            if (prior.preferred) {
              const demoted = { ...prior, preferred: false, updatedAt: now, version: prior.version + 1 };
              await this.db.measurements.put(demoted);
              await this.queueOutbox({ entityType: 'measurement', entityId: prior.id, operation: 'update', baseVersion: prior.version, schemaVersion: 1, payloadJson: JSON.stringify(demoted) });
            }
          }
        }
        await this.db.measurements.add(row);
        await this.queueOutbox({ entityType: 'measurement', entityId: row.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(row) });
      }
      await this.db.dailyCheckins.put(checkin);
      await this.queueOutbox({ entityType: 'dailyCheckin', entityId: checkin.id, operation: existing ? 'update' : 'create', baseVersion: existing?.version ?? 0, schemaVersion: 1, payloadJson: JSON.stringify(checkin) });
    });
    return { checkin, measurements: rows };
  }

  async checkinForDate(localDate: string): Promise<DailyCheckin | null> {
    return (await this.db.dailyCheckins.where('localDate').equals(localDate).first()) ?? null;
  }

  async listCheckins(): Promise<DailyCheckin[]> {
    return this.db.dailyCheckins.orderBy('localDate').toArray();
  }

  async saveTemplateFromEntries(name: string, entryIds: string[]): Promise<MealTemplate> {
    const entries = (await this.db.foodEntries.bulkGet(entryIds)).filter((entry): entry is FoodEntry => entry !== undefined && entry.deletedAt === null);
    if (!entries.length) throw new RepositoryError('empty-template', 'Template requires at least one active entry');
    const now = this.now();
    const template: MealTemplate = {
      id: newUuid(),
      name: name.trim(),
      items: entries.map((entry, sortOrder) => ({
        id: newUuid(),
        foodVersionId: entry.foodVersionId,
        labelSnapshot: entry.labelSnapshot,
        quantity: entry.quantity,
        unit: entry.unit,
        basis: entry.basis,
        nutrientSnapshot: entry.nutrientSnapshot,
        sortOrder
      })),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1
    };
    if (!template.name) throw new RepositoryError('invalid-template', 'Template name is required');
    parseRow(mealTemplateSchema, template, 'invalid-template');
    await inTransaction(this.db, [this.db.mealTemplates, this.db.outbox], async () => {
      await this.db.mealTemplates.add(template);
      await this.queueOutbox({ entityType: 'mealTemplate', entityId: template.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(template) });
    });
    return template;
  }

  async listTemplates(): Promise<MealTemplate[]> {
    return (await this.db.mealTemplates.orderBy('name').toArray()).filter((template) => template.deletedAt === null);
  }

  async addTemplateToDiary(templateId: string, localDate: string, mealType: FoodEntry['mealType'], zone?: string): Promise<FoodEntry[]> {
    const template = await this.db.mealTemplates.get(templateId);
    if (!template || template.deletedAt !== null) throw new RepositoryError('template-not-found', 'Template not found');
    const now = this.now();
    const entries: FoodEntry[] = template.items.map((item) => ({
      id: newUuid(),
      localDate,
      mealType,
      foodVersionId: item.foodVersionId,
      labelSnapshot: item.labelSnapshot,
      quantity: item.quantity,
      unit: item.unit,
      basis: item.basis,
      nutrientSnapshot: item.nutrientSnapshot,
      confidence: 'generic-estimate',
      source: 'template',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1
    }));
    await inTransaction(this.db, [this.db.foodEntries, this.db.diaryDays, this.db.outbox], async () => {
      for (const entry of entries) {
        await this.db.foodEntries.add(entry);
        await this.queueOutbox({ entityType: 'foodEntry', entityId: entry.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(entry) });
      }
      await this.invalidateDayAfterFoodMutation(localDate, zone ?? this.timezone);
    });
    return entries;
  }

  async saveRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'>): Promise<Recipe> {
    const now = this.now();
    const row: Recipe = { ...recipe, id: newUuid(), createdAt: now, updatedAt: now, deletedAt: null, version: 1 };
    parseRow(recipeSchema, row, 'invalid-recipe');
    await inTransaction(this.db, [this.db.recipes, this.db.outbox], async () => {
      await this.db.recipes.add(row);
      await this.queueOutbox({ entityType: 'recipe', entityId: row.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(row) });
    });
    return row;
  }

  async listRecipes(): Promise<Recipe[]> {
    return (await this.db.recipes.orderBy('name').toArray()).filter((recipe) => recipe.deletedAt === null);
  }

  async addRecipePortionToDiary(recipeId: string, localDate: string, mealType: FoodEntry['mealType'], portion: { grams?: number; servings?: number }, zone?: string): Promise<FoodEntry> {
    const { recipePortionNutrients } = await import('@form/domain');
    const recipe = await this.db.recipes.get(recipeId);
    if (!recipe || recipe.deletedAt !== null) throw new RepositoryError('recipe-not-found', 'Recipe not found');
    const snapshot = recipePortionNutrients(recipe, portion);
    const quantity = portion.grams ?? portion.servings;
    if (quantity === undefined) throw new RepositoryError('invalid-portion', 'Portion requires grams or servings');
    const now = this.now();
    const entry: FoodEntry = {
      id: newUuid(),
      localDate,
      mealType,
      foodVersionId: null,
      labelSnapshot: recipe.name,
      quantity,
      unit: portion.grams !== undefined ? 'g' : 'serving',
      basis: 'consumed-total',
      nutrientSnapshot: snapshot,
      confidence: 'manual-estimate',
      source: 'recipe',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1
    };
    await inTransaction(this.db, [this.db.foodEntries, this.db.diaryDays, this.db.outbox], async () => {
      await this.db.foodEntries.add(entry);
      await this.invalidateDayAfterFoodMutation(localDate, zone ?? this.timezone);
      await this.queueOutbox({ entityType: 'foodEntry', entityId: entry.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(entry) });
    });
    return entry;
  }

  async saveCoachReview(review: CoachReview): Promise<void> {
    parseRow(coachReviewSchema, review, 'invalid-coach-review');
    await inTransaction(this.db, [this.db.coachReviews, this.db.outbox], async () => {
      await this.db.coachReviews.add(review);
      await this.queueOutbox({ entityType: 'coachReview', entityId: review.id, operation: 'create', baseVersion: 0, schemaVersion: 1, payloadJson: JSON.stringify(review) });
    });
  }

  async listCoachReviews(): Promise<CoachReview[]> {
    return this.db.coachReviews.orderBy('asOfDate').reverse().toArray();
  }

  async exportBundle(): Promise<ExportBundle> {
    const [profile, goal, nutritionPlans, foodVersions, foodEntries, diaryDays, measurements, dailyCheckins, mealTemplates, recipes, coachReviews] = await Promise.all([
      this.getProfile(),
      this.getCurrentGoal(),
      this.db.nutritionPlans.toArray(),
      this.db.foodVersions.toArray(),
      this.db.foodEntries.toArray(),
      this.db.diaryDays.toArray(),
      this.db.measurements.toArray(),
      this.db.dailyCheckins.toArray(),
      this.db.mealTemplates.toArray(),
      this.db.recipes.toArray(),
      this.db.coachReviews.toArray()
    ]);
    const bundle: ExportBundle = {
      format: 'form-export',
      schemaVersion: 1,
      exportedAt: this.now(),
      profile,
      goal,
      nutritionPlans,
      foodVersions,
      foodEntries,
      diaryDays,
      measurements,
      dailyCheckins,
      mealTemplates,
      recipes,
      coachReviews
    };
    return exportBundleSchema.parse(bundle);
  }

  async previewImport(text: string): Promise<ImportPreview> {
    const bytes = new TextEncoder().encode(text).byteLength;
    if (bytes > 20 * 1024 * 1024) return { valid: false, errors: ['file exceeds 20MB limit'], counts: {}, duplicates: {}, bytes };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { valid: false, errors: ['invalid JSON'], counts: {}, duplicates: {}, bytes };
    }
    const result = exportBundleSchema.safeParse(parsed);
    if (!result.success) return { valid: false, errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`), counts: {}, duplicates: {}, bytes };
    const bundle = result.data;
    const counts: Record<string, number> = {
      nutritionPlans: bundle.nutritionPlans.length,
      foodVersions: bundle.foodVersions.length,
      foodEntries: bundle.foodEntries.length,
      diaryDays: bundle.diaryDays.length,
      measurements: bundle.measurements.length,
      dailyCheckins: bundle.dailyCheckins.length,
      mealTemplates: bundle.mealTemplates.length,
      recipes: bundle.recipes.length,
      coachReviews: bundle.coachReviews.length
    };
    const duplicates: Record<string, number> = {};
    const checks: Array<[string, string[]]> = [
      ['nutritionPlans', bundle.nutritionPlans.map((row) => row.id)],
      ['foodVersions', bundle.foodVersions.map((row) => row.id)],
      ['foodEntries', bundle.foodEntries.map((row) => row.id)],
      ['diaryDays', bundle.diaryDays.map((row) => row.id)],
      ['measurements', bundle.measurements.map((row) => row.id)],
      ['dailyCheckins', bundle.dailyCheckins.map((row) => row.id)],
      ['mealTemplates', bundle.mealTemplates.map((row) => row.id)],
      ['recipes', bundle.recipes.map((row) => row.id)],
      ['coachReviews', bundle.coachReviews.map((row) => row.id)]
    ];
    for (const [tableName, ids] of checks) {
      const table = this.db.table(tableName);
      const existing = await table.bulkGet(ids);
      duplicates[tableName] = existing.filter(Boolean).length;
    }
    return { valid: true, errors: [], counts, duplicates, bytes };
  }

  async importBundle(text: string, mode: 'merge-skip-duplicates' | 'replace-all'): Promise<{ backup: ExportBundle; counts: Record<string, number> }> {
    const preview = await this.previewImport(text);
    if (!preview.valid) throw new RepositoryError('invalid-import', preview.errors.join('; '));
    const bundle = exportBundleSchema.parse(JSON.parse(text));
    const backup = await this.exportBundle();
    const tables = allEntityTables.map((name) => this.db.table(name));
    await inTransaction(this.db, [...tables, this.db.meta], async () => {
      await this.db.meta.put({ key: 'last-pre-import-backup', value: backup });
      if (mode === 'replace-all') {
        for (const table of tables) await table.clear();
      }
      const putRows = async (tableName: string, rows: Array<{ id: string }>) => {
        const table = this.db.table(tableName);
        if (mode === 'replace-all') {
          await table.bulkPut(rows);
        } else {
          const existing = await table.bulkGet(rows.map((row) => row.id));
          const missing = rows.filter((_, index) => existing[index] === undefined);
          await table.bulkPut(missing);
        }
      };
      if (bundle.profile) await putRows('profiles', [bundle.profile]);
      if (bundle.goal) await putRows('goals', [bundle.goal]);
      await putRows('nutritionPlans', bundle.nutritionPlans);
      await putRows('foodVersions', bundle.foodVersions);
      await putRows('foodEntries', bundle.foodEntries);
      await putRows('diaryDays', bundle.diaryDays);
      await putRows('measurements', bundle.measurements);
      await putRows('dailyCheckins', bundle.dailyCheckins);
      await putRows('mealTemplates', bundle.mealTemplates);
      await putRows('recipes', bundle.recipes);
      await putRows('coachReviews', bundle.coachReviews);
    });
    return { backup, counts: preview.counts };
  }

  async previewLegacyImport(text: string): Promise<{ report: import('./legacyMigration').LegacyMigrationResult['report']; valid: boolean; errors: string[] }> {
    try {
      const { buildLegacyMigration, parseLegacyJson } = await import('./legacyMigration');
      const migration = buildLegacyMigration(parseLegacyJson(text));
      return { report: migration.report, valid: true, errors: [] };
    } catch (error) {
      return {
        report: { days: 0, entries: 0, customFoods: 0, measurements: 0, checkins: 0, skippedEmptyCompletionMarkers: 0, warnings: [], dateRange: null },
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown legacy import error']
      };
    }
  }

  async importLegacy(text: string, mode: 'merge-skip-duplicates' | 'replace-all'): Promise<{ report: import('./legacyMigration').LegacyMigrationResult['report']; backup: ExportBundle }> {
    const { buildLegacyMigration, parseLegacyJson } = await import('./legacyMigration');
    const migration = buildLegacyMigration(parseLegacyJson(text));
    const result = await this.importBundle(JSON.stringify(migration.bundle), mode);
    return { report: migration.report, backup: result.backup };
  }

  async getLastPreImportBackup(): Promise<ExportBundle | null> {
    const row = await this.db.meta.get('last-pre-import-backup');
    const result = exportBundleSchema.safeParse(row?.value);
    return result.success ? result.data : null;
  }

  async clearLocalData(): Promise<void> {
    const tables = [...allEntityTables.map((name) => this.db.table(name)), this.db.outbox, this.db.meta];
    await inTransaction(this.db, tables, async () => {
      for (const table of tables) await table.clear();
    });
  }

  async tableCounts(): Promise<Record<string, number>> {
    const entries = await Promise.all(allEntityTables.map(async (name) => [name, await this.db.table(name).count()] as const));
    return Object.fromEntries(entries);
  }
}
