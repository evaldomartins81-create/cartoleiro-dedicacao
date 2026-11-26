import {onRequestGet} from "./functions/api/[resource].js";

const SNAPSHOTS={atletas:"atletas",status:"status",partidas:"partidas"};
const headers={"Cache-Control":"public, max-age=90","X-Content-Type-Options":"nosniff"};
async function getAsset(env,request,path){
  return env.ASSETS.fetch(new Request(new URL(path,request.url),{method:"GET"}));
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if(request.method!=="GET")return new Response("Method not allowed",{status:405});
    const resource=url.pathname.slice(5);
    if(resource==="health"){
      let meta=null;
      try{const r=await getAsset(env,request,"/data/meta.json");if(r.ok)meta=await r.json()}catch{}
      const age=meta?Math.floor((Date.now()-Date.parse(meta.fetched_at))/60000):null;
      return Response.json({service:"cartoleiro-dedicacao",snapshot_available:!!meta,snapshot_age_minutes:age,round:meta?.round??null,snapshot_fresh:age!==null&&age>=0&&age<=120},{headers:{"Cache-Control":"no-store"}});
    }
    if(!Object.hasOwn(SNAPSHOTS,resource))return Response.json({error:"Recurso inválido"},{status:404});
    let age=Infinity;
    try{
      const metaResponse=await getAsset(env,request,"/data/meta.json");
      if(metaResponse.ok){
        const meta=await metaResponse.json();
        age=(Date.now()-Date.parse(meta.fetched_at))/60000;
      }
    }catch{}
    async function snapshot(){
      const r=await getAsset(env,request,"/data/"+SNAPSHOTS[resource]+".json");
      if(!r.ok)return null;
      const h=new Headers(headers);
      h.set("X-Data-Source","official-snapshot");
      h.set("X-Snapshot-Age-Minutes",String(Math.max(0,Math.round(age))));
      return new Response(r.body,{status:200,headers:h});
    }
    if(age>=0 && age<=120){
      try{const r=await snapshot();if(r)return r}catch{}
    }
    try{
      const live=await onRequestGet({params:{resource}});
      if(live.ok)return live;
    }catch{}
    if(age>=0 && age<=1440){
      try{const r=await snapshot();if(r)return r}catch{}
    }
    return Response.json({error:"Dados oficiais indisponíveis ou desatualizados",reason:"Sem atualização oficial válida nas últimas 24 horas"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
};