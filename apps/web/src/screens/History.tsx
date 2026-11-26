
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {historyArchiveSchema,personalSetupSchema,type HistoryArchive,type LocalIdentity} from '@form/contracts';
import {archiveInsights,archiveSegmentLoad} from '@form/domain';
import {useForm} from '../context';
import {useAsync} from '../useAsync';
import {Card,PageHeader} from '../components/common';
import {downloadText,fmt} from '../utils';
export function HistoryScreen(){
 const {repo,refresh}=useForm();
 const state=useAsync(async()=>({archive:await repo.getHistoryArchive(),native:await repo.listWorkouts(),identity:await repo.getLocalIdentity()}),[]);
 const [pending,setPending]=useState<{archive:HistoryArchive;identity?:LocalIdentity}|null>(null);
 const [error,setError]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const [selected,setSelected]=useState('');const [open,setOpen]=useState('');
 const archive=state.data?.archive;
 const analysis=archive?archiveInsights(archive):null;
 const group=analysis?.groups.find(g=>g.key===selected)??analysis?.groups[0];
 const best=group?.points.slice().sort((a,b)=>b.load-a.load||b.reps-a.reps)[0];
 const dates=new Set(archive?.sessions.map(s=>s.localDate)??[]);
 const overlapping=state.data?.native.filter(s=>dates.has(s.localDate)).length??0;
 async function load(file:File|undefined){
  setPending(null);setError('');setMessage('');if(!file)return;
  try{if(file.size>10*1024*1024)throw Error('קובץ גדול מדי');const raw:unknown=JSON.parse(await file.text());const setup=personalSetupSchema.safeParse(raw);if(setup.success)setPending({archive:setup.data.archive,identity:setup.data.identity});else setPending({archive:historyArchiveSchema.parse(raw)});}
  catch(e){setError(e instanceof Error?e.message:'קובץ לא תקין');}
 }
 async function save(){
  if(!pending||busy||state.loading||state.error)return;
  if(archive&&!window.confirm('הייבוא יחליף את הארכיון ההיסטורי בלבד. האימונים הרגילים נשמרים. להמשיך?'))return;
  if(pending.identity&&state.data?.identity&&!window.confirm('הקובץ כולל פרופיל אישי שיחליף את הפרופיל המקומי. להמשיך?'))return;
  setBusy(true);setError('');
  try{await repo.saveHistoryArchive(pending.archive,pending.identity);setPending(null);refresh();setMessage('הארכיון נשמר מקומית.');}catch(e){setError(e instanceof Error?e.message:'ייבוא נכשל');}finally{setBusy(false);}
 }
 return <div className="stack-lg history-page"><PageHeader kicker="03 / STRENGTH INTELLIGENCE" title="היסטוריה וביצועים" subtitle="מה שבאמת נמדד. לא מה שהוערך."/>
 <div className="button-row"><Link className="secondary-button" to="/training">יומן אימונים</Link><Link className="secondary-button" to="/profile">פרופיל</Link></div>
 {error?<p className="notice danger" role="alert">{error}</p>:null}{message?<p className="notice" role="status">{message}</p>:null}{state.error?<p role="alert">{state.error}</p>:null}
 <Card className="form-grid"><h2>ייבוא היסטוריה מקומי</h2><p className="card-muted">ארכיון NIVNE שומר את נתוני המקור. הנתונים ההיסטוריים לקריאה בלבד; יומן האימונים הרגיל נותר לעריכה.</p><label className="field"><span>קובץ ארכיון או הגדרה אישית JSON</span><input type="file" className="input" accept=".json,application/json" disabled={busy} onChange={e=>{void load(e.target.files?.[0]);e.target.value='';}}/></label>
 {pending?<div className="notice"><p>נמצאו {pending.archive.sessions.length} אימונים{pending.identity?' ופרופיל אישי':''}. הארכיון הקיים יוחלף, ללא מחיקת היומן הרגיל.</p><button type="button" className="primary-button" disabled={busy||state.loading||!!state.error} onClick={()=>void save()}>אשר ייבוא</button><button type="button" className="secondary-button" onClick={()=>setPending(null)}>ביטול</button></div>:null}
 {archive?<button className="secondary-button" type="button" onClick={()=>downloadText('NIVNE-history.json',JSON.stringify(archive,null,2))}>ייצוא ארכיון המקור</button>:null}</Card>
 {analysis&&archive?<><Card className="training-hero"><p className="route-kicker">HISTORICAL / VERIFIED INPUT</p><div className="training-metrics"><div><span>אימונים בארכיון</span><strong>{analysis.sessions.length}</strong></div><div><span>קבוצות סטים</span><strong>{analysis.sets}</strong></div><div><span>מקטעים</span><strong>{analysis.segments}</strong></div></div><p className="card-muted">{analysis.incomplete} אימונים עם עומס/חזרות חסרים או הערכה. {overlapping} אימונים ביומן הרגיל חופפים לתאריכי הארכיון; שני מקורות נשמרים בנפרד, ללא סכימת נפחים כפולה.</p></Card>
 <Card><h2>מגמת עומס מתועד</h2><p className="card-muted">ק״ג × חזרות; צבעים אינם המלצה. השוואת נפח בין קבוצות שרירים שונות מוגבלת. הערכות מסומנות בנפרד.</p><div className="history-bars">{analysis.sessions.map(s=><div key={s.session.id}><div className="split"><bdi>{s.session.localDate}</bdi><strong><bdi>{fmt(s.counted,1)}{s.complete?'':s.estimated?' ~':'+'}</bdi></strong></div><progress aria-label={s.session.localDate+' נפח רשום'} max={Math.max(1,...analysis.sessions.map(x=>x.counted))} value={s.counted}/><small className="card-muted">{s.session.title} · {s.sets} סטים · {s.complete?'נתונים כמותיים מלאים':s.estimated?'חלק מהחזרות משוערות':'נפח חלקי'}{s.partial?' · חזרות חלקיות':''}</small></div>)}</div></Card>
 <Card><h2>עוגני כוח והתקדמות</h2><p className="card-muted">סט ראשי עם חזרות שלמות, ללא משקל לא ידוע או שנוי במחלוקת. לפי שם, ציוד ותצורה זהים; גם כך יש לאשר שזה אותו מכשיר. אין אומדן 1RM או יעד עומס אוטומטי.</p>{group?<><label className="field"><span>תרגיל</span><select className="input" value={group.key} onChange={e=>setSelected(e.target.value)}>{analysis.groups.map(g=><option key={g.key} value={g.key}>{g.name} ({g.points.length})</option>)}</select></label><div className="anchor-hero"><small>הביצוע הכבד ביותר שנמצא</small><strong><bdi>{fmt(best?.load,1)} × {fmt(best?.reps)}</bdi></strong><small>ק״ג כולל נומינלי · {best?.date}</small></div><p className="card-muted">{group.equipment} · {group.configuration}</p>{group.points.map(p=><div className="split history-point" key={p.date}><bdi>{p.date}</bdi><strong><bdi>{fmt(p.load,1)} × {fmt(p.reps)}</bdi></strong></div>)}</>:<p>אין סטים מתאימים להשוואה.</p>}</Card>
 <Card><h2>נתוני המקור לפי אימון</h2>{analysis.sessions.slice().reverse().map(s=><article className="training-session" key={s.session.id}><button className="training-session-button" type="button" aria-expanded={open===s.session.id} onClick={()=>setOpen(open===s.session.id?'':s.session.id)}><span><strong>{s.session.title}</strong><small>{s.session.localDate} · {s.session.phase}</small></span><span><strong><bdi>{fmt(s.counted,1)}</bdi></strong><small>{s.complete?'מחושב':'חלקי / הערכה'}</small></span></button>{open===s.session.id?<div className="stack"><p className="card-muted">חזרות שלמות ידועות בלבד: {fmt(s.full,1)} ק״ג × חזרות. מקטעים חסרים: {s.missing}. מקטעים עם כשל: {s.failures}. קבוצות דרופ: {s.drops}.</p>{s.session.exercises.map(e=><section className="training-exercise" key={e.id}><h3>{e.nameHe}</h3><small>{e.equipment} · {e.configuration}</small>{e.sets.map((t,i)=><div key={t.id} className="training-set"><strong>סט {i+1} · {t.kind}</strong>{t.segments.map(p=><div key={p.id}><bdi>{p.weight_value??'—'} {p.weight_unit} × {p.reps??'—'}</bdi><small className="card-muted"> · {p.weight_basis} · {archiveSegmentLoad(p)===null?'עומס לא מוכרע':fmt(archiveSegmentLoad(p),1)+' ק״ג כולל'}{p.failure?' · כשל':''}{p.approximate_reps?' · משוער':''}</small>{p.independentCalculation.issues.length?<p className="card-muted">{p.independentCalculation.issues.join(' · ')}</p>:null}</div>)}</div>)}</section>)}</div>:null}</article>)}</Card></>:state.loading?<p>טוען…</p>:<Card><p>אין ארכיון עדיין. בחרו את קובץ ההיסטוריה שהוכן עבורכם.</p></Card>}
 </div>;
}
