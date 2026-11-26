export const FORMATIONS = Object.freeze({
  "3-4-3":{2:0,3:3,4:4,5:3},
  "3-5-2":{2:0,3:3,4:5,5:2},
  "4-3-3":{2:2,3:2,4:3,5:3},
  "4-4-2":{2:2,3:2,4:4,5:2},
  "4-5-1":{2:2,3:2,4:5,5:1},
  "5-3-2":{2:2,3:3,4:3,5:2},
  "5-4-1":{2:2,3:3,4:4,5:1}
});
export const POSITIONS={1:"Goleiro",2:"Lateral",3:"Zagueiro",4:"Meia",5:"Atacante",6:"Técnico"};
const number=v=>Number.isFinite(Number(v))?Number(v):0;
export const cents=n=>Math.round(number(n)*100);
export const price=n=>(cents(n)/100).toFixed(2).replace(".",",");
export function normalizeMarket(payload){
  if(!payload || !Array.isArray(payload.atletas) || payload.atletas.length<30) throw Error("Dados de atletas indisponíveis ou incompletos");
  const athletes=payload.atletas.filter(a=>a && Number.isFinite(Number(a.atleta_id)) && Number.isFinite(Number(a.posicao_id)) && Number.isFinite(Number(a.preco_num))).map(a=>({
    ...a, atleta_id:Number(a.atleta_id), posicao_id:Number(a.posicao_id), status_id:Number(a.status_id), clube_id:Number(a.clube_id),
    preco_num:number(a.preco_num),media_num:number(a.media_num),pontos_num:number(a.pontos_num),jogos_num:number(a.jogos_num)
  }));
  if(athletes.length<30) throw Error("Mercado incompleto");
  return {athletes,clubs:payload.clubes||{}};
}
export function potential(player,strategy="mitada",fixtures=[]){
  const games=Math.max(0,number(player.jogos_num));
  const avg=number(player.media_num);
  const last=number(player.pontos_num);
  const baseline=(avg*games+3.3*4)/(games+4);
  const recent=Math.max(-4,Math.min(5,last-baseline));
  const home=fixtures.some(f=>Number(f.clube_casa_id)===Number(player.clube_id))?0.25:0;
  if(strategy==="segura")return baseline+Math.min(recent,0)*0.35+home;
  if(strategy==="valor")return (baseline+recent*0.16+home)/Math.sqrt(Math.max(1,number(player.preco_num)));
  return baseline+Math.max(0,recent)*0.34+home;
}
export function optimize({athletes,budget,formation="4-3-3",strategy="mitada",fixtures=[]}){
  if(!FORMATIONS[formation])throw Error("Formação desconhecida.");
  if(!["mitada","segura","valor"].includes(strategy))throw Error("Estratégia inválida.");
  if(!Number.isFinite(Number(budget))||Number(budget)<=0)throw Error("Informe um patrimônio válido.");
  const cap=cents(budget);
  const slots=[1,6,...Object.entries(FORMATIONS[formation]).flatMap(([pos,count])=>Array(count).fill(Number(pos)))];
  const available=athletes.filter(p=>p.status_id===7&&Number(p.preco_num)>0&&Number.isFinite(Number(p.atleta_id)));
  const ids=new Set(available.map(p=>p.atleta_id));
  if(ids.size<12)throw Error("Não há atletas prováveis suficientes na rodada.");
  const unique=[...new Map(available.map(p=>[p.atleta_id,p])).values()];
  const pools={};
  for(const p of [1,2,3,4,5,6]){
    pools[p]=unique.filter(a=>a.posicao_id===p).sort((a,b)=>cents(a.preco_num)-cents(b.preco_num)||a.atleta_id-b.atleta_id);
    if(slots.includes(p) && pools[p].length<slots.filter(x=>x===p).length)throw Error("Não há atletas prováveis suficientes para "+POSITIONS[p]+".");
  }
  const picked=new Set();const team=[];
  for(const pos of slots){
    const candidate=pools[pos].find(a=>!picked.has(a.atleta_id));
    if(!candidate)throw Error("Mercado sem opções suficientes.");
    team.push(candidate);picked.add(candidate.atleta_id);
  }
  let total=team.reduce((sum,a)=>sum+cents(a.preco_num),0);
  if(total>cap)throw Error("O patrimônio mínimo para esta formação é C$ "+(total/100).toFixed(2).replace(".",",")+".");
  const score=a=>potential(a,strategy,fixtures);
  // Iterative budget-constrained improvements, never duplicate an athlete.
  for(let iteration=0;iteration<150;iteration++){
    let best=null;
    for(let i=0;i<team.length;i++){
      const current=team[i];
      const candidates=pools[current.posicao_id].filter(a=>!picked.has(a.atleta_id)&&total+cents(a.preco_num)-cents(current.preco_num)<=cap)
        .sort((a,b)=>score(b)-score(a)).slice(0,38);
      for(const a of candidates){
        const gain=score(a)-score(current);
        if(gain<=0.0001)continue;
        const delta=cents(a.preco_num)-cents(current.preco_num);
        const merit=gain/Math.max(100,delta>0?delta:100);
        if(!best||merit>best.merit||(merit===best.merit&&gain>best.gain))best={i,a,gain,delta,merit};
      }
    }
    if(!best)break;
    picked.delete(team[best.i].atleta_id);
    team[best.i]=best.a;picked.add(best.a.atleta_id);total+=best.delta;
  }
  const captain=team.filter(p=>p.posicao_id!==6).sort((a,b)=>score(b)-score(a))[0];
  const bench=[];
  for(const pos of [1,2,3,4,5]){
    const starters=team.filter(p=>p.posicao_id===pos);
    if(!starters.length)continue;
    const maximum=Math.min(...starters.map(p=>cents(p.preco_num)));
    const sub=pools[pos].filter(p=>!picked.has(p.atleta_id)&&cents(p.preco_num)<=maximum).sort((a,b)=>score(b)-score(a))[0];
    if(sub){bench.push(sub);picked.add(sub.atleta_id);}
  }
  if(total>cap || new Set(team.map(p=>p.atleta_id)).size!==12)throw Error("Não foi possível validar a escalação.");
  return {team,bench,captain,total:total/100,remaining:(cap-total)/100,score:team.reduce((sum,p)=>sum+score(p),0),formation,strategy,budget:Number(budget)};
}
