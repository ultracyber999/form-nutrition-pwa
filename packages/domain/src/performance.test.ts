import {describe,it,expect} from 'vitest';
import {historyArchiveSchema,workoutSessionSchema} from '@form/contracts';
import {archiveSummary} from './history';
import {trainingReferences,strengthEvidence,comparablePoints,strengthComparison} from './performance';
const id=(n:number)=>'90000000-0000-4000-8000-'+String(n).padStart(12,'0');
const segment={id:id(4),weight_value:20,weight_unit:'kg',weight_basis:'per_hand',two_side_multiplier:2,reps:8.5,segment_role:'primary',approximate_reps:false,partial_reps_unknown:true,excluded_partial_reps_count:null,failure:false,independentCalculation:{issues:[]}};
const archive=historyArchiveSchema.parse({format:'nivne-history-archive',schemaVersion:1,sessions:[{id:id(1),localDate:'2026-01-01',title:'Synthetic',phase:'pre-cut',exercises:[{id:id(2),nameHe:'Press',nameEn:'Press',equipment:'DB',configuration:'bench',sets:[{id:id(3),kind:'working',segments:[segment]}]}]}]});
const journal=workoutSessionSchema.parse({id:id(5),localDate:'2026-01-02',title:'Synthetic',phase:'cut',exercises:[{name:'Press',equipment:'DB',unit:'kg',multiplier:2,historyExerciseId:id(2),sets:[{kind:'working',segments:[{load:20,reps:9}],rir:1,failure:false}]}]});
describe('conservative strength comparisons',()=>{
 it('retains known full reps and marks unquantified partials incomplete',()=>{const s=archive.sessions[0];if(!s)throw Error('fixture');expect(archiveSummary(s)).toMatchObject({full:320,counted:340,unquantified:1,complete:false});});
 it('compares equal external loads only after explicit confirmation',()=>{const refs=trainingReferences(archive);expect(refs).toHaveLength(1);const [a,b]=strengthEvidence(archive,[journal]);if(!a||!b)throw Error('fixture');expect(a.fullReps).toBe(8);expect(b.fullReps).toBe(9);expect(comparablePoints(a,[b])).toEqual([b]);expect(strengthComparison(a,b,false)).toBeNull();expect(strengthComparison(a,b,true)).toMatchObject({repsDelta:1,cutComparison:true});expect(strengthComparison(a,{...b,loadKg:42},true)).toBeNull();expect(strengthComparison(a,{...b,basis:'machine_stack'},true)).toBeNull();});
 it('ignores unlinked or conflicting journal exercises and archive-date overlap',()=>{const ex=journal.exercises[0];if(!ex)throw Error('fixture');expect(strengthEvidence(archive,[{...journal,localDate:'2026-01-01'}])).toHaveLength(1);expect(strengthEvidence(archive,[{...journal,exercises:[{...ex,equipment:'other'}]}])).toHaveLength(1);});
 it('rejects contradictory RIR',()=>{const ex=journal.exercises[0];if(!ex)throw Error('fixture');const set=ex.sets[0];if(!set)throw Error('fixture');expect(workoutSessionSchema.safeParse({...journal,exercises:[{...ex,sets:[{...set,failure:true,rir:2}]}]}).success).toBe(false);});
});
