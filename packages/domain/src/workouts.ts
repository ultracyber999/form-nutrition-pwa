import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '@form/contracts';
export const POUNDS_TO_KG = 0.45359237;
export function effectiveLoad(load: number, unit: 'kg'|'lb', multiplier: 1|2): number {
  return load * (unit === 'lb' ? POUNDS_TO_KG : 1) * multiplier;
}
export function setVolume(set: WorkoutSet, exercise: Pick<WorkoutExercise,'unit'|'multiplier'>): number {
  if (set.kind === 'warmup') return 0;
  return set.segments.reduce((sum,s) => sum + effectiveLoad(s.load ?? 0,exercise.unit,exercise.multiplier)*(s.reps ?? 0),0);
}
export function exerciseVolume(exercise: WorkoutExercise): number {
  return exercise.sets.reduce((sum,set)=>sum+setVolume(set,exercise),0);
}
export function workoutSummary(session: WorkoutSession) {
  const sets = session.exercises.flatMap(e=>e.sets);
  const workingSets = sets.filter(s=>s.kind!=='warmup').length;
  const volume = session.exercises.reduce((sum,e)=>sum+exerciseVolume(e),0);
  return {workingSets, volume, warmups:sets.length-workingSets, drops:sets.filter(s=>s.kind==='drop' && s.segments.length===2).length,doubleDrops:sets.filter(s=>s.kind==='drop' && s.segments.length===3).length,extendedDrops:sets.filter(s=>s.kind==='drop' && s.segments.length>3).length,
    countMismatch:session.reported?.workingSets!==undefined && session.reported.workingSets!==workingSets,
    volumeMismatch:session.reported?.volume!==undefined && Math.abs(session.reported.volume-volume)>0.05};
}
export function exerciseKey(e: WorkoutExercise) {
  return [e.name.trim().toLowerCase(),e.equipment.trim().toLowerCase(),e.multiplier].join('|');
}
export function recordedPRs(sessions: WorkoutSession[]) {
  const records = new Map<string,{key:string;name:string;equipment:string;load:number;reps:number;rawLoad:number;unit:'kg'|'lb';multiplier:1|2;date:string;peakVolume:number}>();
  for(const session of sessions) for(const exercise of session.exercises) {
    const key=exerciseKey(exercise);
    const peak=exerciseVolume(exercise);
    for(const set of exercise.sets) {
      if(set.kind==='warmup')continue;
      for(const segment of set.segments) {
        if(segment.load===null || segment.reps===null)continue;
        const load=effectiveLoad(segment.load,exercise.unit,exercise.multiplier);
        const old=records.get(key);
        if(!old || load>old.load || (load===old.load && segment.reps>old.reps))records.set(key,{key,name:exercise.name,equipment:exercise.equipment,load,reps:segment.reps,rawLoad:segment.load,unit:exercise.unit,multiplier:exercise.multiplier,date:session.localDate,peakVolume:Math.max(peak,old?.peakVolume??0)});
        else old.peakVolume=Math.max(old.peakVolume,peak);
      }
    }
  }
  return [...records.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export function compareVolume(previous: WorkoutSession, current: WorkoutSession): number|null {
  const base=workoutSummary(previous).volume;
  return base>0 ? (workoutSummary(current).volume/base-1)*100 : null;
}
