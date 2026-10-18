'use strict';
// Conservative first-party Office Pledge reader. Interprets bounded UTF-8
// textual evidence; never executes incoming content or fabricates provenance.
// Claims are explicitly limited to directly observed source data.
const crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const printable=text=>text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
const trim=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,1800);
function textSource(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<1)return {supported:false,reason:'EMPTY_DOCUMENT'};
 if(bytes.length>8*1024*1024)return {supported:false,reason:'SOURCE_BYTE_BUDGET_EXCEEDED'};
 if(bytes.includes(0))return {supported:false,reason:'BINARY_SOURCE_REQUIRES_APPROVED_EXTRACTOR'};
 const s=bytes.toString('utf8');
 if(s.includes('\ufffd'))return {supported:false,reason:'NON_UTF8_SOURCE_REQUIRES_APPROVED_EXTRACTOR'};
 const controls=[...s].filter(c=>c.charCodeAt(0)<32&&!['\n','\r','\t'].includes(c)).length;
 if(controls>Math.max(2,s.length*.02))return {supported:false,reason:'UNSAFE_CONTROL_CHARACTERS'};
 return {supported:true,text:printable(s),type:'UTF8_TEXT'};
}
function documentReview({sourceBytes,sourceSha256,sourceLocator,perceptionPointId,
 chapterNumber,scrollNumber,birthNumber,agentId,taskId}={}){
 if(!Buffer.isBuffer(sourceBytes)||!sourceSha256||sha(sourceBytes)!==sourceSha256)
  throw Error('ORION_DOCUMENT_REVIEW_ORIGINAL_BYTES_NOT_VERIFIED');
 const parsed=textSource(sourceBytes);
 if(!parsed.supported)throw Error('ORION_DOCUMENT_REVIEW_'+parsed.reason);
 const lines=parsed.text.split(/\r?\n/).map(trim).filter(Boolean);
 if(lines.length===0)throw Error('ORION_DOCUMENT_REVIEW_NO_CONTENT');
 const declaredWho=lines.find(x=>/^(author|from|by|prepared by|sender)\s*:/i.test(x));
 const declaredWhen=lines.find(x=>/^(date|created|timestamp|sent|observed)\s*:/i.test(x));
 const declaredWhy=lines.find(x=>/^(purpose|reason|objective|goal)\s*:/i.test(x));
 const declaredHow=lines.find(x=>/^(method|procedure|approach|process)\s*:/i.test(x));
 const explicitName=lines.find(x=>/^(title|subject|topic)\s*:/i.test(x));
 const unknown='NOT_ESTABLISHED_BY_SOURCE';
 const facts=lines.slice(0,12).map((line,i)=>({line:i+1,text:line.slice(0,1200)}));
 const summary=trim((explicitName||lines[0]).slice(0,350));
 const sourceStatements=facts.slice(0,6).map(f=>'line '+f.line+': '+f.text).join(' | ');
 const contradictions=lines.filter(x=>/\b(conflict|contradic|disagree|inconsistent|however|but)\b/i.test(x)).slice(0,8);
 const unknownFields=['who','when','why','how'].filter(k=>
  ({who:declaredWho,when:declaredWhen,why:declaredWhy,how:declaredHow})[k]==null);
 const analysis={
  who:declaredWho?trim('SOURCE_DECLARES '+declaredWho):unknown,
  what:'SOURCE_STATES '+summary+'; observed excerpts: '+sourceStatements,
  where:'CUSTODY_CHAPTER '+String(chapterNumber)+' / PERCEPTION_POINT '+String(perceptionPointId)+
   '; original locator recorded, not independently authenticated',
  when:declaredWhen?trim('SOURCE_DECLARES '+declaredWhen):unknown,
  why:declaredWhy?trim('SOURCE_DECLARES '+declaredWhy):unknown,
  how:declaredHow?trim('SOURCE_DECLARES '+declaredHow):'REVIEWED_AS_UTF8_TEXT_ONLY; '+unknown
 };
 const growthCandidates=[];
 if(unknownFields.length)growthCandidates.push({kind:'PROVENANCE_RECONCILIATION',
  reason:'Source does not establish: '+unknownFields.join(', '),
  sourceSha256,proposalOnly:true});
 if(contradictions.length)growthCandidates.push({kind:'CONTRADICTION_REVIEW',
  reason:'Source includes explicit possible contradiction or qualification language',
  excerpts:contradictions.map(x=>x.slice(0,200)),sourceSha256,proposalOnly:true});
 const evidenceRefs=['sha256:'+sourceSha256,
  'orion-office-source:'+String(chapterNumber)+'/'+String(perceptionPointId),
  'orion-scroll:'+String(scrollNumber)];
 return {accepted:true,agentId:String(agentId),sourceSha256,
  executionReceiptId:'source-review-'+sha(Buffer.from(JSON.stringify({
   sourceSha256,taskId,agentId,scrollNumber,birthNumber}))).slice(0,36),
  analysis,evidenceRefs,growthCandidates,
  evidenceClassification:'SOURCE_TEXT_ONLY_NOT_FACT_VERIFICATION',
  truthEstablished:false,sourceTextIsUntrusted:true,
  sourceStatementsReviewed:facts.length,originTimestampVerified:false};
}
module.exports={documentReview,textSource};
