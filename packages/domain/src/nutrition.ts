import type { FoodEntry, FoodVersion, NutrientProfile, NutritionPlan, Recipe, RecipeIngredient } from '@form/contracts';

export type NutrientKey = keyof NutrientProfile;
export const nutrientKeys: NutrientKey[] = ['kcal', 'proteinG', 'carbG', 'fatG', 'fiberG'];

export function zeroNutrients(): NutrientProfile {
  return { kcal: 0, proteinG: 0, carbG: 0, fatG: 0, fiberG: 0 };
}

export function scaleNutrients(nutrients: NutrientProfile, factor: number): NutrientProfile {
  if (!Number.isFinite(factor) || factor < 0) throw new Error('Nutrient scale factor must be a nonnegative finite number');
  return {
    kcal: nutrients.kcal === null ? null : nutrients.kcal * factor,
    proteinG: nutrients.proteinG === null ? null : nutrients.proteinG * factor,
    carbG: nutrients.carbG === null ? null : nutrients.carbG * factor,
    fatG: nutrients.fatG === null ? null : nutrients.fatG * factor,
    fiberG: nutrients.fiberG === null ? null : nutrients.fiberG * factor
  };
}

export function calculateConsumed(food: Pick<FoodVersion, 'basis' | 'nutrients'>, quantity: number, basis: FoodEntry['basis']): NutrientProfile {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 5000) throw new Error('Quantity must be between 0 and 5000');
  if (basis === 'mass-grams') {
    if (food.basis !== 'per-100g') throw new Error('Mass-based entry requires per-100g food basis');
    return scaleNutrients(food.nutrients, quantity / 100);
  }
  if (basis === 'serving-count') {
    if (food.basis !== 'per-serving') throw new Error('Serving entry requires per-serving food basis');
    return scaleNutrients(food.nutrients, quantity);
  }
  if (basis === 'consumed-total') {
    if (quantity !== 1) throw new Error('Consumed-total entries use quantity 1 and direct nutrient values');
    return { ...food.nutrients };
  }
  throw new Error('Unsupported entry basis');
}

export function manualEstimateNutrients(input: Partial<NutrientProfile>): NutrientProfile {
  return {
    kcal: input.kcal ?? null,
    proteinG: input.proteinG ?? null,
    carbG: input.carbG ?? null,
    fatG: input.fatG ?? null,
    fiberG: input.fiberG ?? null
  };
}

export type NutrientTotals = {
  totals: Record<NutrientKey, number>;
  unknownCounts: Record<NutrientKey, number>;
  complete: Record<NutrientKey, boolean>;
  entryCount: number;
};

export function sumEntryNutrients(entries: Pick<FoodEntry, 'nutrientSnapshot' | 'deletedAt'>[]): NutrientTotals {
  const active = entries.filter((entry) => entry.deletedAt === null);
  const totals = Object.fromEntries(nutrientKeys.map((key) => [key, 0])) as Record<NutrientKey, number>;
  const unknownCounts = Object.fromEntries(nutrientKeys.map((key) => [key, 0])) as Record<NutrientKey, number>;
  for (const entry of active) {
    for (const key of nutrientKeys) {
      const value = entry.nutrientSnapshot[key];
      if (value === null) unknownCounts[key] += 1;
      else totals[key] += value;
    }
  }
  const complete = Object.fromEntries(nutrientKeys.map((key) => [key, active.length > 0 && unknownCounts[key] === 0])) as Record<NutrientKey, boolean>;
  return { totals, unknownCounts, complete, entryCount: active.length };
}

export function remainingKcal(targetKcal: number, totals: NutrientTotals): { value: number | null; incomplete: boolean } {
  if (totals.unknownCounts.kcal > 0) return { value: targetKcal - totals.totals.kcal, incomplete: true };
  return { value: targetKcal - totals.totals.kcal, incomplete: false };
}

export function deriveCarbTargetG(kcal: number, proteinG: number, fatG: number): number {
  const result = (kcal - 4 * proteinG - 9 * fatG) / 4;
  if (!Number.isFinite(result) || result < 0) throw new Error('Derived carbohydrate target is negative or invalid');
  return result;
}

export function validatePlanTargets(input: Pick<NutritionPlan, 'kcal' | 'proteinG' | 'fatG' | 'carbG'>): string[] {
  const errors: string[] = [];
  try {
    const derived = deriveCarbTargetG(input.kcal, input.proteinG, input.fatG);
    if (Math.abs(derived - input.carbG) > 1) errors.push('carb target does not match kcal/protein/fat derivation');
  } catch {
    errors.push('protein and fat exceed available calories');
  }
  if (input.kcal < 800) errors.push('calorie target below supported input bound');
  return errors;
}

export function ingredientNutrients(ingredient: RecipeIngredient): NutrientProfile {
  return scaleNutrients(ingredient.nutrientSnapshotPer100g, ingredient.quantityG / 100);
}

export function recipeTotals(recipe: Recipe): NutrientTotals {
  const pseudoEntries = recipe.ingredients.map((ingredient) => ({ nutrientSnapshot: ingredientNutrients(ingredient), deletedAt: null }));
  return sumEntryNutrients(pseudoEntries);
}

export function recipeTotalNutrients(recipe: Recipe): NutrientProfile {
  const result = zeroNutrients();
  for (const key of nutrientKeys) {
    let unknown = false;
    let sum = 0;
    for (const ingredient of recipe.ingredients) {
      const value = ingredient.nutrientSnapshotPer100g[key];
      if (value === null) unknown = true;
      else sum += value * ingredient.quantityG / 100;
    }
    result[key] = unknown ? null : sum;
  }
  return result;
}

export function recipePortionNutrients(recipe: Recipe, portion: { grams?: number; servings?: number }): NutrientProfile {
  const total = recipeTotalNutrients(recipe);
  if (portion.grams !== undefined) {
    if (recipe.yieldG === null) throw new Error('Recipe has no known final mass');
    return scaleNutrients(total, portion.grams / recipe.yieldG);
  }
  if (portion.servings !== undefined) {
    if (recipe.servingCount === null) throw new Error('Recipe has no serving count');
    return scaleNutrients(total, portion.servings / recipe.servingCount);
  }
  throw new Error('Portion requires grams or servings');
}

export function roundDisplay(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
