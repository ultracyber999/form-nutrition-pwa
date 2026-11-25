import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { FoodEntry } from '@form/contracts';
import { completeDayIntakes } from '@form/domain';
import { cookedChicken100g } from '@form/test-data';
import { FormDatabase } from './db';
import { FormRepository } from './repository';

function id(n: number) { return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`; }

describe('realistic local-scale performance smoke', () => {
  it('loads and analyzes approximately 10k food entries within local performance budget', async () => {
    const db = new FormDatabase(`form-perf-${Date.now()}`);
    const repo = new FormRepository(db);
    const now = new Date().toISOString();
    const entries: FoodEntry[] = [];
    let n = 1;
    for (let day = 0; day < 365; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1) + day * 86400000).toISOString().slice(0, 10);
      for (let meal = 0; meal < 27; meal += 1) {
        entries.push({ id: id(n++), localDate: date, mealType: meal % 2 ? 'lunch' : 'dinner', foodVersionId: cookedChicken100g.id, labelSnapshot: 'synthetic scale meal', quantity: 180, unit: 'g', basis: 'mass-grams', nutrientSnapshot: cookedChicken100g.nutrients, confidence: 'generic-estimate', source: 'catalog', createdAt: now, updatedAt: now, deletedAt: null, version: 1 });
      }
    }
    expect(entries.length).toBe(9855);
    const writeStart = performance.now();
    await db.foodEntries.bulkAdd(entries);
    const writeMs = performance.now() - writeStart;
    const readStart = performance.now();
    const loaded = await repo.listFoodEntries();
    const readMs = performance.now() - readStart;
    const analyticsStart = performance.now();
    const intake = completeDayIntakes(loaded, []);
    const analyticsMs = performance.now() - analyticsStart;
    const exportStart = performance.now();
    const exported = await repo.exportBundle();
    const exportMs = performance.now() - exportStart;
    console.log(`PERF_SCALE entries=${entries.length} bulkWriteMs=${writeMs.toFixed(1)} readMs=${readMs.toFixed(1)} analyticsMs=${analyticsMs.toFixed(1)} exportMs=${exportMs.toFixed(1)} exportEntries=${exported.foodEntries.length}`);
    expect(loaded).toHaveLength(entries.length);
    expect(intake).toEqual([]);
    expect(exported.foodEntries).toHaveLength(entries.length);
    expect(readMs).toBeLessThan(1500);
    expect(analyticsMs).toBeLessThan(1000);
    expect(exportMs).toBeLessThan(3000);
    db.close();
  }, 20000);
});
