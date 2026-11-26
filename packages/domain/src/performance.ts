import type { ArchiveSegment, HistoryArchive, WorkoutExercise, WorkoutSession } from '@form/contracts';
import { archiveSegmentLoad } from './history';
import { effectiveLoad } from './workouts';

type Basis = Exclude<ArchiveSegment['weight_basis'],'bodyweight'|'unknown_cable_basis'>;
export type TrainingReference = {id:string;name:string;equipment:string;configuration:string|null;date:string;basis:Basis;unit:'kg'|'lb';multiplier:1|2};
export type StrengthPoint = {id:string;exerciseId:string;date:string;phase:string;name:string;equipment:string;configuration:string|null;basis:Basis;loadKg:number;rawLoad:number;unit:'kg'|'lb';multiplier:1|2;fullReps:number;source:'archive'|'journal'};
const supportedBasis=(b:ArchiveSegment['weight_basis']):b is Basis=>b!=='bodyweight'&&b!=='unknown_cable_basis';
// References are available only if the source reports a consistent primary load basis.
export function trainingReferences(archive:HistoryArchive|null|undefined):TrainingReference[]{
 const result:TrainingReference[]=[];
 for(const s of archive?.sessions??[])for(const e of s.exercises){
  const p=e.sets.filter(t=>t.kind!=='warmup').flatMap(t=>t.segments).filter(x=>x.segment_role==='primary'&&archiveSegmentLoad(x)!==null);
  const first=p[0];
  if(!first||!supportedBasis(first.weight_basis)||first.weight_unit==='bodyweight'||first.two_side_multiplier===null||!p.every(x=>x.weight_basis===first.weight_basis&&x.two_side_multiplier===first.two_side_multiplier))continue;
  result.push({id:e.id,name:e.nameHe,equipment:e.equipment,configuration:e.configuration,date:s.localDate,basis:first.weight_basis,unit:first.weight_unit,multiplier:first.two_side_multiplier});
 }
 return result.sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name));
}
export function linkedReference(ex:WorkoutExercise,refs:TrainingReference[]):TrainingReference|undefined{
 const r=refs.find(r=>r.id===ex.historyExerciseId);
 return r&&r.name===ex.name&&r.equipment===ex.equipment&&r.multiplier===ex.multiplier?r:undefined;
}
export function strengthEvidence(archive:HistoryArchive|null|undefined,native:WorkoutSession[]):StrengthPoint[]{
 const refs=trainingReferences(archive);
 const points:StrengthPoint[]=[];
 for(const s of archive?.sessions??[])for(const e of s.exercises)for(const t of e.sets){
  if(t.kind==='warmup')continue;
  for(const p of t.segments){
   const kg=archiveSegmentLoad(p);
   if(p.segment_role!=='primary'||p.approximate_reps||p.reps===null||Math.floor(p.reps)<1||p.weight_value===null||kg===null||kg<=0||p.weight_unit==='bodyweight'||!supportedBasis(p.weight_basis)||p.two_side_multiplier===null)continue;
   points.push({id:p.id,exerciseId:e.id,date:s.localDate,phase:s.phase,name:e.nameHe,equipment:e.equipment,configuration:e.configuration,basis:p.weight_basis,loadKg:kg,rawLoad:p.weight_value,unit:p.weight_unit,multiplier:p.two_side_multiplier,fullReps:Math.floor(p.reps),source:'archive'});
  }
 }
 // Same-day journal records may duplicate the archive; omit from comparison, retain in storage.
 const dates=new Set(archive?.sessions.map(s=>s.localDate)??[]);
 for(const s of native){
  if(dates.has(s.localDate))continue;
  s.exercises.forEach((e,ei)=>{
   const ref=linkedReference(e,refs);
   if(!ref)return;
   e.sets.forEach((t,si)=>{
    const p=t.segments[0];
    if(t.kind==='warmup'||!p||p.load===null||p.reps===null||p.load<=0||Math.floor(p.reps)<1)return;
    points.push({id:JSON.stringify([s.id,ei,si]),exerciseId:ref.id,date:s.localDate,phase:s.phase,name:e.name,equipment:e.equipment,configuration:ref.configuration,basis:ref.basis,loadKg:effectiveLoad(p.load,e.unit,e.multiplier),rawLoad:p.load,unit:e.unit,multiplier:e.multiplier,fullReps:Math.floor(p.reps),source:'journal'});
   });
  });
 }
 // Best full-rep performance at each exact load within one exercise occurrence and day.
 const best=new Map<string,StrengthPoint>();
 for(const p of points){
  const k=JSON.stringify([p.date,p.exerciseId,p.basis,p.loadKg.toFixed(6),p.source]);
  const old=best.get(k);if(!old||p.fullReps>old.fullReps)best.set(k,p);
 }
 return [...best.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name)||b.loadKg-a.loadKg);
}
export function comparablePoints(base:StrengthPoint,points:StrengthPoint[]){
 return points.filter(p=>p.date>base.date&&p.basis===base.basis&&p.multiplier===base.multiplier&&Math.abs(p.loadKg-base.loadKg)<0.000001);
}
export function strengthComparison(base:StrengthPoint,current:StrengthPoint,confirmed:boolean){
 if(!confirmed||!comparablePoints(base,[current]).length)return null;
 return {repsDelta:current.fullReps-base.fullReps,repsChangePct:(current.fullReps/base.fullReps-1)*100,cutComparison:base.phase!=='cut'&&current.phase==='cut'};
}
