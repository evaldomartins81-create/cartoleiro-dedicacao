import {normalizeMarket,optimize,POSITIONS,price} from './optimizer.mjs';
const $=id=>document.getElementById(id);
let athletes=[],clubs={},fixtures=[],strategy='mitada',result=null;
const names={mitada:'Mitada',segura:'Segurança',valor:'Valorização'};
const club=id=>clubs[id]?.nome||clubs[id]?.abreviacao||String(id);
const name=a=>a.apelido||a.nome||String(a.atleta_id);
const money=n=>'C$ '+price(n);
function el(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e}
async function get(path){const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}
async function load(){
 $('generate').disabled=true;$('refresh').hidden=true;$('results').hidden=true;result=null;
 $('connection').className='connection';$('connection-text').textContent='Buscando jogadores da rodada…';
 try{
 const meta=await get('/data/meta.json');
 const age=(Date.now()-Date.parse(meta.fetched_at))/60000;
 if(!Number.isFinite(age)||age<0||age>1440)throw Error('Dados desatualizados');
 const [market,status,games]=await Promise.all(['atletas','status','partidas'].map(k=>get('/data/'+k+'.json')));
 if(Number(status.rodada_atual)!==Number(meta.round))throw Error('Rodada inconsistente');
 ({athletes,clubs}=normalizeMarket(market));fixtures=games.partidas||[];
 $('round').textContent=status.rodada_atual;$('market-state').textContent=status.status_mercado===1?'Aberto':'Fechado';$('athlete-count').textContent=athletes.length;
 $('connection').className='connection '+(age>120?'warn':'good');
 $('connection-text').textContent=(age>120?'Última atualização disponível (pode estar desatualizada): ':'Dados oficiais atualizados: ')+new Date(meta.fetched_at).toLocaleString('pt-BR');
 $('updated-time').textContent=$('connection-text').textContent;
 $('generate').disabled=age>120||status.status_mercado!==1;
 $('form-message').textContent=age>120?'Aguardando atualização automática.':status.status_mercado!==1?'Mercado fechado. Aguarde a abertura.':'';
 renderMarket();renderGames();
 }catch(e){athletes=[];fixtures=[];$('connection').className='connection warn';$('connection-text').textContent='Mercado indisponível. Tente novamente em instantes.';$('market-state').textContent='Indisponível';$('athlete-count').textContent='—';renderMarket();renderGames()}
 finally{$('refresh').hidden=false}
}
function renderMarket(){const q=$('search').value.toLowerCase(),p=$('position').value;const list=athletes.filter(a=>(!p||String(a.posicao_id)===p)&&(name(a)+' '+club(a.clube_id)+' '+POSITIONS[a.posicao_id]).toLowerCase().includes(q)).sort((a,b)=>b.media_num-a.media_num);const root=$('market-list');root.replaceChildren();for(const a of list.slice(0,150)){const row=el('div',null,'market-item'),left=el('div'),right=el('div',null,'market-values');left.append(el('strong',name(a)),el('small',club(a.clube_id)+' • '+POSITIONS[a.posicao_id]));right.append(el('strong',money(a.preco_num)),el('small','Média '+a.media_num.toFixed(2)));row.append(left,right);root.append(row)}if(!list.length)root.append(el('p','Nenhum atleta disponível.','hint'))}
function renderGames(){const root=$('games');root.replaceChildren();for(const f of fixtures){const row=el('div',null,'game');row.append(el('strong',club(f.clube_casa_id)+' × '+club(f.clube_visitante_id)),el('small',f.partida_data||''));root.append(row)}if(!fixtures.length)root.append(el('p','Confrontos indisponíveis.','hint'))}
function generate(){if($('generate').disabled)return;try{result=optimize({athletes,budget:Number($('budget').value),formation:$('formation').value,strategy,fixtures});$('form-message').textContent='';$('result-formation').textContent=result.formation;$('total-cost').textContent=money(result.total);$('remaining').textContent=money(result.remaining);$('result-strategy').textContent=names[strategy];const pitch=$('lineup');pitch.replaceChildren();for(const pos of [5,4,2,3,1,6]){const row=el('div',null,'pitch-row');for(const a of result.team.filter(x=>x.posicao_id===pos)){const card=el('div',null,'player'+(a.atleta_id===result.captain.atleta_id?' captain':''));card.append(el('strong',name(a)),el('small',club(a.clube_id)+' • '+POSITIONS[pos]),el('small','Média '+a.media_num.toFixed(2)),el('span',money(a.preco_num),'price'));row.append(card)}if(row.childElementCount)pitch.append(row)}const bench=$('bench');bench.replaceChildren();for(const a of result.bench){const row=el('div',null,'bench-item');row.append(el('span',name(a)+' • '+POSITIONS[a.posicao_id]),el('small',money(a.preco_num)));bench.append(row)}if(!result.bench.length)bench.append(el('p','Sem reservas elegíveis.','hint'));$('results').hidden=false;$('results').scrollIntoView({behavior:'smooth'})}catch(e){$('results').hidden=true;$('form-message').textContent=e.message}}
for(const b of document.querySelectorAll('[data-strategy]'))b.onclick=()=>{strategy=b.dataset.strategy;for(const x of document.querySelectorAll('[data-strategy]')){x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))}};
$('refresh').onclick=load;$('generate').onclick=generate;$('generate-again').onclick=generate;$('search').oninput=renderMarket;$('position').onchange=renderMarket;
$('copy-team').onclick=async()=>{if(!result)return;try{await navigator.clipboard.writeText(result.team.map(a=>POSITIONS[a.posicao_id]+': '+name(a)+(a.atleta_id===result.captain.atleta_id?' (C)':'')).join('\n')+'\nTotal: '+money(result.total));$('copy-team').textContent='Copiado!'}catch{$('copy-team').textContent='Não foi possível copiar'}};
load();setInterval(load,15*60*1000);
