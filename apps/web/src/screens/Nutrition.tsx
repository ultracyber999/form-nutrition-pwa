import type { FoodEntry, FoodVersion, MealTemplate, NutrientProfile, Recipe } from '@form/contracts';
import { calculateConsumed, sumEntryNutrients, todayInTimeZone } from '@form/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { newUuid } from '@form/data';
import { useForm } from '../context';
import { useAsync } from '../useAsync';
import { Card, DateNavigator, EmptyState, MacroBar, PageHeader } from '../components/common';
import { fmt, mealLabels, nullableNumber, nutrientText } from '../utils';

type Mode = 'search' | 'manual' | 'templates' | 'recipes' | 'custom-food';

export function NutritionScreen() {
  const { repo, refresh, setAnnounce } = useForm();
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = params.date ?? todayInTimeZone('Asia/Jerusalem');
  const [addOpen, setAddOpen] = useState(searchParams.get('add') === '1');
  const [deletedUndo, setDeletedUndo] = useState<FoodEntry | null>(null);
  const [error, setError] = useState('');

  const state = useAsync(async () => {
    const [entries, diary, foods, templates, recipes, allEntries] = await Promise.all([
      repo.entriesForDate(date),
      repo.diaryDay(date),
      repo.listFoods(),
      repo.listTemplates(),
      repo.listRecipes(),
      repo.listFoodEntries()
    ]);
    return { entries, diary, foods, templates, recipes, allEntries };
  }, [date]);

  if (state.loading) return <PageHeader kicker="FORM / NUTRITION" title="יומן התזונה" subtitle="טוען נתונים…" />;
  if (state.error || !state.data) return <div className="notice danger" role="alert">{state.error ?? 'שגיאת טעינה'}</div>;
  const { entries, diary, foods, templates, recipes, allEntries } = state.data;
  const activeEntries = entries.filter((entry) => entry.deletedAt === null);
  const totals = sumEntryNutrients(entries);
  const complete = diary?.completionState === 'complete' && diary.completionRevision === diary.foodRevision;
  const recents = [...new Map(allEntries.filter((entry) => entry.deletedAt === null && entry.foodVersionId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((entry) => [entry.foodVersionId, entry.foodVersionId])).values()].slice(0, 6).map((id) => foods.find((food) => food.id === id)).filter((food): food is FoodVersion => Boolean(food));

  async function run(action: () => Promise<unknown>, message: string) {
    setError('');
    try {
      await action();
      refresh();
      setAnnounce(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'הפעולה נכשלה');
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader kicker="FORM / NUTRITION" title="יומן התזונה" subtitle="רישום מהיר, ידידותי וחוזר — בלי ניחושים ובלי אפסים מומצאים." />
      <DateNavigator date={date} onChange={(next) => void navigate(`/nutrition/${next}`)} />
      <Card className="hero-card">
        <div className="split"><h2>סיכום היום</h2><span className={`pill ${complete ? 'good' : activeEntries.length ? 'warn' : ''}`}>{complete ? 'יום הושלם' : activeEntries.length ? 'יום חלקי' : 'אין רישום'}</span></div>
        <div className="macro-list">
          <MacroBar label="קלוריות" consumed={totals.totals.kcal} target={null} className="accent" unit="קל׳" />
          <MacroBar label="חלבון" consumed={totals.totals.proteinG} target={null} className="protein" />
          <MacroBar label="פחמימות" consumed={totals.totals.carbG} target={null} className="carb" />
          <MacroBar label="שומן" consumed={totals.totals.fatG} target={null} className="fat" />
        </div>
        {Object.values(totals.unknownCounts).some(Boolean) ? <p className="notice warn">חלק מהערכים אינם ידועים. מוצג סיכום חלקי.</p> : null}
        <div className="button-row" style={{ marginBlockStart: 14 }}>
          <button className="primary-button" type="button" onClick={() => { setAddOpen(true); setSearchParams({ add: '1' }); }}>+ הוספת אוכל</button>
          <button className="secondary-button" type="button" disabled={!activeEntries.length || complete} onClick={() => void run(() => repo.markDayComplete(date), 'היום אושר כמלא')}>{complete ? 'היום אושר' : 'אישור השלמת היום'}</button>
        </div>
        {!activeEntries.length ? <p className="card-muted">לא ניתן לאשר יום ריק כמלא; יום ריק אינו צום מומצא.</p> : null}
      </Card>
      {deletedUndo ? <div className="notice"><span>הרשומה נמחקה. אפשר לבטל. </span><button className="secondary-button" type="button" onClick={() => void run(async () => { await repo.undoDeleteFoodEntry(deletedUndo.id); setDeletedUndo(null); }, 'המחיקה בוטלה')}>ביטול מחיקה</button></div> : null}
      {error ? <div className="notice danger" role="alert">{error}</div> : null}
      <div className="desktop-two">
        <Card>
          <h2>ארוחות</h2>
          {activeEntries.length ? activeEntries.map((entry) => <EntryRow key={entry.id} entry={entry} onSave={(patch) => void run(() => repo.updateFoodEntry(entry.id, patch), 'הרשומה עודכנה')} onDelete={() => void run(async () => { await repo.deleteFoodEntry(entry.id); setDeletedUndo(entry); }, 'הרשומה נמחקה')} />) : <EmptyState title="עדיין אין רישום תזונה ליום זה" />}
        </Card>
        <div className="stack">
          <Card>
            <h2>מזונות אחרונים</h2>
            {recents.length ? recents.map((food) => <button key={food.id} className="result-option" type="button" onClick={() => { setAddOpen(true); setSearchParams({ add: '1', food: food.id }); }}><span>{food.name}</span><bdi className="num">{fmt(food.nutrients.kcal)} קל׳/100ג׳</bdi></button>) : <p className="card-muted">מזונות שיירשמו יופיעו כאן לחזרה מהירה.</p>}
          </Card>
          <Card>
            <h2>ארוחות שמורות</h2>
            {templates.length ? templates.map((template) => <div className="meal-row" key={template.id}><div><div className="meal-row-title">{template.name}</div><div className="meal-row-meta">{template.items.length} רכיבים</div></div><button className="secondary-button" type="button" onClick={() => void run(() => repo.addTemplateToDiary(template.id, date, 'other'), 'הארוחה נוספה ליומן')}>הוספה</button></div>) : <p className="card-muted">אפשר לשמור ארוחה מרשומות היום לאחר הוספת מזון.</p>}
            {activeEntries.length ? <SaveTemplate entries={activeEntries} onSave={(name) => void run(() => repo.saveTemplateFromEntries(name, activeEntries.map((entry) => entry.id)), 'הארוחה נשמרה')} /> : null}
          </Card>
          <Card>
            <h2>שמירת מתכון מהיום</h2>
            {activeEntries.some((entry) => entry.basis === 'mass-grams') ? <SaveRecipe entries={activeEntries} onSave={(name, yieldG) => void run(async () => {
              const ingredients = activeEntries.filter((entry) => entry.basis === 'mass-grams').map((entry, sortOrder) => ({
                id: newUuid(),
                foodVersionId: entry.foodVersionId,
                labelSnapshot: entry.labelSnapshot,
                quantityG: entry.quantity,
                nutrientSnapshotPer100g: {
                  kcal: entry.nutrientSnapshot.kcal === null ? null : entry.nutrientSnapshot.kcal * 100 / entry.quantity,
                  proteinG: entry.nutrientSnapshot.proteinG === null ? null : entry.nutrientSnapshot.proteinG * 100 / entry.quantity,
                  carbG: entry.nutrientSnapshot.carbG === null ? null : entry.nutrientSnapshot.carbG * 100 / entry.quantity,
                  fatG: entry.nutrientSnapshot.fatG === null ? null : entry.nutrientSnapshot.fatG * 100 / entry.quantity,
                  fiberG: entry.nutrientSnapshot.fiberG === null ? null : entry.nutrientSnapshot.fiberG * 100 / entry.quantity
                },
                sortOrder
              }));
              await repo.saveRecipe({ name, ingredients, yieldG, servingCount: null });
            }, 'המתכון נשמר')} /> : <p className="card-muted">מתכון ניתן לשמור לאחר רישום רכיבים בגרמים.</p>}
          </Card>
        </div>
      </div>
      {addOpen ? <QuickAddDialog foods={foods} priorityFoods={recents} initialFoodId={searchParams.get('food')} templates={templates} recipes={recipes} date={date} onClose={() => { setAddOpen(false); setSearchParams({}); }} onDone={(message) => { setAddOpen(false); setSearchParams({}); refresh(); setAnnounce(message); }} /> : null}
    </div>
  );
}

function EntryRow({ entry, onSave, onDelete }: { entry: FoodEntry; onSave: (patch: { quantity?: number; mealType?: FoodEntry['mealType'] }) => void; onDelete: () => void }) {
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [mealType, setMealType] = useState(entry.mealType);
  const dirty = nullableNumber(quantity) !== entry.quantity || mealType !== entry.mealType;
  return (
    <div className="meal-row">
      <div>
        <div className="meal-row-title">{entry.labelSnapshot}</div>
        <div className="meal-row-meta">{entry.source === 'manual' ? 'הערכה ידנית' : entry.source} · {nutrientText(entry.nutrientSnapshot)}</div>
        <div className="inline-fields" style={{ marginBlockStart: 8 }}>
          <label className="field"><span className="sr-only">כמות</span><input className="input" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label={`כמות של ${entry.labelSnapshot}`} /></label>
          <label className="field"><span className="sr-only">ארוחה</span><select className="input" value={mealType} onChange={(event) => setMealType(event.target.value as FoodEntry['mealType'])} aria-label={`ארוחה של ${entry.labelSnapshot}`}>{Object.entries(mealLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </div>
      <div className="meal-row-actions">
        <div className="meal-kcal num">{fmt(entry.nutrientSnapshot.kcal)} קל׳</div>
        <button className="secondary-button" type="button" disabled={!dirty} onClick={() => onSave({ quantity: nullableNumber(quantity) ?? entry.quantity, mealType })}>שמירה</button>
        <button className="danger-button" type="button" onClick={onDelete}>מחיקה</button>
      </div>
    </div>
  );
}

function SaveTemplate({ entries, onSave }: { entries: FoodEntry[]; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="inline-fields" style={{ marginBlockStart: 10 }}>
      <label className="field"><span className="sr-only">שם ארוחה שמורה</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="שם לשמירת ארוחה" /></label>
      <button className="secondary-button" type="button" disabled={!name.trim() || !entries.length} onClick={() => onSave(name)}>שמירת ארוחה</button>
    </div>
  );
}

function SaveRecipe({ entries, onSave }: { entries: FoodEntry[]; onSave: (name: string, yieldG: number) => void }) {
  const totalG = entries.filter((entry) => entry.basis === 'mass-grams').reduce((sum, entry) => sum + entry.quantity, 0);
  const [name, setName] = useState('');
  const [yieldG, setYieldG] = useState(String(Math.round(totalG)));
  const parsedYield = nullableNumber(yieldG);
  return (
    <div className="form-grid">
      <div className="inline-fields">
        <label className="field"><span className="sr-only">שם מתכון</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="שם מתכון" /></label>
        <label className="field"><span className="sr-only">משקל מוכן סופי בגרם</span><input className="input" inputMode="decimal" value={yieldG} onChange={(event) => setYieldG(event.target.value)} placeholder="משקל מוכן סופי בגרם" /></label>
      </div>
      <p className="card-muted">משקל התשואה קובע חלוקת ערכים למנה; אין הנחת איבוד בבישול אם לא מוזן משקל סופי בפועל.</p>
      <button className="secondary-button" type="button" disabled={!name.trim() || parsedYield === null || parsedYield <= 0} onClick={() => onSave(name, parsedYield ?? totalG)}>שמירת מתכון</button>
    </div>
  );
}

function QuickAddDialog({ foods, priorityFoods = [], initialFoodId = null, templates, recipes, date, onClose, onDone }: { foods: FoodVersion[]; priorityFoods?: FoodVersion[]; initialFoodId?: string | null; templates: MealTemplate[]; recipes: Recipe[]; date: string; onClose: () => void; onDone: (message: string) => void }) {
  const { repo } = useForm();
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialFoodId);
  const [quantity, setQuantity] = useState('100');
  const [mealType, setMealType] = useState<FoodEntry['mealType']>('lunch');
  const [manualName, setManualName] = useState('');
  const [manualValues, setManualValues] = useState<Record<string, string>>({ kcal: '', proteinG: '', carbG: '', fatG: '', fiberG: '' });
  const [customName, setCustomName] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({ kcal: '', proteinG: '', carbG: '', fatG: '', fiberG: '' });
  const [portion, setPortion] = useState('100');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (initialFoodId) setSelectedId(initialFoodId);
  }, [initialFoodId]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable.at(0);
      const last = focusable.at(-1) ?? first;
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  const normalize = (value: string) => value.toLocaleLowerCase('he-IL').replace(/[׳'"’`.,()\-\s]+/g, '');
  const results = useMemo(() => {
    const needle = normalize(query);
    if (!needle) {
      const priorityIds = new Set(priorityFoods.map((food) => food.id));
      return [...priorityFoods, ...foods.filter((food) => !priorityIds.has(food.id))].slice(0, 12);
    }
    return foods.filter((food) => normalize(`${food.name}${food.aliases.join(' ')}`).includes(needle)).slice(0, 12);
  }, [foods, priorityFoods, query]);
  const selected = foods.find((food) => food.id === selectedId) ?? null;
  const qty = nullableNumber(quantity);
  const preview = selected && qty !== null && qty > 0 ? calculateConsumed(selected, qty, 'mass-grams') : null;

  async function execute(action: () => Promise<unknown>, message: string) {
    setError('');
    setSaving(true);
    try {
      await action();
      onDone(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'לא ניתן לשמור');
    } finally {
      setSaving(false);
    }
  }

  function nutrientInput(record: Record<string, string>): NutrientProfile {
    return {
      kcal: nullableNumber(record.kcal ?? ''),
      proteinG: nullableNumber(record.proteinG ?? ''),
      carbG: nullableNumber(record.carbG ?? ''),
      fatG: nullableNumber(record.fatG ?? ''),
      fiberG: nullableNumber(record.fiberG ?? '')
    };
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
        <header><h2 id="quick-add-title">הוספת מזון</h2><button className="icon-button" type="button" aria-label="סגירה" onClick={onClose}>×</button></header>
        <div className="segmented" role="group" aria-label="אופן הוספה">
          <button type="button" aria-pressed={mode === 'search'} onClick={() => setMode('search')}>חיפוש</button>
          <button type="button" aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>ידני</button>
          <button type="button" aria-pressed={mode === 'templates'} onClick={() => setMode('templates')}>שמורים</button>
        </div>
        <div className="button-row" style={{ marginBlock: 10 }}>
          <button className="ghost-button" type="button" aria-pressed={mode === 'recipes'} onClick={() => setMode('recipes')}>מתכונים</button>
          <button className="ghost-button" type="button" aria-pressed={mode === 'custom-food'} onClick={() => setMode('custom-food')}>מזון מותאם</button>
        </div>
        {mode === 'search' ? (
          <div className="form-grid">
            <label className="field"><span>חיפוש במאגר המקומי</span><input autoFocus className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חזה עוף, אורז, יוגורט" /></label>
            <div className="result-list">{results.map((food) => <button key={food.id} className="result-option" type="button" aria-pressed={selectedId === food.id} onClick={() => setSelectedId(food.id)}><span>{food.name}<small className="card-muted" style={{ display: 'block' }}>{food.preparationState} · לפי 100 ג׳</small></span><bdi className="num">{fmt(food.nutrients.kcal)} קל׳</bdi></button>)}</div>
            {!results.length ? <div className="empty-state">לא נמצא מזון. ניתן להזין ערכים ידנית או לשמור מזון מותאם.</div> : null}
            <div className="inline-fields">
              <label className="field"><span>כמות (גרם)</span><input className="input" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
              <label className="field"><span>ארוחה</span><select className="input" value={mealType} onChange={(event) => setMealType(event.target.value as FoodEntry['mealType'])}>{Object.entries(mealLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <div className="preview-box">{preview ? <><strong className="num">{fmt(preview.kcal, 1)} קל׳</strong><span>חלבון <bdi className="num">{fmt(preview.proteinG, 1)} ג׳</bdi> · פחמימות <bdi className="num">{fmt(preview.carbG, 1)} ג׳</bdi> · שומן <bdi className="num">{fmt(preview.fatG, 1)} ג׳</bdi></span><small>ערכים מחושבים לפי 100 ג׳ במצב ההכנה המוצג.</small></> : <span>בחר מזון והזן כמות להצגת ערכים.</span>}</div>
            <button className="primary-button" type="button" disabled={!selected || !preview || saving} onClick={() => void execute(() => repo.addFoodEntry({ localDate: date, mealType, foodVersionId: selected?.id ?? '', quantity: qty ?? 0, unit: 'g' }), 'המזון נוסף ליומן')}>הוספה ליומן</button>
          </div>
        ) : null}
        {mode === 'manual' ? (
          <div className="form-grid">
            <label className="field"><span>שם הארוחה או ההערכה</span><input autoFocus className="input" value={manualName} onChange={(event) => setManualName(event.target.value)} /></label>
            <NutrientInputs values={manualValues} setValues={setManualValues} />
            <label className="field"><span>ארוחה</span><select className="input" value={mealType} onChange={(event) => setMealType(event.target.value as FoodEntry['mealType'])}>{Object.entries(mealLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <p className="card-muted">ערכים ידניים נרשמים כסך הנצרך בפועל. הם לא מוכפלים בגרמים, ושדות ריקים נשארים לא ידועים.</p>
            <button className="primary-button" type="button" disabled={!manualName.trim() || nullableNumber(manualValues.kcal ?? '') === null || saving} onClick={() => void execute(() => repo.addManualEntry({ localDate: date, mealType, label: manualName, nutrients: nutrientInput(manualValues) }), 'ההערכה נוספה ליומן')}>הוספת הערכה</button>
          </div>
        ) : null}
        {mode === 'templates' ? <div className="result-list">{templates.map((template) => <button className="result-option" key={template.id} type="button" onClick={() => void execute(() => repo.addTemplateToDiary(template.id, date, mealType), 'הארוחה השמורה נוספה')}><span>{template.name}</span><small>{template.items.length} רכיבים</small></button>)}{!templates.length ? <div className="empty-state">אין עדיין ארוחות שמורות.</div> : null}</div> : null}
        {mode === 'recipes' ? (
          <div className="form-grid">
            <label className="field"><span>מנה במנות או גרם לפי המתכון</span><input className="input" inputMode="decimal" value={portion} onChange={(event) => setPortion(event.target.value)} /></label>
            <div className="result-list">{recipes.map((recipe) => <button className="result-option" key={recipe.id} type="button" onClick={() => void execute(() => repo.addRecipePortionToDiary(recipe.id, date, mealType, recipe.yieldG !== null ? { grams: nullableNumber(portion) ?? 100 } : { servings: nullableNumber(portion) ?? 1 }), 'מנה מהמתכון נוספה')}><span>{recipe.name}</span><small>{recipe.ingredients.length} רכיבים</small></button>)}{!recipes.length ? <div className="empty-state">אין עדיין מתכונים שמורים. אפשר לשמור מתכון מרשומות היום במסך היומן.</div> : null}</div>
          </div>
        ) : null}
        {mode === 'custom-food' ? (
          <div className="form-grid">
            <label className="field"><span>שם מזון מותאם</span><input className="input" value={customName} onChange={(event) => setCustomName(event.target.value)} /></label>
            <NutrientInputs values={customValues} setValues={setCustomValues} />
            <p className="card-muted">הערכים נשמרים לפי 100 גרם כגרסת מזון בלתי משתנה. רישומים קודמים לא ישתנו.</p>
            <button className="primary-button" type="button" disabled={!customName.trim() || nullableNumber(customValues.kcal ?? '') === null || saving} onClick={() => void execute(async () => {
              const nutrients = nutrientInput(customValues);
              await repo.saveCustomFood({ name: customName, preparationState: 'unknown', basis: 'per-100g', nutrients });
            }, 'המזון המותאם נשמר')}>שמירת מזון מותאם</button>
          </div>
        ) : null}
        {error ? <div className="notice danger" role="alert">{error}</div> : null}
      </section>
    </div>
  );
}

function NutrientInputs({ values, setValues }: { values: Record<string, string>; setValues: (values: Record<string, string>) => void }) {
  const fields: Array<[keyof NutrientProfile, string]> = [['kcal', 'קלוריות'], ['proteinG', 'חלבון ג׳'], ['carbG', 'פחמימות ג׳'], ['fatG', 'שומן ג׳'], ['fiberG', 'סיבים ג׳']];
  return <div className="grid grid-2">{fields.map(([key, label]) => <label className="field" key={key}><span>{label}</span><input className="input" inputMode="decimal" value={values[key] ?? ''} onChange={(event) => setValues({ ...values, [key]: event.target.value })} /></label>)}</div>;
}
