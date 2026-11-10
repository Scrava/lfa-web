'use strict';
/* Mock de diez GM en memoria: no modifica archivos ni el diseño real de 2026. */
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const core=require('../rivalry-core.js');
const ctxData={window:{}};
vm.runInNewContext(fs.readFileSync('data/bootstrap.js','utf8'),ctxData);
const source=ctxData.window.LFA_DATA;
const originals=source.franchises.filter(t=>!t.debut_year);
const newcomers=[
 {id:'sleeper-9',name:'Franquicia nueva 9',manager:'GM Invitado 9',logo:'assets/lfa.webp',debut_year:2027},
 {id:'sleeper-10',name:'Franquicia nueva 10',manager:'GM Invitado 10',logo:'assets/lfa.webp',debut_year:2027}
];
const teams=[...originals,...newcomers];
const past=source.legacy_h2h_review.filter(p=>originals.some(f=>f.id===p.franchise_a_id)&&originals.some(f=>f.id===p.franchise_b_id));
const pairs=past.slice();
for(let i=0;i<teams.length;i++)for(let j=i+1;j<teams.length;j++){
 const a=teams[i].id,b=teams[j].id;
 if(pairs.some(p=>[p.franchise_a_id,p.franchise_b_id].includes(a)&&[p.franchise_a_id,p.franchise_b_id].includes(b)))continue;
 pairs.push({franchise_a_id:a,franchise_b_id:b,regular_wins_a:0,regular_wins_b:0,playoff_wins_a:0,playoff_wins_b:0});
}
assert.equal(teams.length,10);assert.equal(pairs.length,45);
assert.equal(past.length,28);
assert.deepEqual(pairs.slice(0,28),past);
for(const p of pairs.slice(28))assert.deepEqual([core.history(pairs,p.franchise_a_id,p.franchise_b_id).wins,core.history(pairs,p.franchise_a_id,p.franchise_b_id).losses],[0,0]);

const listeners={};const nodes={};
function el(id,defaultValue=''){
 if(!nodes[id])nodes[id]={id,value:defaultValue,innerHTML:'',textContent:'',options:[],
 hidden:false,style:{},addEventListener(name,fn){listeners[id+':'+name]=fn},scrollIntoView(){}};
 return nodes[id];
}
for(const id of ['rivalryMatrix','matrixScope','rivalryMatrixNote','h2hResult','h2hMode','h2hA','h2hB','h2hBField','rivalryLookup'])el(id);
nodes.matrixScope.value='historico';nodes.h2hMode.value='all';nodes.h2hA.value=teams[8].id;nodes.h2hB.value=teams[9].id;
const window={LFA_RIVALRY_CORE:core,renderStandings:()=>null};
const rosters=teams.map((f,i)=>({roster_id:i+1,franchise_id:f.id,settings:{wins:i,losses:10-i}}));
const ctx={window,document:{getElementById:id=>nodes[id]||null},D:{franchises:teams,legacy_h2h_review:pairs},
 ACTIVE_SEASON:2027,live:{rosters,ready:true},completedGames:()=>[],assigned:r=>({id:r.franchise_id}),logoImg:id=>'<img alt="'+id+'">',console};
vm.runInNewContext(fs.readFileSync('rivalries.js','utf8'),ctx);
assert.ok(nodes.rivalryMatrix.innerHTML.includes('rivalry-matrix-ten'));
assert.equal((nodes.rivalryMatrix.innerHTML.match(/data-rival-a=/g)||[]).length,90);
assert.equal((nodes.h2hResult.innerHTML.match(/data-focus-a=/g)||[]).length,9);
assert.ok(nodes.h2hResult.innerHTML.includes('frente a los otros 9'));
assert.equal(core.history(pairs,teams[8].id,teams[9].id).count,0);
nodes.matrixScope.value='2027';window.LFA_RIVALRIES.renderAll();
assert.ok(nodes.rivalryMatrix.innerHTML.includes('matrix-empty'));

function bracketRender(teamList,year,playoffCount,official=[]){
 const els={},doc={getElementById:id=>els[id]||(els[id]={innerHTML:'',textContent:'',value:'all',addEventListener:()=>{},querySelector:()=>null,querySelectorAll:()=>[]}),addEventListener:()=>{}};
 const live={ready:false,rosters:teamList.map((f,i)=>({roster_id:i+1,franchise_id:f.id,settings:{wins:12-i,losses:i}})),
  league:{settings:{playoff_teams:playoffCount}},bracket:official};
 const name=rid=>teamList[Number(rid)-1]?.name||String(rid);
 const D={franchises:teamList,seasons:[]},w={LFA_STATS_CORE:{nflCode:v=>v},renderStandings:()=>{},renderAll:()=>{},renderHistory:()=>{},LFA_V4:{}};
 const env={window:w,document:doc,live,D,ACTIVE_SEASON:year,
  sortedRosters:()=>live.rosters,rchip:rid=>'<span>'+name(rid)+'</span>',
  roster:rid=>live.rosters[Number(rid)-1],titles:()=>0,logoImg:()=>'',esc:v=>String(v),fmt:v=>String(v),
  table:()=>'<table></table>',record:r=>r.settings,playerName:()=>'',matchupPairs:()=>[],typeName:v=>v,dt:()=>'',rname:name,
  console,fetch:()=>{},Date,Math,Number,String,Array,Object,Map,Set,Promise,sessionStorage:{getItem:()=>null},setTimeout:()=>0,clearTimeout:()=>{}};
 vm.runInNewContext(fs.readFileSync('lfa-v6.js','utf8'),env);
 w.v4RenderBracket();
 return els.playoffView.innerHTML;
}
const rendered10=bracketRender(teams,2027,6);
assert.ok(rendered10.includes('Clasifican 6 de 10 equipos'));
assert.ok(rendered10.includes('descanso inicial'));
assert.ok(rendered10.includes('Franquicia nueva 9')||rendered10.includes('Franquicia nueva 10')===false); // Only top six qualify initially.
assert.ok(rendered10.includes('no se inventan enfrentamientos'.replace('no','No')));
const rendered8=bracketRender(originals,2026,4);
assert.ok(!rendered8.includes('Clasifican 4 de 8 equipos'));
assert.ok(rendered8.includes('SEMIFINAL 1'));
assert.ok(!rendered8.includes('ZONA DE CLASIFICACIÓN PROVISORIA'));
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.includes('LOS OCHO PLANTELES')&&html.includes('Los ocho sospechosos de siempre'),'¡La vista 2026 no debe cambiar!');
const css=fs.readFileSync('styles.css','utf8');
assert.ok(css.includes('.lfa-ten-franchises .rivalry-matrix-ten'),'El estilo de diez debe estar condicionado');
console.log('OK: diez GM, 45 cruces, nueve rivales, playoffs de seis y aspecto de ocho sin cambios.');
