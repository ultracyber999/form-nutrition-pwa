
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { localIdentitySchema, type LocalIdentity } from '@form/contracts';
import { useForm } from '../context';
import { useAsync } from '../useAsync';
import { Card, PageHeader } from '../components/common';
function IdentityEditor({initial}:{initial:LocalIdentity|null}){
 const {repo,refresh}=useForm();
 const [name,setName]=useState(initial?.displayName??'');
 const [email,setEmail]=useState(initial?.email??'');
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 async function save(){
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{await repo.saveLocalIdentity(localIdentitySchema.parse({displayName:name,email:email.trim()||null}));setMessage('הפרופיל נשמר במכשיר.');refresh();}catch(e){setError(e instanceof Error?e.message:'שמירה נכשלה');}finally{setBusy(false);}
 }
 return <Card className="form-grid"><div className="identity-avatar" aria-hidden="true">{name.trim().slice(0,2)||'N'}</div><h2>{name.trim()||'הפרופיל שלי'}</h2><label className="field"><span>שם לתצוגה</span><input className="input" autoComplete="name" value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label><label className="field"><span>דוא״ל (אופציונלי)</span><input className="input" dir="ltr" type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label><p className="card-muted">זהו פרופיל מקומי, לא התחברות ולא אימות זהות. הגישה לאתר עשויה להיות מוגנת בנפרד על ידי Vercel. הדוא״ל לא נשלח לשירות חיצוני. גיבויים כוללים את הפרופיל.</p>{message?<p role="status">{message}</p>:null}{error?<p role="alert" className="notice danger">{error}</p>:null}<button className="primary-button" type="button" disabled={busy} onClick={()=>void save()}>שמירת פרופיל</button><Link className="secondary-button" to="/history">ייבוא נתונים אישיים</Link></Card>;
}
export function IdentityScreen(){const {repo}=useForm();const state=useAsync(()=>repo.getLocalIdentity(),[]);return <div className="stack-lg"><PageHeader kicker="NIVNE / ME" title="הפרופיל שלי" subtitle="הדרך שלך, הנתונים שלך." />{state.loading?<p>טוען…</p>:state.error?<p role="alert">{state.error}</p>:<IdentityEditor initial={state.data}/>}</div>;}
