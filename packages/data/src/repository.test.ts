import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { sumEntryNutrients } from '@form/domain';
import { cookedChicken100g, syntheticProfile, syntheticPlan } from '@form/test-data';
import { FormDatabase } from './db';
import { FormRepository } from './repository';
import { buildLegacyMigration } from './legacyMigration';

let sequence = 0;
function repository(name = `form-test-${++sequence}`): FormRepository {
  return new FormRepository(new FormDatabase(name), () => new Date('2026-11-25T08:00:00.000Z'));
}

async function onboarded(repo: FormRepository): Promise<void> {
  await repo.initializeCatalog();
  await repo.createOnboarding({
    profile: {
      locale: syntheticProfile.locale,
      timezone: syntheticProfile.timezone,
      unitPreference: syntheticProfile.unitPreference,
      heightCm: null
    },
    goal: {
      type: 'weight-loss',
      baselineKg: 96,
      targetKg: 80,
      effectiveFrom: '2026-11-01'
    },
    plan: {
      effectiveFrom: syntheticPlan.effectiveFrom,
      kcal: syntheticPlan.kcal,
      proteinG: syntheticPlan.proteinG,
      fatG: syntheticPlan.fatG,
      fiberG: syntheticPlan.fiberG,
      steps: syntheticPlan.steps,
      waterMl: syntheticPlan.waterMl,
      sleepMinutesMin: syntheticPlan.sleepMinutesMin,
      sleepMinutesMax: syntheticPlan.sleepMinutesMax,
      strengthSessionsPerWeek: syntheticPlan.strengthSessionsPerWeek,
      reason: 'test'
    }
  });
}

describe('IndexedDB repository vertical slice', () => {
  beforeEach(() => {
    sequence += 1;
  });

  it('QA-01/M1: create plan → add 180g chicken → persist/reopen → export/restore identical totals', async () => {
    const name = `form-vertical-${Date.now()}-${Math.random()}`;
    const db = new FormDatabase(name);
    const repo = new FormRepository(db, () => new Date('2026-11-25T08:00:00.000Z'));
    await onboarded(repo);
    const entry = await repo.addFoodEntry({ localDate: '2026-11-25', mealType: 'lunch', foodVersionId: cookedChicken100g.id, quantity: 180, unit: 'g' });
    expect(entry.nutrientSnapshot.kcal).toBeCloseTo(297, 8);
    expect(entry.nutrientSnapshot.proteinG).toBeCloseTo(55.8, 8);

    db.close();
    const reopened = new FormRepository(new FormDatabase(name), () => new Date('2026-11-25T09:00:00.000Z'));
    const reloadedEntries = await reopened.entriesForDate('2026-11-25');
    const reloadedTotals = sumEntryNutrients(reloadedEntries);
    expect(reloadedTotals.totals.kcal).toBeCloseTo(297, 8);
    expect(reloadedTotals.totals.proteinG).toBeCloseTo(55.8, 8);

    const exported = await reopened.exportBundle();
    const restoreRepo = repository();
    await restoreRepo.importBundle(JSON.stringify(exported), 'replace-all');
    const restoredEntries = await restoreRepo.entriesForDate('2026-11-25');
    const restoredTotals = sumEntryNutrients(restoredEntries);
    expect(restoredTotals.totals.kcal).toBeCloseTo(reloadedTotals.totals.kcal, 8);
    expect(restoredTotals.totals.proteinG).toBeCloseTo(reloadedTotals.totals.proteinG, 8);
    reopened.db.close();
  });

  it('QA-05: completion is invalidated immediately by add/edit/delete and delete can be undone', async () => {
    const repo = repository();
    await onboarded(repo);
    const entry = await repo.addFoodEntry({ localDate: '2026-11-25', mealType: 'lunch', foodVersionId: cookedChicken100g.id, quantity: 180, unit: 'g' });
    const completed = await repo.markDayComplete('2026-11-25');
    expect(completed.completionState).toBe('complete');
    expect(completed.completionRevision).toBe(completed.foodRevision);

    await repo.updateFoodEntry(entry.id, { quantity: 200 });
    let day = await repo.diaryDay('2026-11-25');
    expect(day?.completionState).toBe('partial');
    expect(day?.completedAt).toBeNull();

    await repo.markDayComplete('2026-11-25');
    await repo.deleteFoodEntry(entry.id);
    day = await repo.diaryDay('2026-11-25');
    expect(day?.completionState).toBe('missing');
    await repo.undoDeleteFoodEntry(entry.id);
    const entries = await repo.entriesForDate('2026-11-25');
    expect(entries.filter((row) => row.deletedAt === null)).toHaveLength(1);
    day = await repo.diaryDay('2026-11-25');
    expect(day?.completionState).toBe('partial');
  });

  it('QA-03: manual unknown macros remain null and are not exported as fake zeroes', async () => {
    const repo = repository();
    await onboarded(repo);
    await repo.addManualEntry({
      localDate: '2026-11-25',
      mealType: 'dinner',
      label: 'ארוחה מוערכת',
      nutrients: { kcal: 500, proteinG: null, carbG: 40, fatG: 20, fiberG: null }
    });
    const entries = await repo.entriesForDate('2026-11-25');
    const totals = sumEntryNutrients(entries);
    expect(totals.totals.proteinG).toBe(0);
    expect(totals.unknownCounts.proteinG).toBe(1);
    const exported = await repo.exportBundle();
    expect(exported.foodEntries[0]?.nutrientSnapshot.proteinG).toBeNull();
  });

  it('QA-13: corrupt import fails before mutation and preserves existing data', async () => {
    const repo = repository();
    await onboarded(repo);
    await repo.addManualEntry({ localDate: '2026-11-25', mealType: 'other', label: 'existing', nutrients: { kcal: 100, proteinG: null, carbG: null, fatG: null, fiberG: null } });
    await expect(repo.importBundle('{bad json', 'replace-all')).rejects.toThrow('invalid JSON');
    expect((await repo.entriesForDate('2026-11-25')).length).toBe(1);
  });

  it('QA-14: repeated legacy import is idempotent by stable IDs', async () => {
    const legacy = {
      version: 1,
      settings: { start: 96, goal: 80, calories: 2300, protein: 170, fat: 75, fiber: 35, steps: 8000, water: 2500, training: 4, since: '2026-11-01', calSince: '2026-11-01' },
      days: {
        '2026-11-20': {
          food: [{ id: 'chicken', name: 'חזה עוף מבושל', k: 165, p: 31, c: 0, f: 3.6, fi: 0, q: 180, meal: 'צהריים' }],
          weight: 92,
          water: 1800,
          sleep: 7.5,
          complete: true
        }
      },
      custom: [],
      theme: 'dark'
    };
    const migration = buildLegacyMigration(legacy);
    expect(migration.report.entries).toBe(1);
    const repo = repository();
    const text = JSON.stringify(legacy);
    await repo.importLegacy(text, 'merge-skip-duplicates');
    const firstCounts = await repo.tableCounts();
    await repo.importLegacy(text, 'merge-skip-duplicates');
    const secondCounts = await repo.tableCounts();
    expect(secondCounts).toEqual(firstCounts);
    const entries = await repo.entriesForDate('2026-11-20');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.nutrientSnapshot.kcal).toBeCloseTo(297, 8);
  });

  it('empty day cannot be marked complete', async () => {
    const repo = repository();
    await onboarded(repo);
    await expect(repo.markDayComplete('2026-11-25')).rejects.toMatchObject({ code: 'empty-day' });
  });
});

describe('RC4 corrective integrity regressions', () => {
  it('F02: ordinary historical plan revisions are rejected; explicit correction workflow is audited', async () => {
    const repo = repository();
    await onboarded(repo);
    const base = { effectiveFrom: '2026-11-20', kcal: 2200, proteinG: 150, fatG: 70, fiberG: 30, steps: 8000, waterMl: 2500, sleepMinutesMin: 420, sleepMinutesMax: 540, strengthSessionsPerWeek: 4, reason: 'ordinary edit', policyVersion: 'form-plan-v1' };
    await expect(repo.createPlanRevision(base)).rejects.toMatchObject({ code: 'historical-plan-revision' });
    await expect(repo.createPlanRevision(base, { allowHistoricalCorrection: true })).rejects.toMatchObject({ code: 'historical-correction-reason-required' });
    const corrected = await repo.createPlanRevision({ ...base, reason: 'historical-correction: documented test correction' }, { allowHistoricalCorrection: true });
    expect(corrected.effectiveFrom).toBe('2026-11-20');
    await expect(repo.createPlanRevision({ ...base, effectiveFrom: corrected.effectiveFrom, reason: 'historical-correction: duplicate check' }, { allowHistoricalCorrection: true })).rejects.toMatchObject({ code: 'duplicate-plan-date' });
  });

  it('F03: invalid negative, fractional, out-of-range and malformed writes are rejected before persistence', async () => {
    const repo = repository();
    await onboarded(repo);
    const measurement = { type: 'weight' as const, value: -1, unit: 'kg' as const, measuredAt: '2026-11-25T08:00:00.000Z', localDate: '2026-11-25', source: 'manual' as const, externalSampleId: null };
    await expect(repo.saveMeasurement(measurement)).rejects.toMatchObject({ code: 'invalid-measurement' });
    await expect(repo.saveCheckin({ localDate: '2026-11-25', steps: 100.5, waterMl: null, sleepMinutes: null, trainingStatus: null, hunger1to5: null, energy1to5: null, notes: null })).rejects.toMatchObject({ code: 'invalid-checkin' });
    await expect(repo.addManualEntry({ localDate: '2026-11-25', mealType: 'other', label: 'bad', nutrients: { kcal: -1, proteinG: null, carbG: null, fatG: null, fiberG: null } })).rejects.toMatchObject({ code: 'invalid-entry' });
    expect((await repo.listMeasurements()).length).toBe(0);
    expect((await repo.listCheckins()).length).toBe(0);
    expect((await repo.listFoodEntries()).length).toBe(0);
  });

  it('F04: check-in, measurements and outbox commit atomically under failure injection', async () => {
    const repo = repository();
    await onboarded(repo);
    const originalAdd = repo.db.outbox.add.bind(repo.db.outbox);
    repo.db.outbox.add = (async () => Promise.reject(new Error('injected interruption'))) as unknown as typeof repo.db.outbox.add;
    await expect(repo.saveDailyCheckinBundle(
      { localDate: '2026-11-25', steps: 8000, waterMl: 2000, sleepMinutes: 420, trainingStatus: null, hunger1to5: 2, energy1to5: 4, notes: null },
      [{ type: 'weight', value: 90, unit: 'kg', measuredAt: '2026-11-25T08:00:00.000Z', localDate: '2026-11-25', source: 'manual', externalSampleId: null }]
    )).rejects.toThrow('injected interruption');
    repo.db.outbox.add = originalAdd;
    expect((await repo.listMeasurements()).length).toBe(0);
    expect((await repo.listCheckins()).length).toBe(0);
    expect(await repo.db.outbox.count()).toBe(3); // onboarding operations only
  });

  it('F07/F08: configured timezone reaches diary rows and replace-import retains recoverable backup metadata', async () => {
    const repo = repository();
    await onboarded(repo);
    repo.setTimeZone('America/New_York');
    await repo.addManualEntry({ localDate: '2026-11-25', mealType: 'other', label: 'zone test', nutrients: { kcal: 100, proteinG: null, carbG: null, fatG: null, fiberG: null } });
    expect((await repo.diaryDay('2026-11-25'))?.zone).toBe('America/New_York');
    const exported = await repo.exportBundle();
    const changed = { ...exported, foodEntries: [], exportedAt: '2026-11-25T09:00:00.000Z' };
    await repo.importBundle(JSON.stringify(changed), 'replace-all');
    const backup = await repo.getLastPreImportBackup();
    expect(backup?.foodEntries.length).toBe(1);
    expect((await repo.listFoodEntries()).length).toBe(0);
  });
});
