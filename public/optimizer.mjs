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
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function prediction(p,fixtures=[]){
 const games=Math.max(0,number(p.jogos_num)), avg=number(p.media_num), last=number(p.pontos_num);
 const baseline=(avg*games+3.3*4)/(games+4);
 const f=fixtures.find(f=>[Number(f.clube_casa_id),Number(f.clube_visitante_id)].includes(Number(p.clube_id)));
 const home=f?Number(f.clube_casa_id)===Number(p.clube_id):null;
 const form=x=>Array.isArray(x)&&x.length?x.reduce((s,v)=>s+(v==="v"?3:v==="e"?1:0),0)/(3*x.length):null;
 const own=f?form(home?f.aproveitamento_mandante:f.aproveitamento_visitante):null;
 const opp=f?form(home?f.aproveitamento_visitante:f.aproveitamento_mandante):null;
 const rank=f?number(home?f.clube_casa_posicao:f.clube_visitante_posicao):0;
 const rival=f?number(home?f.clube_visitante_posicao:f.clube_casa_posicao):0;
 const strength=(own!==null&&opp!==null?(own-opp)*0.7:0)+(rank&&rival?(rival-rank)/19*0.55:0)+(home===null?0:home?0.18:-0.18);
 const rate=p.scout&&games>0?k=>Math.max(0,number(p.scout[k]))/games:null;
 const factor=Math.exp(clamp(strength,-1,1)*0.45);
 const goal=rate?1-Math.exp(-rate("G")*factor):null;
 const assist=rate?1-Math.exp(-rate("A")*factor):null;
 const sg=rate&&p.posicao_id<=3?clamp(rate("SG")*factor,0,0.95):null;
 const win=f&&rank&&rival&&own!==null&&opp!==null?1/(1+Math.exp(0.65-2*strength)):null;
 const recent=clamp(last-baseline,-4,5);
 const projection=baseline+recent*0.2+strength*(p.posicao_id<=3?1.4:1.1);
 return {projection,goal,assist,sg,win,strength,opponent:f?(home?f.clube_visitante_id:f.clube_casa_id):null,home,confidence:games>=15&&own!==null?"Maior cobertura de dados":"Dados limitados",reason:"Média ajustada "+baseline.toFixed(2)+"; "+(home===null?"confronto indisponível":home?"mandante":"visitante")+"; "+(own===null?"forma coletiva indisponível":"aproveitamento recente "+Math.round(own*100)+"%")};
}
export function potential(player,strategy="mitada",fixtures=[]){
 const p=prediction(player,fixtures);
 if(strategy==="segura")return p.projection-Math.max(0,10-number(player.jogos_num))*0.12;
 if(strategy==="valor")return p.projection/Math.sqrt(Math.max(1,number(player.preco_num)));
 return p.projection;
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
  const scores=new Map(unique.map(a=>[a.atleta_id,potential(a,strategy,fixtures)]));
  const score=a=>scores.get(a.atleta_id);
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
  return {predictions:Object.fromEntries(team.map(a=>[a.atleta_id,prediction(a,fixtures)])),projectedPoints:team.reduce((s,a)=>s+prediction(a,fixtures).projection,0)+prediction(captain,fixtures).projection,team,bench,captain,total:total/100,remaining:(cap-total)/100,score:team.reduce((sum,p)=>sum+score(p),0),formation,strategy,budget:Number(budget)};
}
