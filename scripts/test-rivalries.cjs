// Comprobaciones de integridad de Paternidades, sin dependencias externas.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../rivalry-core.js');
const hist=JSON.parse(fs.readFileSync('data/legacy_h2h_review.json','utf8'));
const data={window:{}};
vm.runInNewContext(fs.readFileSync('data/bootstrap.js','utf8'),data);
const teams=data.window.LFA_DATA.franchises;
assert.ok([8,10].includes(teams.length),'LFA solo admite ocho o diez equipos');
const expectedPairs=teams.length*(teams.length-1)/2;
assert.equal(hist.length,expectedPairs,'La matriz debe tener todos los cruces históricos');
const sum=[];
for(const a of teams)for(const b of teams){
 if(a.id===b.id)continue;
 const x=core.history(hist,a.id,b.id);
 const y=core.history(hist,b.id,a.id);
 assert.ok(x,'Falta cruce '+a.name+' vs '+b.name);
 assert.equal(x.wins,y.losses,'Victorias y derrotas asimétricas');
 assert.equal(x.losses,y.wins,'Derrotas y victorias asimétricas');
 assert.equal(x.wins,x.regular.wins+x.playoffs.wins,'Suma histórica incorrecta');
 assert.equal(x.losses,x.regular.losses+x.playoffs.losses,'Suma histórica incorrecta');
 sum.push([a.id,b.id,x.wins,x.losses]);
}
assert.equal(sum.length,teams.length*(teams.length-1));
const fixture=[{roster_id:11,franchise_id:'tiburoncin'},{roster_id:12,franchise_id:'boom-or-bust'}];
const games=[
 {a:11,b:12,pa:130,pb:122,type:'regular',week:1},
 {a:12,b:11,pa:100,pb:107,type:'regular',week:2},
 {a:11,b:12,pa:125,pb:125,type:'regular',week:3},
 {a:11,b:12,pa:170,pb:80,type:'playoffs',week:16}
];
const resolve=x=>x.franchise_id;
const before=core.season(fixture,games,resolve,'tiburoncin','boom-or-bust');
const reverse=core.season(fixture,games,resolve,'boom-or-bust','tiburoncin');
assert.deepEqual([before.wins,before.losses,before.ties,before.count],[2,0,1,3]);
assert.deepEqual([reverse.wins,reverse.losses,reverse.ties,reverse.count],[0,2,1,3]);
// Simula eventos y la navegación entre cuadro y buscador.
const listeners=new Map();
function el(id,value='',options=[]){
 const node={id,value,options,innerHTML:'',hidden:false,style:{},
  addEventListener(type,fn){listeners.set(id+':'+type,fn)},
  scrollIntoView(){node.scrolled=true}};
 return node;
}
const values={
 rivalryMatrix:el('rivalryMatrix'),matrixScope:el('matrixScope','historico'),
 rivalryMatrixNote:el('rivalryMatrixNote'),h2hResult:el('h2hResult'),
 h2hMode:el('h2hMode','duel'),h2hA:el('h2hA','tiburoncin',teams.map(t=>({value:t.id}))),
 h2hB:el('h2hB','boom-or-bust',teams.map(t=>({value:t.id}))),
 h2hBField:el('h2hBField'),rivalryLookup:el('rivalryLookup')
};
const windowMock={LFA_RIVALRY_CORE:core,renderStandings:()=>true};
const ctx={
 window:windowMock,document:{getElementById:id=>values[id]||null},
 D:{franchises:teams,legacy_h2h_review:hist},ACTIVE_SEASON:Number(data.window.LFA_DATA.league.current_season),
 live:{rosters:fixture,ready:true},
 completedGames:()=>games,
 assigned:r=>({id:r.franchise_id}),
 logoImg:id=>'<img alt="'+id+'">',
 console
};
vm.runInNewContext(fs.readFileSync('rivalries.js','utf8'),ctx);
const match=core.history(hist,'tiburoncin','boom-or-bust');
const expected=match.wins+'–'+match.losses;
assert.ok(values.rivalryMatrix.innerHTML.includes(expected),'La matriz no refleja el balance histórico');
assert.ok(values.h2hResult.innerHTML.includes(expected),'El buscador no refleja el mismo balance histórico');
values.h2hMode.value='all';
windowMock.LFA_RIVALRIES.renderLookup();
assert.equal((values.h2hResult.innerHTML.match(/data-focus-a=/g)||[]).length,teams.length-1,'La consulta contra todos los rivales falla');
values.h2hMode.value='duel';
values.matrixScope.value=String(data.window.LFA_DATA.league.current_season);
windowMock.LFA_RIVALRIES.renderAll();
assert.ok(values.rivalryMatrix.innerHTML.includes('2–0 (1 E)'),'Matriz 2026 incorrecta');
assert.ok(values.h2hResult.innerHTML.includes('2–0 (1 E)'),'Buscador 2026 diferente al cuadro');
listeners.get('rivalryMatrix:click')({target:{closest:()=>({dataset:{rivalA:'boom-or-bust',rivalB:'tiburoncin'}})}});
assert.equal(values.h2hA.value,'boom-or-bust','El clic en el cuadro no actualizó equipo');
assert.equal(values.h2hB.value,'tiburoncin','El clic en el cuadro no actualizó rival');
assert.ok(values.h2hResult.innerHTML.includes('0–2 (1 E)'),'La comparación invertida no coincide');
console.log('OK: '+expectedPairs+' cruces históricos, '+sum.length+' perspectivas, balance y buscador consistentes.');
