import fs from 'node:fs/promises';
const entries=JSON.parse(await fs.readFile(new URL('./encyclopedia-full-before.json',import.meta.url),'utf8'));
const out=[];let next=0;
async function worker(){while(next<entries.length){const e=entries[next++];const urls=e.sourceUrls.filter(u=>!u.endsWith('.pdf')).slice(0,1);for(const url of urls){try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});let html=await r.text();let main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]??html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]??html;const text=main.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#8217;/g,"'").replace(/\s+/g,' ').trim();out.push({name:e.name,url,status:r.status,text});}catch(error){out.push({name:e.name,url,error:error.message});}}}}
await Promise.all(Array.from({length:6},worker));
await fs.writeFile(new URL('./natural-history-evidence.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),sources:out},null,2));
console.log(JSON.stringify(out.map(({name,status,error,text})=>({name,status,error,chars:text?.length})),null,2));
