// Pure presentation helpers. No goal mutation, medical advice or persistence.
export type DayStatus = 'complete' | 'partial' | 'missing';
export type FocusInput = {
  isToday: boolean; paused: boolean; concerningSymptoms: boolean;
  hasPlan: boolean; hasFood: boolean; unknownEnergy: boolean; unknownProtein: boolean;
  hasCheckin: boolean; complete: boolean;
  kcalRemaining: number; proteinRemaining: number;
};
export type Focus = 'historical' | 'safety' | 'plan' | 'log' | 'verify' | 'checkin' | 'complete' | 'protein' | 'review' | 'steady';
export function dailyFocus(i: FocusInput): Focus {
  if (!i.isToday) return 'historical';
  if (i.paused || i.concerningSymptoms) return 'safety';
  if (!i.hasPlan) return 'plan';
  if (!i.hasFood) return 'log';
  if (i.unknownEnergy || i.unknownProtein) return 'verify';
  if (i.kcalRemaining < 0) return 'review';
  if (i.complete) return i.hasCheckin ? 'complete' : 'checkin';
  if (i.proteinRemaining > 0 && i.kcalRemaining > 0) return 'protein';
  return i.hasCheckin ? 'steady' : 'checkin';
}
export function parseFoodQuery(query: string): { name: string; grams: number | null } {
  const trimmed = query.trim();
  // Accept one explicitly quantified food. Never guess serving sizes or parse multiple foods.
  const unit = '(?:גרם|גר[׳\\x27]|ג[׳\\x27]|grams?|g)';
  const number = '(\\d+(?:[.,]\\d+)?)';
  const prefix = new RegExp('^' + number + '\\s*' + unit + '\\s+(.+)$', 'iu');
  const suffix = new RegExp('^(.+?)\\s+' + number + '\\s*' + unit + '$', 'iu');
  const p = trimmed.match(prefix);
  const s = p ? null : trimmed.match(suffix);
  const name = (p?.[2] ?? s?.[1] ?? '').trim();
  const grams = Number((p?.[1] ?? s?.[2] ?? '').replace(',', '.'));
  if (!name || !Number.isFinite(grams) || grams <= 0 || grams > 5000 || /[+;\n]|\d/.test(name)) return { name: trimmed, grams: null };
  return { name, grams };
}
export function diaryStatus(day: { completionState: string; completionRevision: number | null; foodRevision: number } | undefined): DayStatus {
  if (!day) return 'missing';
  if (day.completionState === 'complete' && day.completionRevision === day.foodRevision) return 'complete';
  return day.completionState === 'missing' ? 'missing' : 'partial';
}
