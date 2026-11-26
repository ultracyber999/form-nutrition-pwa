import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {historyArchiveSchema} from '@form/contracts';
import {FormDatabase} from './db';
import {FormRepository} from './repository';
describe('private history persistence',()=>{
 it('exports and restores identity and archive without erasing older backups',async()=>{
 const a=new FormRepository(new FormDatabase('history-a'));
 const b=new FormRepository(new FormDatabase('history-b'));
 try{
 const archive=historyArchiveSchema.parse({format:'nivne-history-archive',schemaVersion:1,sessions:[],source:{note:'synthetic'}});
 await a.saveHistoryArchive(archive,{displayName:'Synthetic',email:null});
 const bundle=await a.exportBundle();
 await b.importBundle(JSON.stringify(bundle),'replace-all');
 expect(await b.getHistoryArchive()).toEqual(archive);
 expect(await b.getLocalIdentity()).toEqual({displayName:'Synthetic',email:null});
 delete bundle.historyArchive;delete bundle.localIdentity;
 await b.importBundle(JSON.stringify(bundle),'replace-all');
 expect(await b.getHistoryArchive()).toEqual(archive);
 await b.clearLocalData();expect(await b.getLocalIdentity()).toBeNull();expect(await b.getHistoryArchive()).toBeNull();
 }finally{await a.db.delete();await b.db.delete();}
 });
});