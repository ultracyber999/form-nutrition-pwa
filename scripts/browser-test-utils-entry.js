/* eslint-disable no-undef */
import { FormRepository } from '@form/data';
import { cookedChicken100g } from '@form/test-data';
import { calculateConsumed } from '@form/domain';

const repo = new FormRepository();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = () => new Date().toISOString();
const dateUtc = (day) => new Date(Date.UTC(2025, 10, 27) + day * 86400000).toISOString().slice(0, 10);

async function ensureBase() {
  await repo.initializeCatalog();
  if (!(await repo.getProfile())) {
    await repo.createOnboarding({
      profile: { locale: 'he-IL', timezone: 'Asia/Jerusalem', unitPreference: 'metric', heightCm: 178 },
      goal: { type: 'weight-loss', baselineKg: 90, targetKg: 80, effectiveFrom: '2025-11-27' },
      plan: { effectiveFrom: '2025-11-27', kcal: 2000, proteinG: 150, fatG: 65, fiberG: 30, steps: 8000, waterMl: 2000, sleepMinutesMin: 420, sleepMinutesMax: 510, strengthSessionsPerWeek: 3, reason: 'synthetic validation baseline' }
    });
  }
}

async function seedScale() {
  await ensureBase();
  if ((await repo.db.foodEntries.count()) >= 9000) return { entries: await repo.db.foodEntries.count(), reused: true };
  const stamp = now();
  const entries = [];
  const diary = [];
  const measurements = [];
  const checkins = [];
  let n = 1;
  for (let day = 0; day < 365; day += 1) {
    const date = dateUtc(day);
    for (let meal = 0; meal < 27; meal += 1) {
      const quantity = 80 + ((day + meal) % 140);
      entries.push({ id: id(n++), localDate: date, mealType: ['breakfast', 'lunch', 'snack', 'dinner'][meal % 4], foodVersionId: cookedChicken100g.id, labelSnapshot: `${cookedChicken100g.name} — סינתטי`, quantity, unit: 'g', basis: 'mass-grams', nutrientSnapshot: calculateConsumed(cookedChicken100g, quantity, 'mass-grams'), confidence: 'generic-estimate', source: 'catalog', createdAt: stamp, updatedAt: stamp, deletedAt: null, version: 1 });
    }
    diary.push({ id: id(20000 + day), localDate: date, completionState: 'complete', completionRevision: 1, foodRevision: 1, completedAt: stamp, zone: 'Asia/Jerusalem', createdAt: stamp, updatedAt: stamp });
    measurements.push({ id: id(30000 + day), type: 'weight', value: 90 - day * 0.025, unit: 'kg', measuredAt: `${date}T06:30:00+02:00`, localDate: date, source: 'manual', externalSampleId: null, preferred: true, createdAt: stamp, updatedAt: stamp, deletedAt: null, version: 1 });
    checkins.push({ id: id(40000 + day), localDate: date, steps: 7000 + (day % 8) * 350, waterMl: 1600 + (day % 5) * 150, sleepMinutes: 390 + (day % 5) * 20, trainingStatus: day % 3 === 0 ? 'strength' : 'rest', hunger1to5: 2 + (day % 3), energy1to5: 3 + (day % 2), notes: null, createdAt: stamp, updatedAt: stamp, version: 1 });
  }
  await repo.db.foodEntries.bulkAdd(entries);
  await repo.db.diaryDays.bulkAdd(diary);
  await repo.db.measurements.bulkAdd(measurements);
  await repo.db.dailyCheckins.bulkAdd(checkins);
  return { entries: entries.length, days: diary.length, measurements: measurements.length, checkins: checkins.length, reused: false };
}

async function logicalSnapshot() {
  const [counts, entries, plans, diary, profile, goal] = await Promise.all([repo.tableCounts(), repo.listFoodEntries(), repo.listPlans(), repo.listDiaryDays(), repo.getProfile(), repo.getActiveGoal()]);
  const totals = entries.reduce((sum, entry) => ({ kcal: sum.kcal + (entry.nutrientSnapshot.kcal ?? 0), proteinG: sum.proteinG + (entry.nutrientSnapshot.proteinG ?? 0) }), { kcal: 0, proteinG: 0 });
  return { counts, totals, plans: plans.map((plan) => [plan.effectiveFrom, plan.kcal, plan.proteinG, plan.carbG]), completeDays: diary.filter((day) => day.completionState === 'complete').length, profile: profile && [profile.locale, profile.timezone, profile.unitPreference], goal: goal && [goal.type, goal.baselineKg, goal.targetKg], firstEntry: entries[0] && [entries[0].localDate, entries[0].quantity, entries[0].nutrientSnapshot.kcal], lastEntry: entries.at(-1) && [entries.at(-1).localDate, entries.at(-1).quantity, entries.at(-1).nutrientSnapshot.kcal] };
}

window.formTest = { repo, ensureBase, seedScale, logicalSnapshot };
