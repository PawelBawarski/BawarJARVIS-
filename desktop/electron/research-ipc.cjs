'use strict';
const BASE = 'http://127.0.0.1:8080';
const TOKEN = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function routeResearch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid research request');
  switch (input.operation) {
    case 'list': return {method:'GET',path:'/api/research'};
    case 'search': {
      if (typeof input.query !== 'string' || !input.query.trim() || input.query.length>120 || !['pl','en'].includes(input.language)) throw new Error('Invalid search');
      return {method:'POST',path:'/api/research/search',body:{query:input.query.trim(), language:input.language}};
    }
    case 'save': {
      if (typeof input.title !== 'string' || !input.title.trim() || input.title.length>200 || !['pl','en'].includes(input.language)) throw new Error('Invalid article');
      return {method:'POST',path:'/api/research/save',body:{title:input.title.trim(),language:input.language}};
    }
    case 'delete': {
      if (typeof input.id!=='string' || !UUID.test(input.id)) throw new Error('Invalid UUID');
      return {method:'DELETE',path:'/api/research/'+input.id};
    }
    default: throw new Error('Unsupported research operation');
  }
}
async function performResearch(input,token,fetchImpl=fetch) {
  const route = routeResearch(input);
  if (typeof token!=='string' || !TOKEN.test(token)) return {ok:false,status:401,error:'NO_SESSION'};
  try {
    const response = await fetchImpl(BASE+route.path,{
      method:route.method, headers:{'X-Jarvis-Session':token,...(route.body?{'Content-Type':'application/json'}:{})},
      ...(route.body?{body:JSON.stringify(route.body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000),
    });
    if (response.status===204) return {ok:true,status:204,data:null};
    if (!(response.headers?.get?.('content-type')||'').includes('application/json')) return {ok:false,status:response.status,error:'INVALID_RESPONSE'};
    const data=await response.json();
    return response.ok?{ok:true,status:response.status,data}:{ok:false,status:response.status,error:data?.code||'REQUEST_FAILED'};
  } catch { return {ok:false,status:0,error:'RESEARCH_BACKEND_UNAVAILABLE'}; }
}
function registerResearchIpc(ipcMain,trustedSender,tokenSource=()=>process.env.JARVIS_SESSION_TOKEN) {
  ipcMain.handle('jarvis:research-api',async(event,request)=>{
    if (!trustedSender(event)) throw new Error('Untrusted IPC sender');
    return performResearch(request,tokenSource());
  });
}
function allowedSourceUrl(raw) {
  if (typeof raw !== 'string' || raw.length>900) throw new Error('Invalid source');
  let u; try { u=new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (u.protocol!=='https:' || u.port || u.username || u.password ||
      !['pl.wikipedia.org','en.wikipedia.org'].includes(u.hostname) ||
      !u.pathname.startsWith('/wiki/') || u.search || u.hash)
    throw new Error('Unapproved source URL');
  return u.href;
}
function registerResearchOpenIpc(ipcMain, trustedSender, shell) {
  ipcMain.handle('jarvis:research-open-source', async(event,url) => {
    if (!trustedSender(event)) throw new Error('Untrusted IPC sender');
    await shell.openExternal(allowedSourceUrl(url));
    return true;
  });
}
module.exports={routeResearch,performResearch,registerResearchIpc,allowedSourceUrl,registerResearchOpenIpc};
