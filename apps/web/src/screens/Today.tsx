import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { dateRange, filterRange, goalProgress, preferredDailyMeasurements, resolvePlanForDate, sumEntryNutrients, todayInTimeZone, trailingAverage } from '@form/domain';
import { useForm } from '../context';
import { useAsync } from '../useAsync';
import { CalorieRing, Card, DateNavigator, EmptyState, MacroBar, PageHeader } from '../components/common';
import { TrendChart } from '../components/TrendChart';
import { dateLabel, fmt, fmtSigned, mealLabels } from '../utils';
import { dailyFocus, diaryStatus, type Focus } from '../dailyFocus';

export function TodayScreen() {
  const { repo, timezone } = useForm();
  const navigate = useNavigate();
  const today = todayInTimeZone(timezone);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const date = selectedDate ?? today;
  const state = useAsync(async () => {
    const [entries, diary, plans, measurements, checkins, goal, diaryDays, workouts] = await Promise.all([
      repo.entriesForDate(date),
      repo.diaryDay(date),
      repo.listPlans(),
      repo.listMeasurements(),
      repo.listCheckins(),
      repo.getCurrentGoal(),
      repo.listDiaryDays(),
      repo.listWorkouts()
    ]);
    return { entries, diary, plans, measurements, checkins, goal, diaryDays, workouts };
  }, [date, timezone]);

  if (state.loading) return <PageHeader kicker="NIVNE / TODAY" title="טוען את המצב שלך" subtitle="טוען נתונים…" />;
  if (state.error || !state.data) return <div className="notice danger" role="alert">{state.error ?? 'לא ניתן לטעון'}</div>;
  const { entries, diary, plans, measurements, checkins, goal, diaryDays, workouts } = state.data;
  const plan = resolvePlanForDate(plans, date);
  const totals = sumEntryNutrients(entries);
  const activeEntries = entries.filter((entry) => entry.deletedAt === null);
  const weights = preferredDailyMeasurements(measurements, 'weight').filter((w) => w.localDate <= date);
  const latestWeight = weights.at(-1) ?? null;
  const weekWeights = filterRange(weights, date, '7d');
  const checkin = checkins.find((row) => row.localDate === date) ?? null;
  const completion = diaryStatus(diary ?? undefined);
  const eligibleGoal = goal && goal.effectiveFrom <= date && (goal.status === 'active' || goal.status === 'paused') ? goal : null;
  const progress = goalProgress(eligibleGoal, latestWeight?.valueKg ?? null);
  const avg = trailingAverage(weights, date, 7, 4);
  const dates = dateRange(date, 7);
  const week = dates.map((d) => {
    const row = checkins.find((c) => c.localDate === d);
    return { date: d, training: workouts.some(w=>w.localDate===d && w.exercises.some(e=>e.sets.some(s=>s.kind!=='warmup'))) ? 'strength' : row?.trainingStatus ?? null, food: diaryStatus(diaryDays.find((x) => x.localDate === d)), weighed: weights.some((w) => w.localDate === d) };
  });
  const strengthDays = week.filter((d) => d.training === 'strength').length;
  const completeDays = week.filter((d) => d.food === 'complete').length;
  const proteinRemaining = plan ? Math.max(0, plan.proteinG - totals.totals.proteinG) : 0;
  const focus = dailyFocus({ isToday: date === today, paused: goal?.status === 'paused', concerningSymptoms: checkin?.concerningSymptoms === true, hasPlan: !!plan, hasFood: activeEntries.length > 0, unknownEnergy: totals.unknownCounts.kcal > 0, unknownProtein: totals.unknownCounts.proteinG > 0, hasCheckin: !!checkin, complete: completion === 'complete', kcalRemaining: plan ? plan.kcal - totals.totals.kcal : 0, proteinRemaining });
  const focusCopy: Record<Focus, { title: string; description: string; action: string; to: string }> = {
    historical: { title: 'מבט ליום שנבחר', description: 'מוצגים נתונים עד התאריך שנבחר. המלצות עדכניות זמינות בסקירה.', action: 'לסקירה', to: '/coach' },
    safety: { title: 'כרגע העדיפות היא הבטיחות', description: 'התכנית מושהית או שסומן חשש בריאותי. אין כאן המלצה לשינוי תזונה. ניתן לעיין בסקירה ולפנות לייעוץ מתאים.', action: 'לסקירה', to: '/coach' },
    plan: { title: 'מגדירים את המסגרת', description: 'לא נמצאה תכנית לתאריך זה. הגדירו יעדים לפני פירוש התקציב.', action: 'להגדרות', to: '/settings' },
    log: { title: 'מתחילים ברישום הראשון', description: 'רשמו מה אכלתם. NIVNE אינו מניח שיום ללא נתונים הוא יום ללא אוכל.', action: 'רישום אוכל', to: '/nutrition/' + date + '?add=1' },
    verify: { title: 'משלימים את התמונה', description: 'חלק מנתוני האנרגיה או החלבון חסרים. בדקו את היומן לפני שימוש בסכומים.', action: 'בדיקת היומן', to: '/nutrition/' + date },
    checkin: { title: 'עדכון יומי קצר', description: 'רישום משקל, פעילות ושינה עוזר להבין את המגמה. אין חובה למלא שדה שאינו ידוע.', action: 'צ׳ק-אין', to: '/check-in/' + date },
    complete: { title: 'יום מתועד', description: 'היומן אושר כמלא ויש צ׳ק-אין. אפשר לעיין במגמה ללא שינוי אוטומטי ביעדים.', action: 'להתקדמות', to: '/progress' },
    protein: { title: 'חלבון מול היעד', description: 'לפי הרישום, נותר פער של ' + fmt(proteinRemaining, 1) + ' ג׳ ליעד החלבון. זהו מידע לתכנון, לא חובה להשלים בכל מחיר.', action: 'לרישום', to: '/nutrition/' + date + '?add=1' },
    review: { title: 'התקציב עבר את היעד', description: 'אין צורך בפיצוי או בשינוי מיידי של התכנית בגלל יום אחד. בדקו את הרישום והמשיכו לעקוב.', action: 'ליומן', to: '/nutrition/' + date },
    steady: { title: 'ממשיכים לתעד', description: 'הנתונים הנוכחיים זמינים למעקב. בדקו אם היומן משקף את כל הארוחות.', action: 'ליומן', to: '/nutrition/' + date }
  };
  const action = focusCopy[focus];

  return (
    <div className="stack-lg command-center">
      <div className="daily-heading"><div><p className="route-kicker">01 / DAILY</p><h2 className="page-title">{date === today ? 'היום שלי' : 'היום שנבחר'}</h2><p className="page-subtitle">{dateLabel(date)}</p></div><Link className="daily-coach-link secondary-button" to="/coach">סקירת NIVNE</Link></div>
      <DateNavigator date={date} onChange={(next) => { if (next) setSelectedDate(next === today ? null : next); }} />
      {date !== today ? <button className="ghost-button back-today" type="button" onClick={() => setSelectedDate(null)}>חזרה להיום</button> : null}
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
          <div className="button-row hero-actions command-actions"><Link className="primary-button" to={`/nutrition/${date}?add=1`}>+ הוספת אוכל</Link><Link className="secondary-button" to={`/check-in/${date}`}>צ׳ק-אין</Link></div>
        </Card>
        <Card className="insight-panel">
          <div className="insight-kicker"><span className="insight-mark" aria-hidden="true">✦</span><span>NIVNE / DAILY FOCUS</span></div>
          <h2>{action.title}</h2><p>{action.description}</p><Link className="secondary-button" to={action.to}>{action.action}<span aria-hidden="true"> ←</span></Link>
          <small className="card-muted">מבוסס על הנתונים שנרשמו · לא ייעוץ רפואי</small>
        </Card>
      </div>
      <div className="transformation-grid">
        <Card className="journey-panel">
          <div className="split"><h2>המסלול שלי</h2><Link className="ghost-button" to="/progress">כל ההתקדמות ←</Link></div>
          <div className="journey-numbers"><div><span>משקל אחרון</span><strong><bdi className="num">{fmt(latestWeight?.valueKg, 1)}</bdi> <small>ק״ג</small></strong><small>{latestWeight?.localDate ?? 'אין עדיין מדידה'}</small></div><div><span>ממוצע 7 ימים</span><strong><bdi className="num">{fmt(avg.average, 1)}</bdi> <small>ק״ג</small></strong><small>כיסוי {avg.coverage}/7</small></div></div>
          {eligibleGoal ? <div className="journey-goal"><div className="split"><span>יעד {fmt(eligibleGoal.targetKg,1)} ק״ג {eligibleGoal.status === 'paused' ? '· מושהה' : ''}</span><strong><bdi className="num">{fmt(progress.clampedPercent)}{progress.clampedPercent === null ? '' : '%'}</bdi></strong></div><progress className="journey-progress" aria-label="התקדמות ליעד משקל" value={progress.clampedPercent ?? 0} max={100} hidden={progress.clampedPercent === null}/><p className="card-muted">בסיס {fmt(eligibleGoal.baselineKg,1)} ק״ג · שינוי מהבסיס <bdi className="num">{fmtSigned(progress.signedChangeKg,1)}</bdi> ק״ג</p></div> : <p className="card-muted">אין יעד פעיל לתאריך זה.</p>}
          <TrendChart points={weekWeights} unit="ק״ג" label="משקל" />
        </Card>
        <Card className="rhythm-panel">
          <div className="split"><h2>הקצב שלי</h2><span className="pill">7 ימים עד {date.slice(5)}</span></div>
          <div className="rhythm-summary"><div><strong className="num">{strengthDays}</strong><span>ימי אימון כוח מתועדים</span></div><div><strong className="num">{completeDays}/7</strong><span>יומני תזונה מלאים</span></div></div>
          {plan?.strengthSessionsPerWeek != null ? <p className="card-muted">יעד אימוני כוח נוכחי: {plan.strengthSessionsPerWeek} בשבוע. ימי אימון אינם ספירת אימונים מרובים ביום.</p> : null}
          <div className="rhythm-days" role="list" aria-label="תיעוד שבעת הימים האחרונים">{week.map((day) => <Link role="listitem" key={day.date} to={'/check-in/' + day.date} className={'rhythm-day ' + (day.date === date ? 'current' : '')} aria-label={dateLabel(day.date) + ': ' + (day.training === 'strength' ? 'אימון כוח' : day.training === 'rest' ? 'מנוחה' : day.training === 'other' ? 'פעילות אחרת' : 'אימון לא מתועד') + ', ' + (day.food === 'complete' ? 'יומן מלא' : day.food === 'partial' ? 'יומן חלקי' : 'אין יומן') + (day.weighed ? ', שקילה מתועדת' : ', אין שקילה')}><span>{day.date.slice(-2)}</span><b className={day.training === 'strength' ? 'strength' : ''}>{day.training === 'strength' ? '✓' : day.training === 'rest' ? 'מ' : day.training === 'other' ? 'א' : '—'}</b><i className={'rhythm-dot ' + day.food} aria-hidden="true"/><i className={'rhythm-weight ' + (day.weighed ? 'recorded' : '')} aria-hidden="true"/></Link>)}</div>
          <div className="rhythm-legend"><span>✓ כוח · מ מנוחה · א אחר · — חסר</span><span>● יומן: מלא / חלקי / חסר · קו: שקילה</span></div>
          <div className="button-row"><Link className="secondary-button" to="/training">יומן אימונים ←</Link><Link className="secondary-button" to={'/check-in/' + date}>עדכון פעילות</Link></div>
        </Card>
      </div>
      <div className="desktop-two daily-secondary">
        <Card className="daily-vitals">
          <div className="split"><h2>פעילות והתאוששות</h2><Link className="ghost-button" to={'/check-in/' + date}>עדכון ←</Link></div>
          <div className="vital-grid">
            <div><span>צעדים</span><strong className="num">{fmt(checkin?.steps)}</strong><small>{plan?.steps != null ? 'יעד ' + fmt(plan.steps) : 'לא הוגדר יעד'}</small></div>
            <div><span>מים</span><strong><bdi className="num">{fmt(checkin?.waterMl == null ? null : checkin.waterMl / 1000, 1)}</bdi> ל׳</strong><small>{plan?.waterMl != null ? 'יעד ' + fmt(plan.waterMl / 1000, 1) + ' ל׳' : 'לא הוגדר יעד'}</small></div>
            <div><span>שינה</span><strong><bdi className="num">{fmt(checkin?.sleepMinutes == null ? null : checkin.sleepMinutes / 60, 1)}</bdi> ש׳</strong><small>משך מדווח</small></div>
            <div><span>אנרגיה</span><strong className="num">{fmt(checkin?.energy1to5)}{checkin?.energy1to5 != null ? '/5' : ''}</strong><small>דיווח אישי</small></div>
          </div>
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
