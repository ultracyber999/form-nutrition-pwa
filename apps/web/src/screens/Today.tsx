import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { filterRange, preferredDailyMeasurements, resolvePlanForDate, sumEntryNutrients, todayInTimeZone } from '@form/domain';
import { useForm } from '../context';
import { useAsync } from '../useAsync';
import { CalorieRing, Card, DateNavigator, EmptyState, MacroBar, MetricTile, PageHeader } from '../components/common';
import { TrendChart } from '../components/TrendChart';
import { fmt, mealLabels } from '../utils';

export function TodayScreen() {
  const { repo, timezone } = useForm();
  const navigate = useNavigate();
  const today = todayInTimeZone(timezone);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const date = selectedDate ?? today;
  const state = useAsync(async () => {
    const [entries, diary, plans, measurements, checkins, goal] = await Promise.all([
      repo.entriesForDate(date),
      repo.diaryDay(date),
      repo.listPlans(),
      repo.listMeasurements(),
      repo.listCheckins(),
      repo.getActiveGoal()
    ]);
    return { entries, diary, plans, measurements, checkins, goal };
  }, [date]);

  if (state.loading) return <PageHeader kicker="FORM / TODAY" title="טוען את המצב שלך" subtitle="טוען נתונים…" />;
  if (state.error || !state.data) return <div className="notice danger" role="alert">{state.error ?? 'לא ניתן לטעון'}</div>;
  const { entries, diary, plans, measurements, checkins, goal } = state.data;
  const plan = resolvePlanForDate(plans, date);
  const totals = sumEntryNutrients(entries);
  const activeEntries = entries.filter((entry) => entry.deletedAt === null);
  const weights = preferredDailyMeasurements(measurements, 'weight');
  const latestWeight = weights.at(-1) ?? null;
  const weekWeights = filterRange(weights, date, '7d');
  const checkin = checkins.find((row) => row.localDate === date) ?? null;
  const completion = diary?.completionState ?? 'missing';

  return (
    <div className="stack-lg">
      <PageHeader kicker="FORM / TODAY" title="תמונת המצב שלך" subtitle="יום אחד בכל פעם. נתונים בחורים, החלטות בחירות, והכל מתועד." />
      <DateNavigator date={date} onChange={(next) => { setSelectedDate(next === today ? null : next); }} />
      <div className="desktop-two today-hero-grid">
        <Card className="hero-card">
          <div className="split"><h2>קלוריות ומאקרו</h2><span className={`pill ${completion === 'complete' ? 'good' : completion === 'partial' ? 'warn' : ''}`}>{completion === 'complete' ? 'יום שלם' : completion === 'partial' ? 'יום חלקי' : 'אין רישום'}</span></div>
          {plan ? (
            <div className="budget-layout">
              <div className="macro-list">
                <MacroBar label="חלבון" consumed={totals.totals.proteinG} target={plan.proteinG} className="protein" incomplete={totals.unknownCounts.proteinG > 0} />
                <MacroBar label="פחמימות" consumed={totals.totals.carbG} target={plan.carbG} className="carb" incomplete={totals.unknownCounts.carbG > 0} />
                <MacroBar label="שומן" consumed={totals.totals.fatG} target={plan.fatG} className="fat" incomplete={totals.unknownCounts.fatG > 0} />
                <MacroBar label="סיבים" consumed={totals.totals.fiberG} target={plan.fiberG} className="fiber" incomplete={totals.unknownCounts.fiberG > 0} />
              </div>
              <CalorieRing consumed={totals.totals.kcal} target={plan.kcal} incomplete={totals.unknownCounts.kcal > 0} />
            </div>
          ) : <EmptyState title="לא נמצאה תכנית פעילה לתאריך זה" />}
          {totals.unknownCounts.kcal || totals.unknownCounts.proteinG || totals.unknownCounts.carbG || totals.unknownCounts.fatG || totals.unknownCounts.fiberG ? <p className="notice warn">חלק מהערכים אינם ידועים. מוצג סיכום חלקי, לא אפס מומצא.</p> : null}
          <div className="split" style={{ marginBlockStart: 14 }}><span className="card-muted">נצרכו <bdi className="num">{fmt(totals.totals.kcal)}{totals.unknownCounts.kcal > 0 ? '+' : ''} קל׳</bdi></span><div className="button-row hero-actions"><Link className="primary-button" to={`/nutrition/${date}?add=1`}>+ הוספת אוכל</Link><Link className="secondary-button" to={`/check-in/${date}`}>צ׳ק-אין</Link></div></div>
        </Card>
        <Card className="weight-card">
          <div className="split"><h2>מגמת משקל</h2><span className="pill">7 ימים</span></div>
          <TrendChart points={weekWeights} unit="ק״ג" label="משקל" />
          <Link className="secondary-button" to="/progress">כל ההתקדמות</Link>
        </Card>
      </div>
      <div className="grid grid-4">
        <MetricTile label="חלבון שנצרך" value={totals.totals.proteinG} digits={1} unit="ג׳" context={plan ? `יעד ${fmt(plan.proteinG)} ג׳` : 'אין תכנית פעילה'} icon="●" />
        <MetricTile label="משקל אחרון" value={latestWeight?.valueKg ?? null} digits={1} unit="ק״ג" context={latestWeight ? `מדידה ${latestWeight.localDate}` : 'אין עדיין מדידות משקל'} icon="▣" />
        <MetricTile label="משקל יעד" value={goal?.targetKg ?? null} digits={1} unit="ק״ג" context="יעד תכנית, לא מדידה" icon="◎" />
        <MetricTile label="צעדים היום" value={checkin?.steps ?? null} unit="" context={checkin ? 'מתוך צ׳ק-אין יומי' : 'עדיין לא נרשם צ׳ק-אין'} icon="⌁" />
      </div>
      <div className="desktop-three">
        <Card>
          <div className="split"><h2>צ׳ק-אין יומי</h2><Link className="ghost-button" to={`/check-in/${date}`}>עדכון מדדים</Link></div>
          <div className="checkin-grid">
            <div className="checkin-tile"><span>משקל</span><strong className="num">{fmt(latestWeight?.valueKg ?? null, 1)} ק״ג</strong></div>
            <div className="checkin-tile"><span>צעדים</span><strong className="num">{fmt(checkin?.steps ?? null)}</strong></div>
            <div className="checkin-tile"><span>מים</span><strong className="num">{checkin?.waterMl === null || !checkin ? '—' : fmt(checkin.waterMl / 1000, 1)} ל׳</strong></div>
            <div className="checkin-tile"><span>שינה</span><strong className="num">{checkin?.sleepMinutes === null || !checkin ? '—' : fmt(checkin.sleepMinutes / 60, 1)} ש׳</strong></div>
          </div>
        </Card>
        <Card>
          <h2>המלצת FORM.</h2>
          <p className="card-muted">הסקירה מחושבת רק מנתונים מתועדים ולעולם אינה משנה יעדים אוטומטית.</p>
          <Link className="secondary-button" to="/coach">פתיחת הסקירה</Link>
        </Card>
        <Card>
          <div className="split"><h2>ארוחות היום</h2><button className="ghost-button" type="button" onClick={() => void navigate(`/nutrition/${date}`)}>יומן תזונה</button></div>
          {activeEntries.length ? activeEntries.slice(0, 4).map((entry) => (
            <div className="meal-row" key={entry.id}><div><div className="meal-row-title">{entry.labelSnapshot}</div><div className="meal-row-meta">{mealLabels[entry.mealType]} · <bdi className="num">{fmt(entry.quantity, 1)} {entry.unit === 'g' ? 'גרם' : entry.unit === 'serving' ? 'מנה' : 'סך הכל'}</bdi></div></div><div className="meal-kcal num">{fmt(entry.nutrientSnapshot.kcal)} קל׳</div></div>
          )) : <EmptyState title="עדיין אין רישום תזונה ליום זה" action={<Link className="secondary-button" to={`/nutrition/${date}?add=1`}>הוספת מזון</Link>} />}
        </Card>
      </div>
    </div>
  );
}
