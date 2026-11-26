import { describe, expect, it } from 'vitest';
import { dailyFocus, diaryStatus, parseFoodQuery, type FocusInput } from './dailyFocus';
const base: FocusInput = { isToday: true, paused: false, concerningSymptoms: false, hasPlan: true, hasFood: true, unknownEnergy: false, unknownProtein: false, hasCheckin: false, complete: false, kcalRemaining: 500, proteinRemaining: 35 };
describe('daily command center', () => {
  it('prioritizes safety over nutrition prompts', () => {
    expect(dailyFocus({...base, paused: true})).toBe('safety');
    expect(dailyFocus({...base, concerningSymptoms: true, hasFood: false})).toBe('safety');
  });
  it('does not infer actions for historical or incomplete records', () => {
    expect(dailyFocus({...base, isToday: false})).toBe('historical');
    expect(dailyFocus({...base, unknownEnergy: true})).toBe('verify');
    expect(dailyFocus({...base, unknownProtein: true})).toBe('verify');
    expect(dailyFocus({...base, kcalRemaining: -10})).toBe('review');
    expect(dailyFocus({...base, hasFood: false})).toBe('log');
  });
  it('distinguishes open, complete and missing check-ins', () => {
    expect(dailyFocus(base)).toBe('protein');
    expect(dailyFocus({...base, complete: true})).toBe('checkin');
    expect(dailyFocus({...base, complete: true, hasCheckin: true})).toBe('complete');
    expect(diaryStatus({completionState:'complete', completionRevision: 2, foodRevision:3})).toBe('partial');
    expect(diaryStatus(undefined)).toBe('missing');
  });
});
describe('explicit food quantity input', () => {
  it.each([['180 גרם חזה עוף','חזה עוף',180],['חזה עוף 180 ג׳','חזה עוף',180],['125.5g rice','rice',125.5],['rice 125,5 grams','rice',125.5]])('parses %s', (q,name,grams) => {
    expect(parseFoodQuery(q)).toEqual({name,grams});
  });
  it.each(['two eggs','180 rice','-10g rice','6000g rice','0g rice','100g rice + chicken','100g rice 200g chicken'])('never guesses %s', q => expect(parseFoodQuery(q).grams).toBeNull());
});
