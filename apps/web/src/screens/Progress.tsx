import { useState } from 'react';
import { completeDayIntakes, filterRange, goalProgress, preferredDailyMeasurements, todayInTimeZone, trailingAverage, type RangeKey } from '@form/domain';
import { useForm } from '../context';
import { useAsync } from '../useAsync';
import { Card, MetricTile, PageHeader } from '../components/common';
import { TrendChart } from '../components/TrendChart';
import { fmt, fmtSigned, shortDateLabel } from '../utils';

export function ProgressScreen() {
  const { repo } = useForm();
  const [range, setRange] = useState<RangeKey>('30d');
  const today = todayInTimeZone('Asia/Jerusalem');
  const state = useAsync(async () => {
    const [measurements, entries, diaryDays, goal] = await Promise.all([repo.listMeasurements(), repo.listFoodEntries(), repo.listDiaryDays(), repo.getActiveGoal()]);
    return { measurements, entries, diaryDays, goal };
  }, []);
  if (state.loading) return <PageHeader kicker="FORM / PROGRESS" title="התקדמות לאורך זמן" subtitle="טוען נתונים…" />;
  if (state.error || !state.data) return <div className="notice danger" role="alert">{state.error ?? 'שגיאת טעינה'}</div>;
  const weightsAll = preferredDailyMeasurements(state.data.measurements, 'weight');
  const waistsAll = preferredDailyMeasurements(state.data.measurements, 'waist');
  const weights = filterRange(weightsAll, today, range);
  const waists = filterRange(waistsAll, today, range);
  const intakes = filterRange(completeDayIntakes(state.data.entries, state.data.diaryDays), today, range);
  const trailing = trailingAverage(weightsAll, today, 7, 4);
  const latestWeight = weightsAll.at(-1)?.valueKg ?? null;
  const progress = goalProgress(state.data.goal, latestWeight);
  const coverageDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : null;

  return (
    <div className="stack-lg">
      <PageHeader kicker="FORM / PROGRESS" title="התקדמות לאורך זמן" subtitle="נקודות אמיתיות בלבד, פערים גלויים, וטבלה נגישה לכל גרף." />
      <div className="segmented" role="group" aria-label="טווח תאריכים">{(['7d','30d','90d','all'] as RangeKey[]).map((key) => <button key={key} type="button" aria-pressed={range === key} onClick={() => setRange(key)}>{key === 'all' ? 'הכול' : key.replace('d', ' ימים')}</button>)}</div>
      <div className="grid grid-4">
        <MetricTile label="משקל אחרון" value={latestWeight} digits={1} unit="ק״ג" context={weightsAll.at(-1) ? `מדידה ${weightsAll.at(-1)?.localDate}` : 'אין מדידות'} icon="▣" />
        <MetricTile label="ממוצע 7 ימים" value={trailing.average} digits={1} unit="ק״ג" context={trailing.average === null ? 'אין מספיק מדידות להצגת ממוצע' : `כיסוי ${trailing.coverage}/7`} icon="⌁" />
        <MetricTile label="התקדמות ליעד" value={progress.clampedPercent} unit="%" context={progress.signedChangeKg === null ? 'אין בסיס להצגה' : `שינוי חתום ${fmtSigned(progress.signedChangeKg, 1)} ק״ג`} icon="◎" />
        <MetricTile label="ימי תזונה מלאים" value={intakes.length} unit="ימים" context={coverageDays ? `מתוך ${coverageDays} בטווח` : 'בכל ההיסטוריה'} icon="☕" />
      </div>
      <div className="desktop-two">
        <Card><div className="split"><h2>משקל גוף</h2><span className="pill">{weights.length} מדידות</span></div><TrendChart points={weights} unit="ק״ג" label="משקל גוף" /></Card>
        <Card><div className="split"><h2>היקף מותניים</h2><span className="pill">{waists.length} מדידות</span></div><TrendChart points={waists} unit="ס״מ" label="היקף מותניים" /></Card>
      </div>
      <Card>
        <h2>צריכה בימים מלאים</h2>
        {intakes.length ? <div className="table-wrap" tabIndex={0} aria-label="צריכה בימים מלאים"><table><thead><tr><th>תאריך</th><th>קלוריות</th><th>חלבון</th><th>אנרגיה שלמה</th></tr></thead><tbody>{intakes.map((row) => <tr key={row.localDate}><td>{shortDateLabel(row.localDate)}</td><td><bdi className="num">{fmt(row.kcal)}</bdi></td><td><bdi className="num">{fmt(row.proteinG, 1)} ג׳</bdi></td><td>{row.completeEnergy ? 'כן' : 'חלקי'}</td></tr>)}</tbody></table></div> : <div className="empty-state">אין ימי תזונה שאושרו כמלאים בטווח זה. ימים חלקיים אינם מחושבים כאפס.</div>}
      </Card>
    </div>
  );
}
