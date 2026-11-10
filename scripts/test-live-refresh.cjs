'use strict';
/* Verificación en memoria de los refrescos directos; no necesita consultar Sleeper ni ESPN. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const intervals=[],events={},calls={scoreboard:0,matchups:0,rosters:0,transactions:0};
const D={league:{current_season:2026,sleeper_league_id:'LEAGUE-TEST'}};
const live={ready:true,league:{season:'2026'},currentWeek:10,selectedWeek:10,nfl:{season_type:'regular'},syncedAt:null,
 matchups:{10:[{roster_id:1,matchup_id:1,points:0},{roster_id:2,matchup_id:1,points:0}]},
 rosters:[{roster_id:1},{roster_id:2}],transactions:{}};
const document={
 hidden:false,
 getElementById:id=>id==='transactionWeek'?{value:'all'}:null,
 addEventListener:(name,fn)=>events[name]=fn
};
const painted={table:0,games:0,rosters:0,market:0};
const window={renderStandings:()=>painted.table++,v4RenderMatchups:()=>painted.games++,
 v4RenderRosters:()=>painted.rosters++,renderTransactions:()=>painted.market++};
const fetch=async url=>{
 if(url.includes('/scoreboard?')){
  calls.scoreboard++;
  return {ok:true,json:async()=>({events:[{status:{type:{state:'in'}}}]})};
 }
 if(url.includes('/matchups/10')){
  calls.matchups++;
  return {ok:true,json:async()=>[{roster_id:1,matchup_id:1,points:140.2},{roster_id:2,matchup_id:1,points:130.7}]};
 }
 if(url.endsWith('/rosters')){
  calls.rosters++;
  return {ok:true,json:async()=>[{roster_id:1},{roster_id:2}]};
 }
 if(url.includes('/transactions/10')){
  calls.transactions++;
  return {ok:true,json:async()=>[{type:'trade',status:'complete',roster_ids:[1,2]}]};
 }
 throw Error('URL inesperada: '+url);
};
const context={D,live,window,document,fetch,console,AbortController,
 setTimeout:()=>1,clearTimeout:()=>{},
 setInterval:(fn,ms)=>{intervals.push({fn,ms});return intervals.length},
 clearInterval:()=>{},Date,Intl,Promise};
vm.runInNewContext(fs.readFileSync('lfa-live-refresh.js','utf8'),context);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 for(let i=0;i<6;i++)await flush();
 assert.ok(intervals.some(x=>x.ms===60_000),'Falta ciclo de 60 segundos');
 assert.ok(intervals.some(x=>x.ms===300_000),'Falta ciclo de Mercado de 5 minutos');
 assert.ok(calls.scoreboard>0,'No se consultó estado de NFL');
 assert.ok(calls.matchups>0,'No se consultaron los puntos');
 assert.ok(calls.transactions>0,'No se consultaron transacciones');
 assert.equal(live.matchups[10][0].points,140.2);
 assert.equal(live.transactions[10][0].type,'trade');
 assert.ok(painted.table>0&&painted.games>0&&painted.market>0);
 document.hidden=true;
 const before={...calls};
 for(const entry of intervals)entry.fn();
 for(let i=0;i<4;i++)await flush();
 assert.deepEqual(calls,before,'No debe consultar cuando la pestaña está oculta');
 document.hidden=false;
 events.visibilitychange();
 for(let i=0;i<6;i++)await flush();
 assert.ok(calls.matchups>before.matchups,'Al volver a la pestaña se deben actualizar puntos');
 console.log('OK: 60 segundos en juego, Mercado 5 minutos, datos directos y pausa con pestaña oculta.');
})().catch(e=>{console.error(e);process.exitCode=1});
