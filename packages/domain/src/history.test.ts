
import {describe,it,expect} from 'vitest';
import {archiveSegmentSchema,historyArchiveSchema} from '@form/contracts';
import {archiveSegmentLoad,archiveInsights} from './history';
const p=archiveSegmentSchema.parse({id:'70000000-0000-4000-8000-000000000001',weight_value:20,weight_unit:'lb',weight_basis:'per_hand',two_side_multiplier:2,reps:8,segment_role:'primary',approximate_reps:false,partial_reps_unknown:false,excluded_partial_reps_count:null,failure:false,independentCalculation:{issues:[]}});
describe('history engine',()=>{
 it('normalizes only confirmed external loads',()=>{expect(archiveSegmentLoad(p)).toBeCloseTo(18.1436948);expect(archiveSegmentLoad({...p,two_side_multiplier:null})).toBeNull();expect(archiveSegmentLoad({...p,independentCalculation:{issues:['disputed_weight_basis']}})).toBeNull();});
 it('preserves source, counts only known segments, separates estimates',()=>{const a=historyArchiveSchema.parse({format:'nivne-history-archive',schemaVersion:1,source:{x:1},sessions:[{id:'70000000-0000-4000-8000-000000000002',localDate:'2026-01-01',title:'Synthetic',phase:'neutral',exercises:[{id:'70000000-0000-4000-8000-000000000003',nameHe:'Test',nameEn:'Test',equipment:'DB',configuration:'bench',sets:[{id:'70000000-0000-4000-8000-000000000004',kind:'working',segments:[p,{...p,id:'70000000-0000-4000-8000-000000000005',reps:null}]}]}]}]});const s=archiveInsights(a);expect(s.sets).toBe(1);expect(s.segments).toBe(2);expect(s.incomplete).toBe(1);expect(s.sessions[0]?.counted).toBeCloseTo(145.1495584);expect(s.groups[0]?.points).toHaveLength(1);expect(a.source).toEqual({x:1});expect(historyArchiveSchema.safeParse({...a,sessions:[...a.sessions,...a.sessions]}).success).toBe(false);});
});
