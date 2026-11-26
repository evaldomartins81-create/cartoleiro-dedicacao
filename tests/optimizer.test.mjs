import test from "node:test";
import assert from "node:assert/strict";
import {FORMATIONS,normalizeMarket,optimize,cents} from "../public/optimizer.mjs";
import fs from "node:fs";
const POS={1:10,2:35,3:35,4:60,5:50,6:10};
const sample=Object.entries(POS).flatMap(([position,count])=>Array.from({length:count},(_,i)=>({
  atleta_id:10000+Number(position)*100+i,posicao_id:Number(position),status_id:7,clube_id:100+i%20,
  preco_num:1+(i%15)/2,media_num:2+(i%9),pontos_num:3+(i%7),jogos_num:8
})));
test("all seven official formation layouts have 11 players plus coach",()=>{
  assert.equal(Object.keys(FORMATIONS).length,7);
  for(const [key,positions] of Object.entries(FORMATIONS)){
    assert.equal(Object.values(positions).reduce((a,b)=>a+b,0),10,key);
  }
});
test("realistic budget, unique athlete, correct formation and reserve caps",()=>{
  for(const formation of Object.keys(FORMATIONS)){
    for(const strategy of ["mitada","segura","valor"]){
      const r=optimize({athletes:sample,budget:152,formation,strategy});
      assert.equal(r.team.length,12);assert.ok(r.total<=152);
      assert.equal(new Set(r.team.map(p=>p.atleta_id)).size,12);
      assert.equal(r.team.filter(p=>p.posicao_id===1).length,1);
      assert.equal(r.team.filter(p=>p.posicao_id===6).length,1);
      for(const [pos,count] of Object.entries(FORMATIONS[formation]))assert.equal(r.team.filter(p=>p.posicao_id===Number(pos)).length,count,formation+" "+pos);
      for(const reserve of r.bench){
        assert.ok(!r.team.some(p=>p.atleta_id===reserve.atleta_id));
        const starterPrices=r.team.filter(p=>p.posicao_id===reserve.posicao_id).map(p=>cents(p.preco_num));
        assert.ok(cents(reserve.preco_num)<=Math.min(...starterPrices));
      }
      assert.notEqual(r.captain.posicao_id,6);
    }
  }
});
test("rejects impossible funds and insufficient athletes",()=>{
  assert.throws(()=>optimize({athletes:sample,budget:1}),/patrimônio mínimo/i);
  assert.throws(()=>optimize({athletes:[],budget:152}),/prováveis suficientes/i);
  assert.throws(()=>optimize({athletes:sample,budget:0}),/patrimônio válido/i);
});
test("normalization rejects empty markets",()=>{
  assert.throws(()=>normalizeMarket({atletas:[]}),/incompletos/i);
});
test("when official snapshot exists it must make a genuine valid lineup",()=>{
  const file=new URL("../public/data/atletas.json",import.meta.url);
  if(!fs.existsSync(file))return;
  const live=JSON.parse(fs.readFileSync(file,"utf8"));
  const {athletes}=normalizeMarket(live);
  assert.ok(athletes.length>=100);
  for(const f of Object.keys(FORMATIONS)){
    const result=optimize({athletes,budget:152,formation:f,strategy:"mitada"});
    assert.equal(result.team.length,12);assert.ok(result.total<=152);
  }
});
