'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const coreContext={window:{}};
vm.runInNewContext(fs.readFileSync('lfa-stats-core.js','utf8'),coreContext);
const core=coreContext.window.LFA_STATS_CORE;
const raw=[{player_id:'100',stats:{pts_ppr:200},player:{position:'RB'}},{player_id:'101',stats:{pts_ppr:190},player:{position:'RB'}},{player_id:'102',stats:{pts_ppr:200},player:{position:'RB'}},{player_id:'103',stats:{pts_ppr:210},player:{position:'WR'}}];
const mapped=core.mapPpr(raw),ranks=core.ranks(mapped.points,mapped.positions);
assert.equal(mapped.points['100'],200);
assert.equal(ranks['100'],'RB1');assert.equal(ranks['102'],'RB1');assert.equal(ranks['101'],'RB3');assert.equal(ranks['103'],'WR1');
assert.deepEqual(JSON.parse(JSON.stringify(core.totalProjected(['100','101'],mapped.points))),{available:2,required:2,complete:true,total:390});
assert.equal(core.totalProjected(['100','999'],mapped.points).complete,false);
assert.equal(core.nflCode('JAC'),'JAX');assert.equal(core.nflCode('WSH'),'WAS');
const html=fs.readFileSync('index.html','utf8');
for(const fragment of ['id="goNextWeek"','season-top-grid','Rumbo a los playoffs','diario-paper-cover','assets/lfa.webp','id="matchupsLive"','lfa-stats-core.js','lfa-v6.js']){
 assert.ok(html.includes(fragment),'Falta elemento '+fragment);
}
assert.equal((html.match(/id="standingsLive"/g)||[]).length,1);
const snapshot=JSON.parse(fs.readFileSync('data/live_snapshot.json','utf8'));
const boot=fs.readFileSync('data/bootstrap.js','utf8');
const D=JSON.parse(boot.trim().replace(/^window\.LFA_DATA\s*=\s*/,'').replace(/;$/,''));
const refs={};
function el(id){
 if(!refs[id])refs[id]={id,innerHTML:'',textContent:'',value:id==='draftRound'?'all':id==='weekSelect'?String(snapshot.week):'',
 options:[],children:[],addEventListener:()=>{},querySelectorAll:()=>[],querySelector:()=>null};
 return refs[id];
}
const live={
 ...snapshot,ready:false,currentWeek:snapshot.week,selectedWeek:snapshot.week,
 players:snapshot.players,rosters:snapshot.rosters,matchups:snapshot.matchups,draft:snapshot.draft,picks:snapshot.picks
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(Number(n))?Number(n).toFixed(2):'—';
const byRoster=rid=>live.rosters.find(r=>String(r.roster_id)===String(rid));
const roster=rid=>byRoster(rid);
const sortedRosters=()=>live.rosters.slice().sort((a,b)=>(b.settings?.wins||0)-(a.settings?.wins||0));
const userName=rid=>{
 const r=byRoster(rid),u=live.users.find(x=>String(x.user_id)===String(r?.owner_id));
 return u?.metadata?.team_name||u?.display_name||'Equipo '+rid;
};
function assigned(r){
 if(!r)return null;
 const name=userName(r.roster_id);
 const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 return D.franchises.find(f=>[f.name,f.manager,...(f.aliases||[])].some(alias=>normalize(alias)===normalize(name)))||
 D.franchises[Number(r.roster_id)-1];
}
const logoImg=id=>'<img alt="'+esc(id)+'" src="assets/'+esc(id)+'.webp">';
const rchip=rid=>'<span class="cellteam">'+(assigned(byRoster(rid))?logoImg(assigned(byRoster(rid)).id):'')+'<span>'+esc(assigned(byRoster(rid))?.name||userName(rid))+'</span></span>';
const playerName=id=>live.players[String(id)]?.name||'Player '+id;
const titles=id=>D.seasons.filter(s=>s.official&&s.champion_franchise_id===id).length;
const table=(heads,rows)=>'<table><thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+
 rows.map(row=>'<tr>'+row.map(value=>'<td>'+value+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const points=r=>Number(r?.settings?.fpts||0);
const record=r=>({wins:r.settings?.wins||0,losses:r.settings?.losses||0,pf:points(r)});
const matchupPairs=w=>{const groups={};for(const r of live.matchups[w]||[])(groups[r.matchup_id]||=[]).push(r);return Object.values(groups).filter(x=>x.length===2)};
const windowObj={LFA_STATS_CORE:core,LFA_V4:{openMatch:null,selectedRoster:null},renderStandings:()=>undefined,renderAll:()=>undefined,renderHistory:()=>undefined};
const context={
 window:windowObj,document:{getElementById:el,addEventListener:()=>{}},
 live,D,esc,fmt,roster,assigned,logoImg,rchip,record,sortedRosters,matchupPairs,playerName,titles,table,
 rname:userName,typeName:type=>type,dt:()=> 'Fecha',
 console,fetch:async()=>{throw Error('No se debe usar la red durante el test')},setTimeout:()=>null,clearTimeout:()=>{},sessionStorage:{getItem:()=>null,setItem:()=>{}},
 Event:function(){},Date,Math,Number,String,Array,Object,Map,Set,
};
vm.runInNewContext(fs.readFileSync('lfa-v6.js','utf8'),context);
live.ready=true;
windowObj.LFA_V4.selectedRoster=String(live.rosters[0].roster_id);
windowObj.v4RenderRosters();
assert.ok(el('rosterGrid').innerHTML.includes('PTS PPR 2026'),'No aparece PPR total en Rosters');
assert.ok(el('rosterGrid').innerHTML.includes('Rank PPR'),'No aparece ranking PPR');
assert.ok(!el('rosterGrid').innerHTML.includes('<th>Estado</th>'),'Persistió columna Estado');
assert.ok(!el('rosterGrid').innerHTML.includes('<th>Proyección PPR</th>'),'Persistió proyección en Rosters');
assert.ok(el('rosterGrid').innerHTML.includes('roster-nfl-shield'),'Faltan escudos NFL');
windowObj.v4RenderDraft();
const draft=el('draftData').innerHTML;
assert.ok(draft.includes('draft-slot-franchise'),'No se identificó la franquicia de cada turno');
assert.ok((draft.match(/class="draft-slot-franchise"/g)||[]).length===8,'Deben existir ocho cabeceras de franquicia');
assert.ok(!draft.includes('Pick 1')&&!draft.includes('Turno 1'),'Sigue apareciendo Pick 1 o Turno 1');
assert.ok(draft.includes('draft-nfl-shield'),'Falta el logo NFL junto a los picks');
windowObj.v4RenderBracket();
assert.ok(el('playoffView').innerHTML.includes('lfa-ring-icon'),'El playoff no tiene anillo');
assert.ok(!el('playoffView').innerHTML.includes('🏆'),'Se mantiene el trofeo anterior');
windowObj.v4RenderMatchups();
assert.ok(el('matchupsLive').innerHTML.includes('matchbox-clickable'),'No se cargaron partidos');
const sample=matchupPairs(live.currentWeek)[0][0];
assert.ok(windowObj.v4GameLineup(sample,live.currentWeek).includes('Rival NFL'),'No se añadió rival NFL');
assert.ok(windowObj.v4GameLineup(sample,live.currentWeek).includes('Proy. PPR'),'No se añadió proyección');
const added='9221';
live.players[added]={name:'Jugador de prueba',position:'RB',team:'DET'};
const transaction=windowObj.txDetail({type:'waiver',status:'complete',adds:{[added]:1},drops:{},roster_ids:[1]});
assert.ok(transaction.includes('Jugador de prueba (DET)'),'El mercado no identifica equipo NFL');
windowObj.renderStandings();
assert.ok(el('titleChart').innerHTML.includes('lfa-ring-icon'),'Historia no utiliza anillos');
const order=Object.entries(snapshot.draft.draft_order);
assert.equal(order.length,8,'Deben mapearse ocho turnos');
assert.equal(new Set(order.map(x=>x[1])).size,8,'Orden de turnos duplicado');
console.log('OK: Portada, Temporada, Rosters, Mercado, ocho columnas de Draft, logo NFL, anillos y core PPR.');
