import { useState } from 'react';
import { Link } from 'react-router-dom';
import { workoutImportSchema, workoutSessionSchema, type WorkoutSession, type WorkoutExercise, type WorkoutSet } from '@form/contracts';
import { compareVolume, effectiveLoad, exerciseVolume, recordedPRs, setVolume, workoutSummary } from '@form/domain';
import { useForm } from '../context';
import { useAsync } from '../useAsync';
import { Card, PageHeader } from '../components/common';
import { downloadText, fmt, fmtSigned } from '../utils';

const phaseNames = {'pre-cut':'לפני חיטוב',cut:'חיטוב',maintenance:'תחזוקה',other:'אחר'} as const;
const setNames = {warmup:'חימום',working:'עבודה',drop:'דרופ-סט'} as const;
const newSet = (kind: WorkoutSet['kind']='working'): WorkoutSet => ({kind,segments:kind==='drop'?[{load:null,reps:null},{load:null,reps:null}]:[{load:null,reps:null}]});
const newExercise = (): WorkoutExercise => ({name:'',equipment:'',unit:'kg',multiplier:1,sets:[newSet()]});
const numberOrNull=(v:string)=>v.trim()===''?null:Number(v);
export function TrainingScreen() {
 const {repo,currentDate,refresh,setAnnounce}=useForm();
 const state=useAsync(()=>repo.listWorkouts(),[]);
 const [draft,setDraft]=useState<WorkoutSession|null>(null);
 const [incoming,setIncoming]=useState<WorkoutSession[]|null>(null);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [phase,setPhase]=useState<'all'|WorkoutSession['phase']>('all');
 const [openId,setOpenId]=useState<string|null>(null);
 const rows=(state.data??[]).slice().sort((a,b)=>b.localDate.localeCompare(a.localDate));
 const filtered=rows.filter(s=>phase==='all'||s.phase===phase);
 const latest=rows[0];
 const summary=latest?workoutSummary(latest):null;
 const prs=recordedPRs(rows);
 const cut=rows.find(s=>s.phase==='cut');
 const before=rows.find(s=>(s.phase==='pre-cut'||s.phase==='maintenance')&&s.localDate<(cut?.localDate??'')&&s.title.trim()===cut?.title.trim());
 const change=before&&cut?compareVolume(before,cut):null;
 function editExercise(index:number,fn:(e:WorkoutExercise)=>WorkoutExercise) {
  setDraft(d=>d?{...d,exercises:d.exercises.map((e,i)=>i===index?fn(e):e)}:d);
 }
 function editSet(ei:number,si:number,fn:(s:WorkoutSet)=>WorkoutSet) {
  editExercise(ei,e=>({...e,sets:e.sets.map((s,i)=>i===si?fn(s):s)}));
 }
 async function save(){
  if(!draft||busy)return;
  setBusy(true);setError('');setMessage('');
  try {
   const valid=workoutSessionSchema.parse(draft);
   await repo.saveWorkout(valid);
   setDraft(null);refresh();setAnnounce('האימון נשמר');setMessage('האימון נשמר במכשיר.');
  }catch(e){setError(e instanceof Error?e.message:'שמירה נכשלה');}finally{setBusy(false);}
 }
 async function loadFile(file:File|undefined){
  setIncoming(null);setError('');setMessage('');
  if(!file)return;
  try{if(file.size>20*1024*1024)throw Error('קובץ גדול מדי');const parsed=workoutImportSchema.parse(JSON.parse(await file.text()));setIncoming(parsed.sessions);}catch(e){setError(e instanceof Error?e.message:'קובץ לא תקין');}
 }
 async function merge(){
  if(!incoming||busy)return;
  setBusy(true);setError('');
  try{const count=await repo.mergeWorkouts(incoming);setIncoming(null);refresh();setMessage('נוספו '+String(count)+' אימונים. מזהים קיימים לא הוחלפו.');}catch(e){setError(e instanceof Error?e.message:'ייבוא נכשל');}finally{setBusy(false);}
 }
 async function remove(id:string){
  if(busy||!window.confirm('למחוק את האימון הזה? מומלץ לייצא גיבוי לפני המחיקה.'))return;
  setBusy(true);setError('');
  try{await repo.deleteWorkout(id);refresh();setMessage('האימון נמחק.');}catch(e){setError(e instanceof Error?e.message:'מחיקה נכשלה');}finally{setBusy(false);}
 }
 return <div className="stack-lg training-page">
  <PageHeader kicker="03 / STRENGTH" title="יומן אימונים" subtitle="כל סט בונה את הדרך. כוח, נפח עבודה ושיאים מתועדים."/>
  <Card className="history-entry"><div><p className="route-kicker">STRENGTH / HISTORY</p><h2>היסטוריה וניתוח ביצועים</h2><p className="card-muted">ייבוא ארכיון מלא, עוגני כוח וניתוח נתונים חלקיים.</p></div><Link className="primary-button" to="/history">פתח ניתוח היסטורי</Link></Card>
  {state.error?<div role="alert" className="notice danger">{state.error}</div>:null}
  {error?<div role="alert" className="notice danger">{error}</div>:null}
  {message?<div role="status" className="notice">{message}</div>:null}
  <Card className="training-hero">
   <div className="split"><div><p className="route-kicker">STRENGTH / LAST SESSION</p><h2>{latest?.title??'האימון הראשון שלך'}</h2><p className="card-muted">{latest?latest.localDate+' · '+phaseNames[latest.phase]:'התחילו לתעד או ייבאו יומן קיים.'}</p></div><button className="primary-button" type="button" disabled={busy||!!draft} onClick={()=>{setDraft({id:crypto.randomUUID(),localDate:currentDate,title:'',phase:'cut',notes:'',exercises:[newExercise()]});setError('');}}>+ אימון חדש</button></div>
   <div className="training-metrics"><div><span>נפח עבודה אחרון</span><strong><bdi className="num">{fmt(summary?.volume,1)}</bdi></strong><small>ק״ג × חזרות</small></div><div><span>סטי עבודה</span><strong className="num">{fmt(summary?.workingSets)}</strong><small>ללא חימום</small></div><div><span>אימונים מתועדים</span><strong className="num">{rows.length}</strong><small>במכשיר זה</small></div></div>
  </Card>
  {draft?<Card className="training-editor">
   <h2>{rows.some(s=>s.id===draft.id)?'עריכת אימון':'אימון חדש'}</h2>
   <div className="inline-fields"><label className="field"><span>תאריך</span><input className="input" type="date" value={draft.localDate} onChange={e=>setDraft({...draft,localDate:e.target.value})}/></label><label className="field"><span>פאזה</span><select className="input" value={draft.phase} onChange={e=>setDraft({...draft,phase:e.target.value as WorkoutSession['phase']})}>{Object.entries(phaseNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
   <label className="field"><span>שם האימון (למשל פלג גוף עליון)</span><input className="input" maxLength={160} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   {draft.exercises.map((ex,ei)=><section key={ei} className="training-exercise">
    <div className="split"><h3>תרגיל {ei+1}</h3><button className="secondary-button" type="button" disabled={draft.exercises.length===1} onClick={()=>setDraft({...draft,exercises:draft.exercises.filter((_,i)=>i!==ei)})}>הסר תרגיל</button></div>
    <label className="field"><span>שם התרגיל / זווית / אחיזה</span><input className="input" value={ex.name} maxLength={160} onChange={e=>editExercise(ei,x=>({...x,name:e.target.value}))}/></label>
    <label className="field"><span>ציוד או זיהוי מכשיר (להשוואת שיאים)</span><input className="input" value={ex.equipment} maxLength={120} onChange={e=>editExercise(ei,x=>({...x,equipment:e.target.value}))}/></label>
    <div className="inline-fields"><label className="field"><span>יחידה</span><select className="input" value={ex.unit} onChange={e=>editExercise(ei,x=>({...x,unit:e.target.value as 'kg'|'lb'}))}><option value="kg">ק״ג</option><option value="lb">lbs</option></select></label><label className="field"><span>תצורת עומס</span><select className="input" value={ex.multiplier} onChange={e=>editExercise(ei,x=>({...x,multiplier:Number(e.target.value) as 1|2}))}><option value={1}>משקל כולל ×1</option><option value={2}>בכל יד/צד ×2</option></select></label></div>
    {ex.sets.map((set,si)=><div className="training-set" key={si}>
      <div className="split"><strong>סט {si+1}</strong><button className="ghost-button" type="button" disabled={ex.sets.length===1} onClick={()=>editExercise(ei,x=>({...x,sets:x.sets.filter((_,i)=>i!==si)}))}>הסר סט</button></div>
      <label className="field"><span>סוג סט</span><select className="input" value={set.kind} onChange={e=>{const kind=e.target.value as WorkoutSet['kind'];editSet(ei,si,x=>({...x,kind,segments:kind==='drop'?x.segments.length>=2?x.segments:[...x.segments,{load:null,reps:null}]:x.segments.slice(0,1)}));}}>{Object.entries(setNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      {set.segments.map((segment,pi)=><div className="inline-fields" key={pi}><label className="field"><span>{set.kind==='drop'?'מקטע '+String(pi+1)+' · ':''}משקל ({ex.unit})</span><input className="input" type="number" min="0" max="5000" step="any" value={segment.load??''} onChange={e=>editSet(ei,si,x=>({...x,segments:x.segments.map((p,i)=>i===pi?{...p,load:numberOrNull(e.target.value)}:p)}))}/></label><label className="field"><span>חזרות (0.5 אפשרי)</span><input className="input" type="number" min=".5" max="300" step=".5" value={segment.reps??''} onChange={e=>editSet(ei,si,x=>({...x,segments:x.segments.map((p,i)=>i===pi?{...p,reps:numberOrNull(e.target.value)}:p)}))}/></label></div>)}
      {set.kind==='drop'?<div className="button-row"><button className="secondary-button" type="button" disabled={set.segments.length>=10} onClick={()=>editSet(ei,si,x=>({...x,segments:[...x.segments,{load:null,reps:null}]}))}>+ מקטע ירידה</button><button className="ghost-button" type="button" disabled={set.segments.length<=2} onClick={()=>editSet(ei,si,x=>({...x,segments:x.segments.slice(0,-1)}))}>הסר מקטע אחרון</button></div>:null}
      <p className="card-muted">{set.kind==='warmup'?'לא נספר בנפח':set.segments.some(p=>p.load===null||p.reps===null)?'יש להשלים משקל וחזרות':fmt(setVolume(set,ex),1)+' ק״ג × חזרות'}</p>
    </div>)}
    <button className="secondary-button" type="button" disabled={ex.sets.length>=100} onClick={()=>editExercise(ei,x=>({...x,sets:[...x.sets,newSet()]}))}>+ סט</button>
   </section>)}
   <button className="secondary-button" type="button" disabled={draft.exercises.length>=60} onClick={()=>setDraft({...draft,exercises:[...draft.exercises,newExercise()]})}>+ תרגיל</button>
   <label className="field"><span>הערות (טכניקה, עייפות, עוגני כוח)</span><textarea className="input" maxLength={5000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
   <div className="button-row"><button type="button" className="primary-button" disabled={busy} onClick={()=>void save()}>שמור אימון</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{if(window.confirm('לבטל את העריכה שלא נשמרה?'))setDraft(null);}}>ביטול</button></div>
  </Card>:null}
  <div className="desktop-two">
   <Card><h2>השוואת פאזות</h2><p className="card-muted">השוואה של האימון האחרון בחיטוב לאימון קודם בעל אותו שם. לא מרשם לשינוי עומס.</p>{before&&cut?<><div className="phase-compare">{[before,cut].map(x=><div key={x.id}><span>{phaseNames[x.phase]} · {x.localDate}</span><strong className="num">{fmt(workoutSummary(x).volume,1)}</strong><progress aria-label={phaseNames[x.phase]+' נפח יחסי'} max={Math.max(1,workoutSummary(before).volume,workoutSummary(cut).volume)} value={workoutSummary(x).volume}/></div>)}</div><p>שינוי בנפח: <bdi className="num">{fmtSigned(change,2)}%</bdi></p></>:<p className="card-muted">נדרשים שני אימונים באותו שם ובפאזות שונות.</p>}<p className="card-muted">נפח מתאר עומס חיצוני נומינלי, לא עבודה מכנית או גירוי שריר מדויק. שינוי תרגילים/מכשיר מגביל השוואה.</p></Card>
   <Card><h2>שיאים מתועדים</h2><p className="card-muted">המשקל הגבוה ביותר, ואז מספר החזרות באותו עומס; לפי תרגיל ותצורת ציוד. לא הערכת 1RM.</p>{prs.length?prs.map(p=><div key={p.key} className="meal-row"><div><strong>{p.name}</strong><div className="card-muted">{p.equipment} · {p.date} · נפח שיא {fmt(p.peakVolume,1)}</div></div><bdi className="num">{fmt(p.rawLoad,1)} {p.unit}{p.multiplier===2?' ×2':''} × {fmt(p.reps,1)}</bdi></div>):<p className="card-muted">אין עדיין שיאים.</p>}</Card>
  </div>
  <Card><div className="split"><h2>היסטוריית אימונים</h2><label className="field"><span className="sr-only">סינון פאזה</span><select className="input" value={phase} onChange={e=>setPhase(e.target.value as typeof phase)}><option value="all">כל הפאזות</option>{Object.entries(phaseNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
  {state.loading?<p role="status">טוען אימונים…</p>:filtered.length?filtered.map(session=>{const v=workoutSummary(session);return <article className="training-session" key={session.id}><button className="training-session-button" type="button" aria-expanded={openId===session.id} onClick={()=>setOpenId(openId===session.id?null:session.id)}><span><strong>{session.title}</strong><small>{session.localDate} · {phaseNames[session.phase]}</small></span><span><strong className="num">{fmt(v.volume,1)}</strong><small>{v.workingSets} סטים · {v.drops+v.doubleDrops+v.extendedDrops} דרופ</small></span></button>
   {openId===session.id?<div className="stack">
    {v.countMismatch||v.volumeMismatch?<p className="notice warn">פער מול הסיכום המקורי: דווח {session.reported?.workingSets??'—'} סטים / {fmt(session.reported?.volume,1)} ק״ג × חזרות. חושב מהסטים: {v.workingSets} / {fmt(v.volume,1)}. לא הושלמו נתונים חסרים.</p>:null}
    {session.notes?<p className="card-muted">{session.notes}</p>:null}{session.reported?.notes?<p className="card-muted">מקור: {session.reported.notes}</p>:null}
    {session.exercises.map((ex,ei)=><div className="training-exercise" key={ei}><div className="split"><h3>{ex.name}</h3><bdi className="num">{fmt(exerciseVolume(ex),1)}</bdi></div><small>{ex.equipment} · {ex.unit} {ex.multiplier===2?'בכל יד/צד':'כולל'}</small>{ex.sets.map((set,si)=><div className="meal-row" key={si}><div><strong>{setNames[set.kind]} {si+1}{set.kind==='drop'?' · '+String(set.segments.length)+' מקטעים':''}</strong>{set.segments.map((p,pi)=><div className="card-muted" key={pi}><bdi>{p.load===null?'משקל לא ידוע':fmt(p.load,1)+' '+ex.unit} × {fmt(p.reps,1)}{p.load!==null?' · '+fmt(effectiveLoad(p.load,ex.unit,ex.multiplier),2)+' ק״ג אפקטיבי':''}</bdi></div>)}{set.note?<small>{set.note}</small>:null}</div><bdi className="num">{set.kind==='warmup'?'מוחרג':fmt(setVolume(set,ex),1)}</bdi></div>)}</div>)}
    <div className="button-row"><button className="secondary-button" type="button" disabled={!!draft||busy} onClick={()=>{setDraft(structuredClone(session));window.scrollTo({top:0,behavior:'auto'});}}>ערוך</button><button className="danger-button" type="button" disabled={busy||!!draft} onClick={()=>void remove(session.id)}>מחק</button></div>
   </div>:null}</article>}):<p className="card-muted">אין אימונים בפילטר הנבחר.</p>}
  </Card>
  <Card><h2>ייבוא וגיבוי אימונים</h2><p className="card-muted">קובץ אימונים NIVNE / FORM JSON · הייבוא מקומי בלבד. גיבוי מלא נמצא גם בהגדרות.</p><label className="field"><span>בחר קובץ יומן</span><input className="input" type="file" accept=".json,application/json" onChange={e=>{void loadFile(e.target.files?.[0]);e.target.value='';}}/></label>{incoming?<div className="notice"><p>נמצאו {incoming.length} אימונים. {incoming.filter(x=>{const s=workoutSummary(x);return s.countMismatch||s.volumeMismatch;}).length} עם פער בסיכום המקורי.</p>{incoming.map(s=><p key={s.id}>{s.localDate} · {s.title} · {fmt(workoutSummary(s).volume,1)}</p>)}<button className="primary-button" type="button" disabled={busy} onClick={()=>void merge()}>אשר ייבוא מקומי</button><button className="secondary-button" type="button" onClick={()=>setIncoming(null)}>ביטול</button></div>:null}<div className="button-row"><button className="secondary-button" type="button" disabled={state.loading||!!state.error} onClick={()=>downloadText('form-workouts.json',JSON.stringify({format:'form-workouts',schemaVersion:1,sessions:rows},null,2))}>ייצוא אימונים</button><Link className="secondary-button" to="/settings">גיבוי מלא</Link><Link className="secondary-button" to="/progress">התקדמות גוף</Link></div></Card>
  <Card><h2>כללי החישוב</h2><p>נפח = Σ (משקל × מקדם ציוד × חזרות). פאונד × 0.45359237; זוג משקולות/צדדים × 2 כשהמשקל נרשם לכל יד/צד. כל מקטע דרופ-סט נספר בנפח, אך הקבוצה היא סט עבודה אחד. חצי חזרה מתועדת כ־0.5; חימום מוחרג. אין חישוב קלוריות שנשרפו או שינוי אוטומטי של מטרות תזונה.</p></Card>
 </div>;
}
