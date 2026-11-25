import { useState } from 'react';
import { deriveCarbTargetG, reviewCoach, todayInTimeZone, validatePlanTargets } from '@form/domain';
import { newUuid } from '@form/data';
import { useForm } from '../context';
import { useAsync } from '../useAsync';
import { Card, PageHeader } from '../components/common';
import { fmt } from '../utils';

const statusText: Record<string, string> = {
  'collecting-data': 'ממשיכים לאסוף מידע לפני סקירה',
  maintain: 'הנתונים הזמינים תומכים בהמשך התכנית הנוכחית',
  monitor: 'ממשיכים לעקוב',
  'review-logging-and-context': 'כדאי לבדוק את שלמות התיעוד וההקשר לפני שינוי',
  'consider-small-adjustment': 'ניתן לשקול התאמה קטנה לאחר בדיקת הנתונים',
  'monitor-fast-loss': 'קצב הירידה האחרון דורש מעקב',
  'fast-loss-review': 'קצב הירידה דורש בחינה נוספת',
  'recovery-review': 'התאוששות לפני הפחתה',
  'safety-review': 'נדרשת בחינה של מצבך לפני שינוי היעדים',
  'goal-review': 'הגעת ליעד שנקבע. כדאי לבחון מעבר לתחזוקה'
};

const reasonText: Record<string, string> = {
  'insufficient-weight-coverage': 'פחות מחמש שקילות באחד השבועות',
  'insufficient-complete-food-logs': 'פחות מחמישה יומני תזונה מלאים באחד השבועות',
  'plan-changed-during-calibration-window': 'תכנית השתנתה במהלך חלון הכיול',
  'weekly-loss-within-target-range': 'קצב השינוי נמצא בטווח המעקב הראשוני',
  'intake-not-consistently-near-target': 'הצריכה המתועדת לא הייתה עקבית מספיק עם היעד',
  'insufficient-activity-context': 'אין מספיק הקשר פעילות/צעדים',
  'two-week-stall-with-adequate-context': 'נמצאה תקיעות עם כיסוי נתונים מספק',
  'two-week-loss-faster-than-1kg-per-week': 'שני שבועות של ירידה מהירה מהמנחה',
  'recent-loss-faster-than-1kg-per-week': 'השבוע האחרון מהיר מהמנחה',
  'repeated-low-energy': 'נרשמה אנרגיה נמוכה באופן חוזר',
  'repeated-high-hunger': 'נרשם רעב גבוה באופן חוזר',
  'configured-goal-reached': 'משקל יעד תכניתי הושג',
  'trend-not-yet-actionable': 'המגמה עדיין אינה מצדיקה פעולה'
};

export function CoachScreen() {
  const { repo, refresh, setAnnounce } = useForm();
  const today = todayInTimeZone('Asia/Jerusalem');
  const [confirming, setConfirming] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [proposedKcal, setProposedKcal] = useState('');
  const [error, setError] = useState('');
  const state = useAsync(async () => {
    const [plans, goal, measurements, diaryDays, foodEntries, checkins, reviews] = await Promise.all([
      repo.listPlans(), repo.getActiveGoal(), repo.listMeasurements(), repo.listDiaryDays(), repo.listFoodEntries(), repo.listCheckins(), repo.listCoachReviews()
    ]);
    const result = reviewCoach({ asOfDate: today, timezone: 'Asia/Jerusalem', plans, goal, measurements, diaryDays, foodEntries, checkins });
    return { result, plans, reviews };
  }, []);
  if (state.loading) return <PageHeader kicker="FORM / COACH" title="סקירה והמלצות" subtitle="מחשב ראיות…" />;
  if (state.error || !state.data) return <div className="notice danger" role="alert">{state.error ?? 'שגיאת חישוב'}</div>;
  const { result, plans, reviews } = state.data;
  const activePlan = plans.filter((plan) => plan.id === result.evidence.planId).at(-1) ?? plans.at(-1) ?? null;
  const stale = reviews[0] && reviews[0].inputFingerprint !== result.inputFingerprint;

  async function saveReview() {
    if (!activePlan) return;
    await repo.saveCoachReview({
      id: newUuid(), asOfDate: today, planId: activePlan.id, policyVersion: result.policyVersion, inputFingerprint: result.inputFingerprint,
      evidenceJson: JSON.parse(JSON.stringify(result.evidence)) as Record<string, unknown>, status: result.status, reasonCodes: result.reasonCodes,
      suggestionJson: JSON.parse(JSON.stringify(result.suggestion)) as Record<string, unknown>, createdAt: new Date().toISOString()
    });
    refresh();
    setAnnounce('הסקירה נשמרה בהיסטוריה');
  }

  async function applyPlan() {
    setError('');
    if (!activePlan) return;
    const kcal = Number(proposedKcal);
    if (!Number.isFinite(kcal)) return setError('יש להזין יעד קלורי תקין');
    const carbG = deriveCarbTargetG(kcal, activePlan.proteinG, activePlan.fatG);
    const errors = validatePlanTargets({ kcal, proteinG: activePlan.proteinG, fatG: activePlan.fatG, carbG });
    if (errors.length) return setError(errors.join('; '));
    await repo.createPlanRevision({ ...activePlan, effectiveFrom: effectiveDate, kcal, carbG, reason: 'שינוי מאושר בעקבות סקירה — אישור משתמש מפורש' });
    await saveReview();
    setConfirming(false);
    refresh();
    setAnnounce('נוצרה גרסת תכנית חדשה. היסטוריה לא השתנתה.');
  }

  const tone = result.status.includes('fast') || result.status.includes('safety') || result.status.includes('recovery') ? 'danger' : result.status.includes('review') || result.status.includes('adjustment') ? 'warn' : '';

  return (
    <div className="stack-lg">
      <PageHeader kicker="FORM / COACH" title="סקירה והמלצות" subtitle="סקירה דטרמיניסטית ושקופה. אין שינוי אוטומטי ביעדים." />
      <Card className={`status-panel ${tone}`}>
        <div className="split"><h2>{statusText[result.status]}</h2><span className={`pill ${tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'good'}`}>{result.status}</span></div>
        <p>גרסת מדיניות <bdi className="num">{result.policyVersion}</bdi> · נכון ל־<bdi className="num">{result.evidence.asOfDate}</bdi></p>
        {stale ? <p className="notice warn">הנתונים השתנו מאז הסקירה השמורה האחרונה. הסקירה הישנה נשמרת לביקורת ואינה נמחקת.</p> : null}
        <ul className="reason-list">{result.reasonCodes.map((code) => <li key={code}>{reasonText[code] ?? code}</li>)}</ul>
        <div className="button-row" style={{ marginBlockStart: 12 }}><button className="secondary-button" type="button" onClick={() => void saveReview()}>שמירת סקירה בהיסטוריה</button>{result.suggestion.kind === 'small-calorie-adjustment-discussion' ? <button className="primary-button" type="button" onClick={() => { setProposedKcal(String((activePlan?.kcal ?? 0) - 100)); setConfirming(true); }}>תצוגת שינוי מוצעת</button> : null}</div>
      </Card>
      <Card>
        <h2>חלונות ראיות</h2>
        <div className="table-wrap"><table><thead><tr><th>שבוע</th><th>שקילות</th><th>יומן מלא</th><th>ממוצע משקל</th><th>ממוצע קל׳</th><th>צעדים</th></tr></thead><tbody>{result.evidence.windows.map((window) => <tr key={window.index}><td>{window.index === 0 ? 'נוכחי' : window.index === 1 ? 'קודם' : 'לפני כן'}<br /><small>{window.startDate}–{window.endDate}</small></td><td>{window.weightDays}/7</td><td>{window.completeFoodDays}/7</td><td><bdi className="num">{fmt(window.weightMeanKg, 2)}</bdi></td><td><bdi className="num">{fmt(window.intakeMeanKcal)}</bdi></td><td>{window.stepDays}/7</td></tr>)}</tbody></table></div>
        <p className="card-muted">שינוי אחרון: <bdi className="num">{fmt(result.evidence.deltas.recentKg, 2)} ק״ג</bdi> · שינוי קודם: <bdi className="num">{fmt(result.evidence.deltas.priorKg, 2)} ק״ג</bdi></p>
      </Card>
      {confirming && activePlan ? (
        <Card className="status-panel warn">
          <h2>אישור שינוי תכנית — טרם הוחל</h2>
          <p>השינוי ייצור גרסת תכנית חדשה החל מתאריך שייבחר. ימים קודמים יישארו מוערכים לפי התכנית הקודמת.</p>
          <div className="inline-fields">
            <label className="field"><span>יעד חדש (קל׳)</span><input className="input" inputMode="decimal" value={proposedKcal} onChange={(event) => setProposedKcal(event.target.value)} /></label>
            <label className="field"><span>בתוקף מתאריך</span><input className="input" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></label>
          </div>
          <p className="card-muted">יעד נוכחי <bdi className="num">{fmt(activePlan.kcal)}</bdi> ← יעד מוצע <bdi className="num">{fmt(Number(proposedKcal) || null)}</bdi>. ההמלצה אינה מחייבת ואינה תחליף לייעוץ מקצועי.</p>
          {error ? <div className="notice danger" role="alert">{error}</div> : null}
          <div className="button-row"><button className="primary-button" type="button" onClick={() => void applyPlan()}>אישור ויצירת גרסה חדשה</button><button className="secondary-button" type="button" onClick={() => setConfirming(false)}>ביטול</button></div>
        </Card>
      ) : null}
      <Card>
        <h2>היסטוריית סקירות</h2>
        {reviews.length ? reviews.slice(0, 8).map((review) => <div className="meal-row" key={review.id}><div><div className="meal-row-title">{statusText[review.status]}</div><div className="meal-row-meta"><bdi className="num">{review.asOfDate}</bdi> · {review.policyVersion} · {review.reasonCodes.join(', ')}</div></div><span className="pill">{review.inputFingerprint.slice(0, 12)}</span></div>) : <p className="card-muted">עדיין לא נשמרה סקירה. אפשר לשמור את תוצאת החישוב הנוכחית לביקורת.</p>}
      </Card>
    </div>
  );
}
