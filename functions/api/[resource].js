const routes={status:"/mercado/status",atletas:"/atletas/mercado",clubes:"/clubes",partidas:"/partidas",pontuados:"/atletas/pontuados"};
export async function onRequestGet({params}) {
 if(!Object.hasOwn(routes,params.resource)) return Response.json({error:"Recurso inválido"},{status:404});
 const path=routes[params.resource];
 const fail=(reason,upstream_status=null)=>Response.json({error:"Dados do Cartola indisponíveis",reason,upstream_status},{status:502,headers:{"Cache-Control":"no-store"}});
 try {
 const r=await fetch("https://api.cartola.globo.com"+path,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});
 if(!r.ok) return fail("API retornou erro HTTP",r.status);
 let data;
 try {data=await r.json();} catch {return fail("Resposta da API não é JSON",r.status);}
 if(params.resource==="atletas"&&!Array.isArray(data?.atletas)) return fail("Formato de mercado inesperado",r.status);
 return Response.json(data,{headers:{"Cache-Control":"public, max-age=60"}});
 } catch(e){return fail(e?.name==="TimeoutError"?"Tempo limite excedido":"Falha de conexão com a API");}
}
