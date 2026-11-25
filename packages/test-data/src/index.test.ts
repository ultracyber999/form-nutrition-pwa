import { describe, expect, it } from 'vitest';
import { builtinFoods, cookedChicken100g, syntheticPlan } from './index';

describe('synthetic fixtures', () => {
  it('contains the golden chicken fixture without personal data', () => {
    expect(cookedChicken100g.name).toBe('חזה עוף מבושל');
    expect(cookedChicken100g.nutrients.kcal).toBe(165);
    expect(cookedChicken100g.source.attribution).toContain('Generic');
  });

  it('contains the legacy-derived 32-item generic catalog', () => {
    expect(builtinFoods).toHaveLength(32);
    expect(new Set(builtinFoods.map((food) => food.id)).size).toBe(32);
  });

  it('uses the blueprint default planning fixture explicitly as synthetic', () => {
    expect(syntheticPlan.reason).toBe('synthetic-test-fixture');
    expect(syntheticPlan.carbG).toBe(236.25);
  });
});
