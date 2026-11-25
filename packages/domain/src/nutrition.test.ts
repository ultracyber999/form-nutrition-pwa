import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cookedChicken100g, syntheticPlan } from '@form/test-data';
import { calculateConsumed, deriveCarbTargetG, manualEstimateNutrients, remainingKcal, scaleNutrients, sumEntryNutrients } from './nutrition';

describe('nutrition calculation contract', () => {
  it('QA-01 golden case: 180g cooked chicken is 297 kcal and 55.8g protein', () => {
    const result = calculateConsumed(cookedChicken100g, 180, 'mass-grams');
    expect(result.kcal).toBeCloseTo(297, 8);
    expect(result.proteinG).toBeCloseTo(55.8, 8);
    expect(result.fatG).toBeCloseTo(6.48, 8);
  });

  it('derives the blueprint carbohydrate target exactly at full precision', () => {
    expect(deriveCarbTargetG(2300, 170, 75)).toBeCloseTo(236.25, 8);
  });

  it('manual consumed totals are not multiplied by grams', () => {
    const nutrients = manualEstimateNutrients({ kcal: 450, proteinG: null, carbG: 30, fatG: 20, fiberG: null });
    const result = calculateConsumed({ basis: 'consumed-total', nutrients }, 1, 'consumed-total');
    expect(result.kcal).toBe(450);
    expect(result.proteinG).toBeNull();
  });

  it('unknown nutrients produce known subtotals and incomplete flags, not fake zeroes', () => {
    const totals = sumEntryNutrients([
      { deletedAt: null, nutrientSnapshot: { kcal: 100, proteinG: 10, carbG: 10, fatG: 2, fiberG: null } },
      { deletedAt: null, nutrientSnapshot: { kcal: 200, proteinG: 20, carbG: 20, fatG: 4, fiberG: 3 } }
    ]);
    expect(totals.totals.fiberG).toBe(3);
    expect(totals.unknownCounts.fiberG).toBe(1);
    expect(totals.complete.fiberG).toBe(false);
    const remaining = remainingKcal(2300, totals);
    expect(remaining.value).toBe(2000);
    expect(remaining.incomplete).toBe(false);
  });

  it('property: scaling is linear for finite nonnegative quantities', () => {
    fc.assert(fc.property(fc.double({ min: 0, max: 5000, noNaN: true }), (grams) => {
      const scaled = scaleNutrients(cookedChicken100g.nutrients, grams / 100);
      expect(scaled.kcal!).toBeCloseTo(165 * grams / 100, 6);
    }));
  });

  it('rejects impossible macro derivation', () => {
    expect(() => deriveCarbTargetG(1200, 250, 100)).toThrow();
  });

  it('synthetic plan fixture matches blueprint default', () => {
    expect(syntheticPlan.carbG).toBeCloseTo(236.25, 8);
  });
});
