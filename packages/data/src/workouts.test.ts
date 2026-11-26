import 'fake-indexeddb/auto';
import { describe,it,expect } from 'vitest';
import { workoutSessionSchema } from '@form/contracts';
import { FormDatabase } from './db';
import { FormRepository } from './repository';
const session = workoutSessionSchema.parse({id:'7a000000-0000-4000-8000-000000000002',localDate:'2026-01-01',title:'Synthetic',phase:'cut',exercises:[{name:'Row',equipment:'machine',unit:'kg',multiplier:1,sets:[{kind:'working',segments:[{load:20,reps:8}]}]}]});
describe('workout persistence and backup',()=>{
 it('merges once, restores across databases, preserves workouts on legacy imports, clears explicitly',async()=>{
  const repo=new FormRepository(new FormDatabase('workout-test-a'));
  const restore=new FormRepository(new FormDatabase('workout-test-b'));
  try {
   expect(await repo.mergeWorkouts([session])).toBe(1);
   expect(await repo.mergeWorkouts([session])).toBe(0);
   const bundle=await repo.exportBundle();
   await restore.importBundle(JSON.stringify(bundle),'replace-all');
   expect(await restore.listWorkouts()).toEqual([session]);
   delete bundle.workouts;
   await restore.importBundle(JSON.stringify(bundle),'replace-all');
   expect(await restore.listWorkouts()).toEqual([session]);
   await restore.clearLocalData();
   expect(await restore.listWorkouts()).toEqual([]);
  } finally {await repo.db.delete();await restore.db.delete();}
 });
});
