import type { NutrientProfile } from '@form/contracts';
import { roundDisplay } from '@form/domain';

export const mealLabels: Record<string, string> = {
  breakfast: 'בוקר',
  lunch: 'צהריים',
  snack: 'ביניים',
  dinner: 'ערב',
  other: 'אחר'
};

export function fmt(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('he-IL', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(roundDisplay(value, digits));
}

export function fmtSigned(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const formatted = fmt(Math.abs(value), digits);
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatted}`;
}

export function nutrientText(nutrients: NutrientProfile): string {
  return `${fmt(nutrients.kcal)} קל׳ · חלבון ${fmt(nutrients.proteinG, 1)} ג׳ · פחמימות ${fmt(nutrients.carbG, 1)} ג׳ · שומן ${fmt(nutrients.fatG, 1)} ג׳`;
}

export function dateLabel(isoDate: string): string {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${isoDate}T12:00:00`));
}

export function shortDateLabel(isoDate: string): string {
  return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${isoDate}T12:00:00`));
}

export function nullableNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvEscape(value: string | number | null | undefined): string {
  let text = String(value ?? '');
  if (/^[=+@-]/.test(text) && !/^[-+]?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
