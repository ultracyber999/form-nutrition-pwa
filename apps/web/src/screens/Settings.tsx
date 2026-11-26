import { useState } from 'react';
import type { Goal, Profile } from '@form/contracts';
import { deriveCarbTargetG, todayInTimeZone, validatePlanTargets } from '@form/domain';
import { useForm } from '../context';
import { useAsync } from '../useAsync';
import { Card, PageHeader } from '../components/common';
import { csvEscape, downloadText, fmt, nullableNumber } from '../utils';

export function SettingsScreen() {
  const { repo, refresh, theme, setTheme, setAnnounce, timezone } = useForm();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newPlan, setNewPlan] = useState({ effectiveFrom: todayInTimeZone(timezone), kcal: '', proteinG: '', fatG: '', fiberG: '' });
  const [importText, setImportText] = useState('');
  const [legacyText, setLegacyText] = useState('');
  const [preview, setPreview] = useState<string>('');
  const state = useAsync(async () => {
    const [profile, goal, plans, counts, entries, preImportBackup] = await Promise.all([repo.getProfile(), repo.getCurrentGoal(), repo.listPlans(), repo.tableCounts(), repo.listFoodEntries(), repo.getLastPreImportBackup()]);
    return { profile, goal, plans, counts, entries, preImportBackup };
  }, []);
  if (state.loading) return <PageHeader kicker="FORM / SETTINGS" title="הגדרות ונתונים" subtitle="טוען נתונים…" />;
  if (state.error || !state.data) return <div className="notice danger" role="alert">{state.error ?? 'שגיאת טעינה'}</div>;
  const { profile, goal, plans, counts, entries, preImportBackup } = state.data;

  async function exportJson() {
    const bundle = await repo.exportBundle();
    downloadText(`FORM-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2));
    setNotice('קובץ גיבוי מלא נוצר');
  }

  function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    const rows: Array<Array<string | number>> = [['date','meal','label','quantity','unit','kcal','protein_g','carbs_g','fat_g','fiber_g','deleted']];
    for (const entry of entries) rows.push([entry.localDate, entry.mealType, entry.labelSnapshot, entry.quantity, entry.unit, entry.nutrientSnapshot.kcal ?? '', entry.nutrientSnapshot.proteinG ?? '', entry.nutrientSnapshot.carbG ?? '', entry.nutrientSnapshot.fatG ?? '', entry.nutrientSnapshot.fiberG ?? '', entry.deletedAt ? 1 : 0]);
    downloadText(`FORM-food-detail-${stamp}.csv`, rows.map((row) => row.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
    const byDate = new Map<string, typeof entries>();
    for (const entry of entries.filter((item) => item.deletedAt === null)) byDate.set(entry.localDate, [...(byDate.get(entry.localDate) ?? []), entry]);
    const summary: Array<Array<string | number>> = [['date','entries','kcal','protein_g','carbs_g','fat_g','fiber_g','unknown_kcal_entries']];
    for (const [date, dayEntries] of [...byDate.entries()].sort()) {
      const sum = (key: 'kcal' | 'proteinG' | 'carbG' | 'fatG' | 'fiberG') => dayEntries.reduce((acc, entry) => acc + (entry.nutrientSnapshot[key] ?? 0), 0);
      const unknownKcal = dayEntries.filter((entry) => entry.nutrientSnapshot.kcal === null).length;
      summary.push([date, dayEntries.length, `${sum('kcal')}${unknownKcal ? '+' : ''}`, sum('proteinG'), sum('carbG'), sum('fatG'), sum('fiberG'), unknownKcal]);
    }
    downloadText(`FORM-food-summary-${stamp}.csv`, summary.map((row) => row.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
    setNotice('נוצרו קובצי CSV מפורט ומסכם');
  }

  async function previewFile(kind: 'export' | 'legacy') {
    setError(''); setNotice(''); setPreview('');
    const text = kind === 'export' ? importText : legacyText;
    if (!text) return setError('יש לבחור קובץ תחילה');
    if (kind === 'export') {
      const result = await repo.previewImport(text);
      if (!result.valid) return setError(result.errors.join('\n'));
      setPreview(JSON.stringify({ counts: result.counts, duplicates: result.duplicates, bytes: result.bytes }, null, 2));
    } else {
      const result = await repo.previewLegacyImport(text);
      if (!result.valid) return setError(result.errors.join('\n'));
      setPreview(JSON.stringify(result.report, null, 2));
    }
  }

  async function applyImport(kind: 'export' | 'legacy', mode: 'merge-skip-duplicates' | 'replace-all') {
    setError(''); setNotice('');
    try {
      const text = kind === 'export' ? importText : legacyText;
      const result = kind === 'export' ? await repo.importBundle(text, mode) : await repo.importLegacy(text, mode);
      downloadText(`FORM-pre-import-backup-${Date.now()}.json`, JSON.stringify(result.backup, null, 2));
      refresh();
      setNotice('הייבוא הושלם. גיבוי קודם נשמר מקומית והורדה נוספת נוצרה.');
      setAnnounce('הייבוא הושלם');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'הייבוא נכשל');
    }
  }

  async function restorePreImportBackup() {
    setError(''); setNotice('');
    try {
      if (!preImportBackup) throw new Error('לא נמצא גיבוי קודם');
      await repo.importBundle(JSON.stringify(preImportBackup), 'replace-all');
      refresh();
      setNotice('שוחזר הגיבוי המקומי האחרון שלפני הייבוא');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'השחזור נכשל');
    }
  }

  async function createPlan() {
    setError(''); setNotice('');
    try {
      const kcal = nullableNumber(newPlan.kcal);
      const proteinG = nullableNumber(newPlan.proteinG);
      const fatG = nullableNumber(newPlan.fatG);
      const fiberG = nullableNumber(newPlan.fiberG);
      if (kcal === null || proteinG === null || fatG === null || fiberG === null) throw new Error('יש להזין ערכי תכנית תקינים');
      const carbG = deriveCarbTargetG(kcal, proteinG, fatG);
      const errors = validatePlanTargets({ kcal, proteinG, fatG, carbG });
      if (errors.length) throw new Error(errors.join('; '));
      await repo.createPlanRevision({ effectiveFrom: newPlan.effectiveFrom, kcal, proteinG, fatG, carbG, fiberG, steps: 8000, waterMl: 2500, sleepMinutesMin: 420, sleepMinutesMax: 540, strengthSessionsPerWeek: 4, reason: 'עריכה ידנית בהגדרות', policyVersion: 'form-plan-v1' });
      refresh();
      setNotice('נוצרה גרסת תכנית חדשה. רישומים קודמים לא השתנו.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'לא ניתן לשמור תכנית');
    }
  }

  async function clearAll() {
    if (!window.confirm('למחוק את כל הנתונים המקומיים? יש לייצא גיבוי לפני כן.')) return;
    if (!window.confirm('אישור סופי: כל היומן, המדידות והתכניות במכשיר יימחקו.')) return;
    await repo.clearLocalData();
    refresh();
    location.href = '/onboarding';
  }

  return (
    <div className="stack-lg">
      <PageHeader kicker="FORM / SETTINGS" title="הגדרות ונתונים" subtitle="תכנית, פרטיות, גיבוי ושחזור — בשליטת המשתמש." />
      {error ? <div className="notice danger" role="alert">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}
      <div className="desktop-two">
        <Card className="settings-section">
          <h2>תכנית ויעדים</h2>
          <p className="card-muted">פרופיל: {profile?.locale} · {profile?.timezone} · יעד {goal ? `${fmt(goal.targetKg, 1)} ק״ג` : '—'}</p>
          {profile && goal ? <ProfileGoalEditor profile={profile} goal={goal} onSaved={() => { refresh(); setNotice('הפרופיל והיעד עודכנו'); }} /> : null}
          <div className="plan-history">{plans.map((plan) => <div className="meal-row" key={plan.id}><div><div className="meal-row-title"><bdi className="num">{fmt(plan.kcal)} קל׳</bdi> החל מ־<bdi className="num">{plan.effectiveFrom}</bdi></div><div className="meal-row-meta">חלבון {fmt(plan.proteinG)} · פחמימות {fmt(plan.carbG, 1)} · שומן {fmt(plan.fatG)} · {plan.reason ?? 'ללא סיבה'}</div></div><span className="pill">גרסה קבועה</span></div>)}</div>
          <h3>גרסת תכנית חדשה</h3>
          <div className="inline-fields"><label className="field"><span>בתוקף מ</span><input className="input" type="date" value={newPlan.effectiveFrom} onChange={(e) => setNewPlan({ ...newPlan, effectiveFrom: e.target.value })} /></label><label className="field"><span>קלוריות</span><input className="input" inputMode="decimal" value={newPlan.kcal} onChange={(e) => setNewPlan({ ...newPlan, kcal: e.target.value })} /></label></div>
          <div className="inline-fields"><label className="field"><span>חלבון</span><input className="input" inputMode="decimal" value={newPlan.proteinG} onChange={(e) => setNewPlan({ ...newPlan, proteinG: e.target.value })} /></label><label className="field"><span>שומן</span><input className="input" inputMode="decimal" value={newPlan.fatG} onChange={(e) => setNewPlan({ ...newPlan, fatG: e.target.value })} /></label></div>
          <label className="field"><span>סיבים</span><input className="input" inputMode="decimal" value={newPlan.fiberG} onChange={(e) => setNewPlan({ ...newPlan, fiberG: e.target.value })} /></label>
          <button className="primary-button" type="button" onClick={() => void createPlan()}>יצירת גרסה חדשה</button>
        </Card>
        <div className="stack">
          <Card>
            <h2>פרטיות ומראה</h2>
            <p className="card-muted">מצב מקומי בלבד: הנתונים נשמרים בדפדפן זה ועלולים להימחק אם הדפדפן מפנה אחסון. אין סנכרון, חשבון, ברקוד, ספק חיצוני או הרשאות בריאות ב־P0.</p>
            <div className="button-row"><button className="secondary-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>מעבר ל{theme === 'dark' ? 'בהיר' : 'כהה'}</button><button className="secondary-button" type="button" onClick={() => void exportJson()}>ייצוא JSON מלא</button><button className="secondary-button" type="button" onClick={() => exportCsv()}>CSV מפורט+מסכם</button></div>
            <p className="card-muted">PWA: ההתקנה זמינה לאחר טעינה ראשונה ב־HTTPS/localhost דרך תפריט הדפדפן או “הוסף למסך הבית”. מצב לא מקוון נבדק בגרסת build בלבד.</p>
          </Card>
          <Card>
            <h2>ייבוא ושחזור</h2><p className="card-muted">גיבוי FORM מלא כולל גם אימונים. ייבוא גיבוי ישן ללא אימונים שומר על יומן האימונים הקיים.</p>
            <FilePicker label="קובץ FORM JSON" onText={setImportText} />
            <div className="button-row"><button className="secondary-button" type="button" onClick={() => void previewFile('export')}>בדיקת ייבוא</button><button className="primary-button" type="button" disabled={!importText} onClick={() => void applyImport('export', 'merge-skip-duplicates')}>מיזוג בטוח</button><button className="danger-button" type="button" disabled={!importText} onClick={() => void applyImport('export', 'replace-all')}>החלפה מלאה</button></div>
            {preImportBackup ? <p className="notice">קיים גיבוי מקומי אחרון מלפני ייבוא. <button className="secondary-button" type="button" onClick={() => void restorePreImportBackup()}>שחזור גיבוי זה</button></p> : null}
            <h3>ייבוא FORM 2.0</h3>
            <FilePicker label="קובץ גיבוי legacy" onText={setLegacyText} />
            <div className="button-row"><button className="secondary-button" type="button" onClick={() => void previewFile('legacy')}>בדיקת legacy</button><button className="primary-button" type="button" disabled={!legacyText} onClick={() => void applyImport('legacy', 'merge-skip-duplicates')}>ייבוא מוזג</button></div>
            {preview ? <pre className="import-preview">{preview}</pre> : null}
          </Card>
          <Card>
            <h2>מצב אחסון</h2>
            <pre className="import-preview">{JSON.stringify(counts, null, 2)}</pre>
            <button className="danger-button" type="button" onClick={() => void clearAll()}>מחיקת כל הנתונים המקומיים</button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProfileGoalEditor({ profile, goal, onSaved }: { profile: Profile; goal: Goal; onSaved: () => void }) {
  const { repo } = useForm();
  const [timezone, setTimezone] = useState(profile.timezone);
  const [unitPreference, setUnitPreference] = useState(profile.unitPreference);
  const [targetKg, setTargetKg] = useState(String(goal.targetKg));
  const [goalStatus, setGoalStatus] = useState(goal.status);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    const target = nullableNumber(targetKg);
    if (target === null || target < 35 || target > 350) return setError('משקל יעד חייב להיות בין 35 ל־350 ק״ג');
    await repo.updateProfile({ timezone, unitPreference });
    await repo.updateGoal({ targetKg: target, status: goalStatus });
    onSaved();
  }

  return (
    <div className="form-grid" style={{ marginBlockEnd: 16 }}>
      <h3>פרופיל ויעד</h3>
      <div className="inline-fields">
        <label className="field"><span>אזור זמן</span><select className="input" value={timezone} onChange={(event) => setTimezone(event.target.value)}><option value="Asia/Jerusalem">Asia/Jerusalem</option><option value="UTC">UTC</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option></select></label>
        <label className="field"><span>יחידות</span><select className="input" value={unitPreference} onChange={(event) => setUnitPreference(event.target.value as 'metric' | 'imperial')}><option value="metric">מטרי</option><option value="imperial">אימפריאלי (שמירת העדפה בלבד ב־P0)</option></select></label>
      </div>
      <div className="inline-fields">
        <label className="field"><span>משקל יעד ק״ג</span><input className="input" inputMode="decimal" value={targetKg} onChange={(event) => setTargetKg(event.target.value)} /></label>
        <label className="field"><span>סטטוס יעד</span><select className="input" value={goalStatus} onChange={(event) => setGoalStatus(event.target.value as typeof goal.status)}><option value="active">פעיל</option><option value="paused">מושהה</option><option value="completed">הושלם</option><option value="archived">בארכיון</option></select></label>
      </div>
      {error ? <div className="notice danger" role="alert">{error}</div> : null}
      <button className="secondary-button" type="button" onClick={() => void save()}>שמירת פרופיל ויעד</button>
    </div>
  );
}

function FilePicker({ label, onText }: { label: string; onText: (text: string) => void }) {
  return <label className="file-input field"><span>{label}</span><input type="file" accept="application/json,.json" onChange={(event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then(onText).catch(() => onText(''));
  }} /></label>;
}
