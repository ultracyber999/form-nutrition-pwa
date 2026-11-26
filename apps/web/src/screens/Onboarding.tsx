import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deriveCarbTargetG, isValidTimeZone, todayInTimeZone, validatePlanTargets } from '@form/domain';
import { Brand } from '../components/Brand';
import { useForm } from '../context';
import { fmt, nullableNumber } from '../utils';

export function OnboardingScreen() {
  const { repo, setNeedsOnboarding, setAnnounce } = useForm();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [timezone, setTimezone] = useState('Asia/Jerusalem');
  const [heightCm, setHeightCm] = useState('');
  const [baselineKg, setBaselineKg] = useState('');
  const [targetKg, setTargetKg] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('35');
  const [steps, setSteps] = useState('8000');
  const [water, setWater] = useState('2500');
  const [training] = useState('4');

  const carbs = useMemo(() => {
    const k = nullableNumber(kcal);
    const p = nullableNumber(protein);
    const f = nullableNumber(fat);
    if (k === null || p === null || f === null) return null;
    try { return deriveCarbTargetG(k, p, f); } catch { return null; }
  }, [kcal, protein, fat]);

  async function finish() {
    setError('');
    const baseline = nullableNumber(baselineKg);
    const target = nullableNumber(targetKg);
    const k = nullableNumber(kcal);
    const p = nullableNumber(protein);
    const f = nullableNumber(fat);
    const fi = nullableNumber(fiber);
    if (!isValidTimeZone(timezone)) return setError('אזור הזמן אינו תקין');
    if (baseline === null || target === null || k === null || p === null || f === null || fi === null || carbs === null) return setError('יש להשלים משקל בסיס, יעד וערכי תכנית תקינים');
    const errors = validatePlanTargets({ kcal: k, proteinG: p, fatG: f, carbG: carbs });
    if (errors.length) return setError('תכנית המקרו אינה אפשרית: חלבון ושומן חורגים מן הקלוריות');
    setSaving(true);
    try {
      const today = todayInTimeZone(timezone);
      await repo.createOnboarding({
        profile: { locale: 'he-IL', timezone, unitPreference: 'metric', heightCm: nullableNumber(heightCm) },
        goal: { type: target < baseline ? 'weight-loss' : target > baseline ? 'weight-gain' : 'maintenance', baselineKg: baseline, targetKg: target, effectiveFrom: today },
        plan: {
          effectiveFrom: today,
          kcal: k,
          proteinG: p,
          fatG: f,
          fiberG: fi,
          steps: nullableNumber(steps),
          waterMl: nullableNumber(water),
          sleepMinutesMin: 420,
          sleepMinutesMax: 540,
          strengthSessionsPerWeek: nullableNumber(training),
          reason: 'הוגדר בתהליך ההקמה הראשוני'
        }
      });
      setNeedsOnboarding(false);
      setAnnounce('ההקמה נשמרה במכשיר');
      void navigate('/today', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'לא ניתן לשמור את ההקמה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-intro">
        <Brand tagline />
        <p className="route-kicker">01 / YOUR NEXT CHAPTER</p>
        <h2 className="page-title">הגוף נבנה.<br/>הכוח נבנה.<br/><span>הדרך שלך.</span></h2>
        <p className="page-subtitle">תזונה, אימוני כוח והתאוששות במקום אחד. הנתונים שלך נשארים אצלך.</p>
        <div className="onboarding-disciplines" aria-label="תחומי המערכת"><span>01 / FUEL</span><span>02 / STRENGTH</span><span>03 / EVOLVE</span></div>
      </div>
      <div className="stepper" aria-label={`שלב ${step + 1} מתוך 3`}><span className="active" /><span className={step >= 1 ? 'active' : ''} /><span className={step >= 2 ? 'active' : ''} /></div>
      {step === 0 ? (
        <section className="card privacy-card">
          <h2>פרטיות בשליטתך</h2>
          <p>הנתונים נשמרים במכשיר זה בלבד. ייצוא גיבוי זמין בהגדרות. אין התחייבות רפואית והמלצות המערכת אינן תחליף לייעוץ מקצועי.</p>
          <p className="card-muted">אין צורך בשם אמיתי או תאריך לידה. משקל בסיס הוא נקודת ייחוס תכניתית ואינו מדידה מומצאת.</p>
          <div className="button-row"><button className="primary-button" type="button" onClick={() => setStep(1)}>ממשיכים בהקמה</button></div>
        </section>
      ) : null}
      {step === 1 ? (
        <section className="card form-grid">
          <h2>הגדרות בסיס</h2>
          <div className="inline-fields">
            <div className="field"><label htmlFor="baseline">משקל בסיס (ק״ג)</label><input className="input" id="baseline" inputMode="decimal" value={baselineKg} onChange={(e) => setBaselineKg(e.target.value)} /></div>
            <div className="field"><label htmlFor="target">משקל יעד (ק״ג)</label><input className="input" id="target" inputMode="decimal" value={targetKg} onChange={(e) => setTargetKg(e.target.value)} /></div>
          </div>
          <div className="inline-fields">
            <div className="field"><label htmlFor="height">גובה (ס״מ, אופציונלי)</label><input className="input" id="height" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} /></div>
            <div className="field"><label htmlFor="timezone">אזור זמן</label><input className="input" id="timezone" dir="ltr" value={timezone} onChange={(e) => setTimezone(e.target.value)} /></div>
          </div>
          <div className="button-row"><button className="secondary-button" type="button" onClick={() => setStep(0)}>חזרה</button><button className="primary-button" type="button" onClick={() => setStep(2)}>המשך לתכנית</button></div>
        </section>
      ) : null}
      {step === 2 ? (
        <section className="card form-grid">
          <h2>תכנית יעדים</h2>
          <p className="card-muted">אלה ערכי תכנון הניתנים לעריכה, לא המלצה רפואית אוניברסלית. יעדים משמעותיים כדאי לבחון עם איש מקצוע.</p>
          <div className="inline-fields">
            <div className="field"><label htmlFor="kcal">קלוריות ליום</label><input className="input" id="kcal" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} /></div>
            <div className="field"><label htmlFor="protein">חלבון (ג׳)</label><input className="input" id="protein" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} /></div>
          </div>
          <div className="inline-fields">
            <div className="field"><label htmlFor="fat">שומן (ג׳)</label><input className="input" id="fat" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} /></div>
            <div className="field"><label htmlFor="fiber">סיבים (ג׳)</label><input className="input" id="fiber" inputMode="decimal" value={fiber} onChange={(e) => setFiber(e.target.value)} /></div>
          </div>
          <div className="inline-fields">
            <div className="field"><label htmlFor="stepsTarget">צעדים</label><input className="input" id="stepsTarget" inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} /></div>
            <div className="field"><label htmlFor="waterTarget">מים (מ״ל)</label><input className="input" id="waterTarget" inputMode="numeric" value={water} onChange={(e) => setWater(e.target.value)} /></div>
          </div>
          <div className="preview-box"><span>פחמימות מחושבות</span><strong className="num">{fmt(carbs, 1)} ג׳</strong><small>החישוב: (קלוריות − 4×חלבון − 9×שומן) ÷ 4</small></div>
          {error ? <div className="notice danger" role="alert">{error}</div> : null}
          <div className="button-row"><button className="secondary-button" type="button" onClick={() => setStep(1)}>חזרה</button><button className="primary-button" type="button" disabled={saving} onClick={() => void finish()}>{saving ? 'שומר במכשיר…' : 'שמירת תכנית והתחלה'}</button></div>
        </section>
      ) : null}
    </main>
  );
}
