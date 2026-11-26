import { describe, expect, it } from 'vitest';
import { workoutSessionSchema } from '@form/contracts';
import { effectiveLoad, workoutSummary, recordedPRs, compareVolume } from './workouts';
const session = workoutSessionSchema.parse({id:'7a000000-0000-4000-8000-000000000001',localDate:'2026-01-01',title:'Synthetic upper',phase:'cut',exercises:[{name:'Press',equipment:'DB',unit:'kg',multiplier:2,sets:[{kind:'warmup',segments:[{load:10,reps:null}]},{kind:'working',segments:[{load:20,reps:5.5}]},{kind:'drop',segments:[{load:20,reps:4},{load:15,reps:3},{load:10,reps:2}]}]}],reported:{workingSets:3,volume:510}});
describe('workouts',()=>{
 it('uses two dumbbells, half reps, and excludes unknown warmups',()=>{const s=workoutSummary(session);expect(s.volume).toBe(510);expect(s.workingSets).toBe(2);expect(s.doubleDrops).toBe(1);expect(s.countMismatch).toBe(true);expect(s.volumeMismatch).toBe(false);});
 it('uses exact pounds conversion',()=>expect(effectiveLoad(70,'lb',2)).toBeCloseTo(63.5029318,8));
 it('records actual PR and not warmup',()=>{const pr=recordedPRs([session])[0];expect(pr?.load).toBe(40);expect(pr?.reps).toBe(5.5);expect(pr?.peakVolume).toBe(510);});
 it('rejects invalid fractional reps and incomplete working sets',()=>{const input=structuredClone(session);input.exercises[0]!.sets[1]!.segments[0]!.reps=5.2;expect(workoutSessionSchema.safeParse(input).success).toBe(false);input.exercises[0]!.sets[1]!.segments[0]!.reps=null;expect(workoutSessionSchema.safeParse(input).success).toBe(false);});
 it('compares identical sessions as no change',()=>expect(compareVolume(session,session)).toBe(0));
});
