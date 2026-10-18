const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

function sha256(file){const h=crypto.createHash('sha256');const fd=fs.openSync(file,'r');const b=Buffer.alloc(1024*1024);try{let n;while((n=fs.readSync(fd,b,0,b.length,null))>0)h.update(b.subarray(0,n));}finally{fs.closeSync(fd);}return h.digest('hex');}
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');fs.renameSync(tmp,file);}

class TieredStorage {
  constructor({root,vault=null,experience=null}={}){
    this.root=path.join(root,'tiered-storage');this.file=path.join(this.root,'catalog.json');this.vault=vault;this.experience=experience;
    fs.mkdirSync(this.root,{recursive:true});
  }
  load(){try{return JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{return {schema:'dt-tiered-storage/1.0',artifacts:{},roots:{},updatedAt:null};}}
  registerRoot(input={}){
    const id=String(input.id||crypto.randomUUID()),rootPath=path.resolve(String(input.path||''));
    if(!rootPath||!fs.existsSync(rootPath))throw new Error('Storage root unavailable');
    const state=this.load();state.roots[id]={id,path:rootPath,tier:input.tier||'WARM',kind:input.kind||'filesystem',durable:input.durable===true,observedAt:new Date().toISOString()};
    state.updatedAt=new Date().toISOString();atomic(this.file,state);return state.roots[id];
  }
  registerArtifact(file,input={}){
    const source=path.resolve(String(file||''));if(!fs.existsSync(source)||!fs.statSync(source).isFile())throw new Error('Artifact file unavailable');
    const hash=sha256(source),id=String(input.id||`sha256:${hash}`),state=this.load();
    const prior=state.artifacts[id]||{id,sha256:hash,originalPath:source,locations:[],provenance:input.provenance||null};
    const loc={kind:'LOCAL',path:source,verifiedAt:new Date().toISOString(),size:fs.statSync(source).size};
    prior.locations=[...prior.locations.filter(x=>x.path!==source),loc];prior.logicalState='PRESENT';prior.updatedAt=new Date().toISOString();state.artifacts[id]=prior;
    state.updatedAt=prior.updatedAt;atomic(this.file,state);return prior;
  }
  offload(input={}){
    const source=path.resolve(String(input.source||'')),rootId=String(input.rootId||'');
    if(!fs.existsSync(source)||!fs.statSync(source).isFile())throw new Error('Source file unavailable');
    const state=this.load(),root=state.roots[rootId];if(!root)throw new Error('Unknown storage root');
    const hash=sha256(source),id=String(input.id||`sha256:${hash}`),dir=path.join(root.path,'DT_Offload',hash.slice(0,2),hash.slice(2,10));
    fs.mkdirSync(dir,{recursive:true});const dest=path.join(dir,path.basename(source));fs.copyFileSync(source,dest);
    if(sha256(dest)!==hash)throw new Error('Offload verification hash mismatch');
    const artifact=state.artifacts[id]||{id,sha256:hash,originalPath:source,locations:[],provenance:input.provenance||null};
    artifact.locations=[...artifact.locations.filter(x=>x.path!==dest),{kind:root.kind,tier:root.tier,rootId,path:dest,verifiedAt:new Date().toISOString(),size:fs.statSync(dest).size,durable:root.durable}];
    artifact.logicalState='PRESENT_OFFLOADED_COPY';artifact.updatedAt=new Date().toISOString();state.artifacts[id]=artifact;state.updatedAt=artifact.updatedAt;atomic(this.file,state);
    return artifact;
  }
  evictLocal(input={}){
    const state=this.load(),id=String(input.id||''),artifact=state.artifacts[id];if(!artifact)throw new Error('Unknown artifact');
    const durable=(artifact.locations||[]).filter(x=>x.path!==artifact.originalPath&&x.durable&&fs.existsSync(x.path)&&sha256(x.path)===artifact.sha256);
    if(durable.length<2)throw new Error('Local eviction requires two independent verified durable copies');
    if(fs.existsSync(artifact.originalPath))fs.unlinkSync(artifact.originalPath);
    const ref=artifact.originalPath+'.dtref.json';atomic(ref,{schema:'dt-storage-reference/1.0',artifactId:id,sha256:artifact.sha256,rehydrateVia:'tiered.storage.rehydrate'});
    artifact.locations=(artifact.locations||[]).filter(x=>x.path!==artifact.originalPath);artifact.logicalState='PRESENT_VIA_REFERENCES';artifact.referencePath=ref;artifact.updatedAt=new Date().toISOString();
    state.updatedAt=artifact.updatedAt;atomic(this.file,state);return artifact;
  }
  rehydrate(input={}){
    const state=this.load(),id=String(input.id||''),artifact=state.artifacts[id];if(!artifact)throw new Error('Unknown artifact');
    const destination=path.resolve(String(input.destination||artifact.originalPath||''));
    const source=(artifact.locations||[]).find(x=>x.path&&fs.existsSync(x.path)&&sha256(x.path)===artifact.sha256);
    if(!source)throw new Error('No verified artifact location currently available');
    fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source.path,destination);if(sha256(destination)!==artifact.sha256)throw new Error('Rehydrate verification failed');
    artifact.locations=[...artifact.locations.filter(x=>x.path!==destination),{kind:'LOCAL',path:destination,verifiedAt:new Date().toISOString(),size:fs.statSync(destination).size}];artifact.logicalState='PRESENT';artifact.updatedAt=new Date().toISOString();
    state.updatedAt=artifact.updatedAt;atomic(this.file,state);return artifact;
  }
  status(){return this.load();}
}
module.exports={TieredStorage,sha256};
