const routes={status:"/mercado/status",atletas:"/atletas/mercado",clubes:"/clubes",partidas:"/partidas",pontuados:"/atletas/pontuados"};
export async function onRequestGet({params}) {
 const path=routes[params.resource];
 if(!Object.hasOwn(routes,params.resource)) return Response.json({error:"Recurso inválido"},{status:404});
 try {
 const r=await fetch("https://api.cartola.globo.com"+path,{headers:{Accept:"application/json"},cf:{cacheTtl:60,cacheEverything:true}});
 if(!r.ok) throw Error("HTTP "+r.status);
 return Response.json(await r.json(),{headers:{"Cache-Control":"public, max-age=60"}});
 } catch(e){return Response.json({error:"Dados do Cartola indisponíveis"},{status:502});}
}