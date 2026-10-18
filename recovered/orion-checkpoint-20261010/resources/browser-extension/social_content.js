(() => {
  'use strict';
  const API='http://127.0.0.1:43120';
  const host=location.hostname.toLowerCase();
  const platform=host.includes('x.com')||host.includes('twitter.com')?'x':
    host.includes('facebook.com')?'facebook':host.includes('instagram.com')?'instagram':
    host.includes('linkedin.com')?'linkedin':host.includes('youtube.com')?'youtube':null;
  if(!platform) return;
  async function api(path,options={}){
    const reply=await chrome.runtime.sendMessage({type:'dt-local-api',path,options});
    if(!reply?.ok) throw new Error(reply?.error||'DT local API bridge failed');
    return reply.data;
  }
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function visible(el){const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>2&&r.height>2&&s.display!=='none'&&s.visibility!=='hidden';}
  function textOf(el){return `${el.getAttribute?.('aria-label')||''} ${el.innerText||''}`.trim();}
  function candidates(){return [...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].filter(visible);}
  function fill(el,text){el.focus();if('value' in el){const p=Object.getPrototypeOf(el);Object.getOwnPropertyDescriptor(p,'value')?.set?.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));}else{el.textContent='';document.execCommand('insertText',false,text);el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}}
  function submitButtons(){return [...document.querySelectorAll('button,[role="button"]')].filter(visible);}
  function findPublish(kind){
    const buttons=submitButtons();
    if(kind==='follow') return buttons.find(b=>/^(follow|connect|subscribe)$/i.test(textOf(b).trim()));
    const patterns={x:/^(post|reply)$/i,facebook:/^(post|publish|share)$/i,instagram:/^(share|post|next)$/i,linkedin:/^(post|publish)$/i,youtube:/^(publish|upload|create|next)$/i};
    return buttons.find(b=>patterns[platform]?.test(textOf(b).trim())) || buttons.find(b=>/post|publish|share|submit/i.test(textOf(b)));
  }
  function composer(){
    const all=candidates();
    if(platform==='x') return all.find(e=>e.getAttribute('data-testid')==='tweetTextarea_0')||all[0];
    return all[0];
  }
  async function verifySubmitted(job,beforeText){
    for(let i=0;i<12;i++){
      await sleep(500);
      const now=document.body.innerText||'';
      if(job.kind==='follow' && /following|pending|requested|subscribed|connected/i.test(now)) return true;
      if(job.kind!=='follow' && now!==beforeText && !composer()?.innerText?.includes(job.text)) return true;
    }
    return false;
  }
  async function work(){
    try{
      const state=await api('/v1/social/current?page_url='+encodeURIComponent(location.href));
      const job=state.current_job;if(!job||job.platform!==platform||!['opened','queued'].includes(job.status))return;
      const before=document.body.innerText||'';
      if(job.kind==='follow'){
        const button=findPublish('follow');if(!button)throw new Error('No verified follow/connect control found');
        button.click();
      }else{
        const box=composer();if(!box)throw new Error('No visible social composer found');
        fill(box,job.text);await sleep(400);
        const button=findPublish('post');if(!button||button.disabled)throw new Error('No enabled publish control found');
        button.click();
      }
      await api('/v1/social/submitted',{method:'POST',body:JSON.stringify({job_id:job.job_id,page_url:location.href})});
      if(await verifySubmitted(job,before)){
        await api('/v1/social/complete',{method:'POST',body:JSON.stringify({job_id:job.job_id,page_url:location.href,receipt:{title:document.title,observedAt:new Date().toISOString()}})});
      }else{
        await api('/v1/social/fail',{method:'POST',body:JSON.stringify({job_id:job.job_id,error:'Could not verify visible submission result'})});
      }
    }catch(error){console.debug('[DT Social Bridge]',error.message||error);}
  }
  setTimeout(work,1800);setInterval(work,10000);
})();
