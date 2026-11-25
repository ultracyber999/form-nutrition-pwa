import type { NutritionPlan } from '@form/contracts';
import { compareDates, diffDays } from './dates';

export function sortPlans(plans: NutritionPlan[]): NutritionPlan[] {
  return [...plans].sort((a, b) => compareDates(a.effectiveFrom, b.effectiveFrom) || a.createdAt.localeCompare(b.createdAt));
}

export function resolvePlanForDate(plans: NutritionPlan[], localDate: string): NutritionPlan | null {
  const eligible = sortPlans(plans).filter((plan) => compareDates(plan.effectiveFrom, localDate) <= 0);
  return eligible.at(-1) ?? null;
}

export function assertNoDuplicateEffectiveDates(plans: NutritionPlan[]): void {
  const seen = new Set<string>();
  for (const plan of plans) {
    if (seen.has(plan.effectiveFrom)) throw new Error(`Duplicate plan effective date: ${plan.effectiveFrom}`);
    seen.add(plan.effectiveFrom);
  }
}

export function stablePlanAcrossDates(plans: NutritionPlan[], dates: string[]): NutritionPlan | null {
  if (dates.length === 0) return null;
  const resolved = dates.map((date) => resolvePlanForDate(plans, date));
  const first = resolved[0];
  if (!first) return null;
  return resolved.every((plan) => plan?.id === first.id) ? first : null;
}

export function calibrationElapsedDays(plan: NutritionPlan, asOfDate: string): number {
  return Math.max(0, diffDays(asOfDate, plan.effectiveFrom) + 1);
}

export function nextPlanEffectiveDate(today: string, requested: string): string {
  return compareDates(requested, today) < 0 ? today : requested;
}
