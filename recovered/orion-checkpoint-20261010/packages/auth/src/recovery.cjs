const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {ADMIN_SCOPES,isOwner}=require('./policy.cjs');
class RecoveryAuthority{
 constructor(root,keys,ownerId){
  if(ownerId!=='orion-local-root-owner')throw Error('ORION_LOCAL_OWNER_ID_REQUIRED');
  this.file=path.join(root,'recovery-registry.json');
  this.keys=keys;this.ownerId=ownerId;
  fs.mkdirSync(root,{recursive:true});
 }
 load(){return fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):[];}
 save(rows){fs.writeFileSync(this.file,JSON.stringify(rows,null,2),'utf8');}
 issuePair(label='owner-escrow'){return [1,2].map(slot=>this.issue(label+'-'+slot));}
 issue(label){
  const id=crypto.randomUUID(),secret=crypto.randomBytes(24).toString('base64url');
  const salt=crypto.randomBytes(16).toString('hex');
  const hash=crypto.scryptSync(secret,salt,32).toString('hex');
  const rows=this.load();
  rows.push({id,label,salt,hash,ownerId:this.ownerId,
   createdAt:new Date().toISOString(),usedAt:null});
  this.save(rows);
  return {id,ticket:'dtr_'+id+'.'+secret,ownerId:this.ownerId,uses:1};
 }
 redeem(ticket,ownerProof){
  if(!isOwner({ownerId:this.ownerId},ownerProof))
   throw Error('SIGNED_LOCAL_ROOT_OWNER_REQUIRED');
  const match=/^dtr_([^.]+)\.(.+)$/.exec(ticket||'');
  if(!match)throw Error('Invalid recovery ticket');
  const rows=this.load(),record=rows.find(row=>row.id===match[1]);
  if(!record||record.usedAt)throw Error('Recovery ticket unavailable');
  // Older ownerLogin fields are frozen provenance, not an active GitHub
  // authentication mechanism. Legacy tickets cannot regain admin access
  // without separately reissuing them under the signed local owner root.
  if(record.ownerId!==this.ownerId)
   throw Error('LEGACY_REMOTE_IDENTITY_RECOVERY_REQUIRES_LOCAL_REISSUE');
  const hash=crypto.scryptSync(match[2],record.salt,32).toString('hex');
  if(!crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(record.hash)))
   throw Error('Invalid recovery ticket');
  record.usedAt=new Date().toISOString();this.save(rows);
  return this.keys.issue({label:'recovered-owner:'+this.ownerId,scopes:[...ADMIN_SCOPES]});
 }
}
module.exports={RecoveryAuthority};
