import {DatabaseSync} from 'node:sqlite';
import {AuthorityError} from './error.mjs';
export class SqliteStorage {
  constructor(path,{worldId}={}){
    if(typeof worldId!=='string'||!worldId.trim())throw new AuthorityError('WORLD_REQUIRED');
    this.raw=new DatabaseSync(path);this.depth=0;
    try{
      this.raw.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
      this.raw.exec('CREATE TABLE IF NOT EXISTS kit_world(id INTEGER PRIMARY KEY CHECK(id=1), world TEXT NOT NULL)');
      this.transaction(()=>{
        const old=this.all('SELECT world FROM kit_world WHERE id=1')[0];
        if(old&&old.world!==worldId)throw new AuthorityError('WORLD_MISMATCH',409);
        if(!old)this.run('INSERT INTO kit_world VALUES(1,?)',worldId);
      });this.worldId=worldId;
    }catch(e){this.raw.close();throw e;}
  }
  all(sql,...bindings){return this.raw.prepare(sql).all(...bindings);}
  run(sql,...bindings){this.raw.prepare(sql).run(...bindings);}
  transaction(work){
    if(this.depth)throw new AuthorityError('NESTED_TRANSACTION');
    this.raw.exec('BEGIN IMMEDIATE');this.depth++;
    try{const result=work();if(result&&typeof result.then==='function')throw new AuthorityError('ASYNC_TRANSACTION_FORBIDDEN');this.raw.exec('COMMIT');return result;}
    catch(e){this.raw.exec('ROLLBACK');throw e;}finally{this.depth--;}
  }
  close(){this.raw.close();}
}
