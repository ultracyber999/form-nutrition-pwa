
import type { ArchiveSession, ArchiveSegment, HistoryArchive } from '@form/contracts';
export function archiveSegmentLoad(p:ArchiveSegment):number|null {
 if(p.weight_value===null||p.weight_unit==='bodyweight'||p.weight_basis==='bodyweight'||p.weight_basis==='unknown_cable_basis'||p.independentCalculation.issues.includes('disputed_weight_basis'))return null;
 const expected=['per_side','per_hand','barbell_plates_per_side'].includes(p.weight_basis)?2:1;
 if(p.two_side_multiplier!==expected)return null;
 return p.weight_value*expected*(p.weight_unit==='lb'?0.45359237:1);
}
export function archiveSummary(s:ArchiveSession){
 let counted=0,full=0,sets=0,segments=0,missing=0,estimated=0,partial=0,failures=0,drops=0;
 for(const e of s.exercises)for(const t of e.sets){
  if(t.kind==='warmup')continue;
  sets++;if(t.kind==='drop')drops++;
  for(const p of t.segments){
   segments++;if(p.failure)failures++;
   const load=archiveSegmentLoad(p);
   if(load===null||p.reps===null)missing++;
   else {counted+=load*p.reps; if(!p.approximate_reps)full+=load*Math.floor(p.reps);}
   if(p.approximate_reps)estimated++;
   if(p.partial_reps_unknown||(p.excluded_partial_reps_count??0)>0||(p.reps!==null&&!Number.isInteger(p.reps)))partial++;
  }
 }
 return {counted,full,sets,segments,missing,estimated,partial,failures,drops,complete:missing===0&&estimated===0};
}
export function archiveInsights(a:HistoryArchive){
 const sessions=a.sessions.slice().sort((x,y)=>x.localDate.localeCompare(y.localDate));
 const groups=new Map<string,{key:string;name:string;equipment:string;configuration:string;points:{date:string;load:number;reps:number}[]}>();
 for(const s of sessions)for(const e of s.exercises){
  const key=[e.nameEn,e.equipment,e.configuration].map(x=>x.trim().toLowerCase()).join('|');
  const candidates=e.sets.filter(t=>t.kind!=='warmup').flatMap(t=>t.segments).filter(p=>p.segment_role==='primary'&&!p.approximate_reps&&p.reps!==null&&Number.isInteger(p.reps)).map(p=>({load:archiveSegmentLoad(p),reps:p.reps??0})).filter((p):p is {load:number;reps:number}=>p.load!==null&&p.load>0).sort((a,b)=>b.load-a.load||b.reps-a.reps);
  const best=candidates[0];if(!best)continue;
  const g=groups.get(key)??{key,name:e.nameHe,equipment:e.equipment,configuration:e.configuration,points:[]};
  const existing=g.points.find(p=>p.date===s.localDate);
  if(!existing)g.points.push({date:s.localDate,...best});
  else if(best.load>existing.load||best.load===existing.load&&best.reps>existing.reps){existing.load=best.load;existing.reps=best.reps;}
  groups.set(key,g);
 }
 const summaries=sessions.map(s=>({session:s,...archiveSummary(s)}));
 return {sessions:summaries,groups:[...groups.values()].sort((a,b)=>b.points.length-a.points.length||a.name.localeCompare(b.name)),sets:summaries.reduce((n,s)=>n+s.sets,0),segments:summaries.reduce((n,s)=>n+s.segments,0),incomplete:summaries.filter(s=>!s.complete).length};
}
