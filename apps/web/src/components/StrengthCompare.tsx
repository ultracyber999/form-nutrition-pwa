import {useState} from 'react';
import {comparablePoints,strengthComparison,type StrengthPoint} from '@form/domain';
import {Card} from './common';
import {fmt,fmtSigned} from '../utils';
function pointLabel(p:StrengthPoint){return [p.date,p.name,fmt(p.rawLoad,2)+' '+p.unit+(p.multiplier===2?' לכל יד/צד':''),String(p.fullReps)+' חזרות שלמות',p.source==='archive'?'ארכיון':'יומן'].join(' · ');}
export function StrengthCompare({points}:{points:StrengthPoint[]}){
 const [baseline,setBaseline]=useState('');
 const [current,setCurrent]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const base=points.find(p=>p.id===baseline);
 const candidates=base?comparablePoints(base,points):[];
 const next=candidates.find(p=>p.id===current);
 const change=base&&next?strengthComparison(base,next,confirmed):null;
 return <Card className="form-grid strength-compare">
 <p className="route-kicker">STRENGTH / RETENTION</p><h2>השוואת עוגני כוח</h2><p className="card-muted">בחרו שני ביצועים באותו עומס ובאותו בסיס משקל. רק אתם יכולים לאשר שמדובר באותו תרגיל, ציוד, טווח תנועה וטכניקה. תוצאה אינה מדידת מסת שריר או המלצת עומס.</p>
 <label className="field"><span>נקודת ייחוס</span><select className="input" value={baseline} onChange={e=>{setBaseline(e.target.value);setCurrent('');setConfirmed(false);}}><option value="">בחרו סט קודם</option>{points.map(p=><option key={p.id} value={p.id}>{pointLabel(p)}</option>)}</select></label>
 {base?<label className="field"><span>ביצוע מאוחר יותר באותו עומס נומינלי</span><select className="input" value={current} onChange={e=>{setCurrent(e.target.value);setConfirmed(false);}}><option value="">בחרו סט להשוואה</option>{candidates.map(p=><option key={p.id} value={p.id}>{pointLabel(p)}</option>)}</select></label>:null}
 {base&&!candidates.length?<p className="notice">אין סט מאוחר באותו עומס ובסיס משקל.</p>:null}
 {base&&next?<><div className="anchor-pair"><div><small>{base.date} · {base.phase}</small><strong>{base.fullReps}</strong><span>{base.name}</span><small>{base.equipment} · {base.configuration??'תצורה לא ידועה'}</small></div><div><small>{next.date} · {next.phase}</small><strong>{next.fullReps}</strong><span>{next.name}</span><small>{next.equipment} · {next.configuration??'תצורה לא ידועה'}</small></div></div><label className="check-row"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>אני מאשר/ת שהתנועה, הציוד, טווח התנועה והטכניקה ניתנים להשוואה.</label></>:null}
 {change?<div className="anchor-hero"><small>{change.cutComparison?'השוואה לפני חיטוב מול חיטוב':'שינוי ביצוע באותו עומס'}</small><strong><bdi>{fmtSigned(change.repsDelta)} חזרות</bdi></strong><span><bdi>{fmtSigned(change.repsChangePct,1)}%</bdi> שינוי במספר החזרות השלמות בלבד</span></div>:null}
 </Card>;
}
