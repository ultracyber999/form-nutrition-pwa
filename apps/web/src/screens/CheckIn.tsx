import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { todayInTimeZone } from '@form/domain';
import { useForm } from '../context';
import { useAsync } from '../useAsync';
import { Card, DateNavigator, PageHeader } from '../components/common';
import { fmt, nullableNumber, shortDateLabel } from '../utils';

export function CheckInScreen() {
  const { repo, refresh, setAnnounce } = useForm();
  const params = useParams();
  const navigate = useNavigate();
  const date = params.date ?? todayInTimeZone('Asia/Jerusalem');
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [steps, setSteps] = useState('');
  const [water, setWater] = useState('');
  const [sleep, setSleep] = useState('');
  const [training, setTraining] = useState('unknown');
  const [hunger, setHunger] = useState('');
  const [energy, setEnergy] = useState('');
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const state = useAsync(async () => {
    const [checkin, measurements] = await Promise.all([repo.checkinForDate(date), repo.listMeasurements()]);
    return { checkin, measurements: measurements.filter((row) => row.localDate === date && row.deletedAt === null) };
  }, [date]);

  useEffect(() => {
    if (!state.data) return;
    const checkin = state.data.checkin;
    setSteps(checkin?.steps?.toString() ?? '');
    setWater(checkin?.waterMl?.toString() ?? '');
    setSleep(checkin?.sleepMinutes === null || !checkin ? '' : (checkin.sleepMinutes / 60).toString());
    setTraining(checkin?.trainingStatus ?? 'unknown');
    setHunger(checkin?.hunger1to5?.toString() ?? '');
    setEnergy(checkin?.energy1to5?.toString() ?? '');
    setNotes(checkin?.notes ?? '');
    const preferredWeight = state.data.measurements.find((row) => row.type === 'weight' && row.preferred);
    const preferredWaist = state.data.measurements.find((row) => row.type === 'waist' && row.preferred);
    setWeight(preferredWeight?.value.toString() ?? '');
    setWaist(preferredWaist?.value.toString() ?? '');
    setDirty(false);
  }, [state.data]);

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [dirty]);

  const mark = (setter: (value: string) => void) => (value: string) => { setter(value); setDirty(true); };

  async function save() {
    setError('');
    setSaving(true);
    try {
      const weightValue = nullableNumber(weight);
      const waistValue = nullableNumber(waist);
      if (weightValue !== null && (weightValue < 35 || weightValue > 350)) throw new Error('משקל חורג מגבולות הקלט הרחבים');
      if (waistValue !== null && (waistValue < 30 || waistValue > 250)) throw new Error('היקף חורג מגבולות הקלט הרחבים');
      const measuredAt = new Date().toISOString();
      if (weightValue !== null) await repo.saveMeasurement({ type: 'weight', value: weightValue, unit: 'kg', measuredAt, localDate: date, source: 'manual', externalSampleId: null, preferred: true });
      if (waistValue !== null) await repo.saveMeasurement({ type: 'waist', value: waistValue, unit: 'cm', measuredAt, localDate: date, source: 'manual', externalSampleId: null, preferred: true });
      const sleepHours = nullableNumber(sleep);
      await repo.saveCheckin({
        localDate: date,
        steps: nullableNumber(steps),
        waterMl: nullableNumber(water),
        sleepMinutes: sleepHours === null ? null : Math.round(sleepHours * 60),
        trainingStatus: training === 'unknown' ? null : training as 'strength' | 'rest' | 'other',
        hunger1to5: nullableNumber(hunger),
        energy1to5: nullableNumber(energy),
        notes: notes.trim() || null
      });
      setDirty(false);
      refresh();
      setAnnounce('הצ׳ק-אין נשמר במכשיר');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'לא ניתן לשמור');
    } finally {
      setSaving(false);
    }
  }

  if (state.loading) return <PageHeader kicker="FORM / CHECKIN" title="צ׳ק-אין יומי" subtitle="טוען נתונים…" />;
  const measurements = state.data?.measurements ?? [];

  return (
    <div className="stack-lg">
      <PageHeader kicker="FORM / CHECKIN" title="צ׳ק-אין יומי" subtitle="רישום קצר של מדדים בפועל. שדה ריק משמעו לא ידוע — לא אפס." />
      <DateNavigator date={date} onChange={(next) => {
        if (!dirty || window.confirm('יש שינויים שלא נשמרו. לעבור תאריך בלי שמירה?')) void navigate(`/check-in/${next}`);
      }} />
      <Card>
        <h2>מדידות והרגלים</h2>
        <div className="inline-fields">
          <div className="field"><label htmlFor="weight">משקל (ק״ג)</label><input className="input" id="weight" inputMode="decimal" value={weight} onChange={(e) => mark(setWeight)(e.target.value)} /></div>
          <div className="field"><label htmlFor="waist">היקף מותניים (ס״מ)</label><input className="input" id="waist" inputMode="decimal" value={waist} onChange={(e) => mark(setWaist)(e.target.value)} /></div>
        </div>
        <div className="inline-fields">
          <div className="field"><label htmlFor="steps">צעדים</label><input className="input" id="steps" inputMode="numeric" value={steps} onChange={(e) => mark(setSteps)(e.target.value)} /></div>
          <div className="field"><label htmlFor="water">מים (מ״ל)</label><div className="button-row"><input className="input" id="water" inputMode="numeric" value={water} onChange={(e) => mark(setWater)(e.target.value)} /><button className="secondary-button" type="button" onClick={() => mark(setWater)(String((nullableNumber(water) ?? 0) + 250))}>+250</button></div></div>
        </div>
        <div className="inline-fields">
          <div className="field"><label htmlFor="sleep">שינה (שעות)</label><input className="input" id="sleep" inputMode="decimal" value={sleep} onChange={(e) => mark(setSleep)(e.target.value)} /></div>
          <div className="field"><label htmlFor="training">אימון</label><select className="input" id="training" value={training} onChange={(e) => { setTraining(e.target.value); setDirty(true); }}><option value="unknown">לא ידוע</option><option value="strength">כוח</option><option value="rest">מנוחה</option><option value="other">אחר</option></select></div>
        </div>
        <div className="inline-fields">
          <div className="field"><label htmlFor="hunger">רעב (1–5)</label><input className="input" id="hunger" inputMode="numeric" min="1" max="5" value={hunger} onChange={(e) => mark(setHunger)(e.target.value)} /></div>
          <div className="field"><label htmlFor="energy">אנרגיה (1–5)</label><input className="input" id="energy" inputMode="numeric" min="1" max="5" value={energy} onChange={(e) => mark(setEnergy)(e.target.value)} /></div>
        </div>
        <div className="field"><label htmlFor="notes">הערות</label><textarea className="input" id="notes" value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true); }} /></div>
        {error ? <div className="notice danger" role="alert">{error}</div> : null}
        <div className="button-row"><button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>{saving ? 'שומר במכשיר…' : 'שמירת צ׳ק-אין'}</button>{dirty ? <span className="pill warn">יש שינויים שלא נשמרו</span> : <span className="pill good">הכול שמור</span>}</div>
      </Card>
      <Card>
        <h2>היסטוריית מדידות לתאריך</h2>
        {measurements.length ? <div className="table-wrap"><table><thead><tr><th>סוג</th><th>ערך</th><th>שעה</th><th>מקור</th></tr></thead><tbody>{measurements.map((row) => <tr key={row.id}><td>{row.type === 'weight' ? 'משקל' : 'היקף'}</td><td><bdi className="num">{fmt(row.value, 1)} {row.unit === 'kg' ? 'ק״ג' : 'ס״מ'}</bdi>{row.preferred ? ' · מועדף' : ''}</td><td>{shortDateLabel(row.localDate)}</td><td>{row.source}</td></tr>)}</tbody></table></div> : <p className="card-muted">אין מדידות לתאריך זה. מדידה חדשה לא תדרוס מדידות אחרות.</p>}
      </Card>
    </div>
  );
}
