import {onRequestGet} from "./functions/api/[resource].js";

const DATA=Object.freeze({atletas:"atletas",status:"status",partidas:"partidas",meta:"meta"});
const OFFICIAL_CACHE="https://raw.githubusercontent.com/evaldomartins81-create/cartoleiro-dedicacao/main/public/data/";
const common={"Cache-Control":"public, max-age=90","Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff"};

async function asset(request,env,resource){
  return env.ASSETS.fetch(new Request(new URL("/data/"+resource+".json",request.url),{method:"GET"}));
}
async function github(resource){
  const url=OFFICIAL_CACHE+resource+".json";
  const r=await fetch(url,{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(7000),cf:{cacheTtl:90,cacheEverything:true}});
  if(!r.ok)return null;
  const payload=await r.text();
  if(payload.length<8)return null;
  const value=JSON.parse(payload);
  if(resource==="atletas"&&(!Array.isArray(value?.atletas)||value.atletas.length<100))return null;
  if(resource==="meta"&&(!value?.fetched_at||!value?.round))return null;
  if(resource==="status"&&!value?.rodada_atual)return null;
  if(resource==="partidas"&&!Array.isArray(value?.partidas))return null;
  return new Response(payload,{headers:{...common,"X-Data-Source":"github-official-snapshot"}});
}
async function snapshot(request,env,resource){
  try{const r=await github(resource);if(r)return r}catch{}
  try{
    const r=await asset(request,env,resource);
    if(r.ok)return new Response(r.body,{headers:{...common,"X-Data-Source":"deployed-official-snapshot"}});
  }catch{}
  return null;
}
function ageOf(meta){const age=(Date.now()-Date.parse(meta?.fetched_at))/60000;return Number.isFinite(age)&&age>=0?age:Infinity}
export default{
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method!=="GET"&&(url.pathname.startsWith("/api/")||url.pathname.startsWith("/data/")))
      return new Response("Method not allowed",{status:405});
    const dataMatch=/^\/data\/(meta|atletas|status|partidas)\.json$/.exec(url.pathname);
    if(dataMatch){
      const r=await snapshot(request,env,dataMatch[1]);
      return r||Response.json({error:"Dados oficiais indisponíveis"},{status:503,headers:{"Cache-Control":"no-store"}});
    }
    if(!url.pathname.startsWith("/api/"))return env.ASSETS.fetch(request);
    const resource=url.pathname.slice(5);
    let meta=null;
    try{const r=await snapshot(request,env,"meta");if(r)meta=await r.json()}catch{}
    const age=ageOf(meta);
    if(resource==="health")
      return Response.json({service:"cartoleiro-dedicacao",snapshot_available:!!meta,snapshot_age_minutes:Number.isFinite(age)?Math.floor(age):null,round:meta?.round??null,snapshot_fresh:age<=120},{headers:{"Cache-Control":"no-store"}});
    if(!Object.hasOwn(DATA,resource))
      return Response.json({error:"Recurso inválido"},{status:404});
    if(age<=120){
      const r=await snapshot(request,env,resource);
      if(r)return r;
    }
    if(resource!=="meta"){
      try{
        const live=await onRequestGet({params:{resource}});
        if(live.ok)return live;
      }catch{}
    }
    if(age<=1440){
      const r=await snapshot(request,env,resource);
      if(r)return r;
    }
    return Response.json({error:"Dados oficiais indisponíveis ou desatualizados"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
};
