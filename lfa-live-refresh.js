/* LFA: consultas directas a Sleeper. No publica archivos ni consume deploys de Netlify. */
(function initLfaLiveRefresh(){
 'use strict';
 const API='https://api.sleeper.app/v1/';
 const SCORE_MS=60*1000,MARKET_MS=5*60*1000,BOARD_MS=5*60*1000;
 const state={gameActive:false,boardChecked:0,scoreBusy:false,marketBusy:false,scoreLast:0,marketLast:0,errors:0};
 window.LFA_LIVE_REFRESH=state;
 const now=()=>Date.now();
 const active=()=>!document.hidden&&live.ready&&live.league&&
  String(live.league.season)===String(D.league.current_season);
 const validWeek=()=>Math.max(1,Math.min(18,Number(live.currentWeek)||1));
 async function json(url,timeout=12000){
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),timeout);
  try{
   const response=await fetch(url,{cache:'no-store',signal:ac.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   return await response.json();
  }finally{clearTimeout(timer)}
 }
 const leagueURL=(suffix)=>API+'league/'+encodeURIComponent(String(D.league.sleeper_league_id))+'/'+suffix;
 function easternDate(){
  const parts=new Intl.DateTimeFormat('en-US',{
   timeZone:'America/New_York',weekday:'short',month:'2-digit',hour:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map(x=>[x.type,x.value]));
 }
 function fallbackGameWindow(){
  const d=easternDate(),hour=Number(d.hour),month=Number(d.month);
  if(![1,2,9,10,11,12].includes(month))return false;
  return (d.weekday==='Sun'&&(hour>=9||hour<2))||
   (d.weekday==='Thu'&&(hour>=19||hour<2))||
   (d.weekday==='Mon'&&(hour>=19||hour<2))||
   (d.weekday==='Sat'&&(month===12||month===1)&&hour>=12);
 }
 async function inspectScoreboard(force=false){
  if(!active()||(!force&&now()-state.boardChecked<BOARD_MS))return;
  state.boardChecked=now();
  try{
   const w=validWeek(),season=Number(D.league.current_season);
   const seasonType=String(live.nfl?.season_type||'regular').toLowerCase()==='post'?3:2;
   const url='https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates='+
    season+'&seasontype='+seasonType+'&week='+w;
   const board=await json(url,10000);
   const events=Array.isArray(board.events)?board.events:[];
   state.gameActive=events.some(e=>{
    const t=e.status?.type||e.competitions?.[0]?.status?.type||{};
    return t.state==='in'||t.name==='STATUS_IN_PROGRESS'||t.completed===false&&t.description==='In Progress';
   });
  }catch(e){
   // Si ESPN falla, se consulta a Sleeper durante las ventanas habituales de partidos.
   state.gameActive=fallbackGameWindow();
   console.warn('[LFA] Calendario NFL no disponible:',e.message);
  }
 }
 async function updateScores(force=false){
  if(!active()||state.scoreBusy||(!force&&!state.gameActive))return;
  if(!force&&now()-state.scoreLast<SCORE_MS-2000)return;
  state.scoreBusy=true;
  try{
   const w=validWeek(),[matchups,rosters]=await Promise.all([
    json(leagueURL('matchups/'+w)),json(leagueURL('rosters'))
   ]);
   if(!Array.isArray(matchups)||matchups.length<live.rosters.length||!Array.isArray(rosters)||rosters.length!==live.rosters.length)
    throw Error('Respuesta incompleta de Sleeper');
   if(String(live.league.season)!==String(D.league.current_season))return;
   live.matchups[w]=matchups;
   live.rosters=rosters;
   live.syncedAt=new Date().toISOString();
   state.scoreLast=now();
   if(typeof window.renderStandings==='function')window.renderStandings();
   if(typeof window.v4RenderMatchups==='function')window.v4RenderMatchups();
   if(typeof window.v4RenderRosters==='function')window.v4RenderRosters();
   state.errors=0;
  }catch(e){
   state.errors++;
   console.warn('[LFA] Actualización de puntos pendiente:',e.message);
  }finally{state.scoreBusy=false}
 }
 async function updateMarket(force=false){
  if(!active()||state.marketBusy)return;
  if(!force&&now()-state.marketLast<MARKET_MS-2000)return;
  state.marketBusy=true;
  try{
   const current=validWeek(),selected=Number(document.getElementById('transactionWeek')?.value);
   const weeks=[...new Set([current,selected])].filter(w=>Number.isInteger(w)&&w>=1&&w<=18);
   const results=await Promise.all(weeks.map(w=>json(leagueURL('transactions/'+w))));
   for(let i=0;i<weeks.length;i++){
    if(!Array.isArray(results[i]))throw Error('Mercado incompleto');
    live.transactions[weeks[i]]=results[i];
   }
   state.marketLast=now();
   if(typeof window.renderTransactions==='function')window.renderTransactions();
  }catch(e){console.warn('[LFA] Consulta de mercado pendiente:',e.message)}
  finally{state.marketBusy=false}
 }
 async function tick(){
  if(!active())return;
  await inspectScoreboard();
  await updateScores();
 }
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden){
   inspectScoreboard(true).then(()=>updateScores(true)).catch(()=>{});
   updateMarket(true).catch(()=>{});
  }
 });
 // Esperar a la primera lectura completa: la inicialización de Sleeper ocurre en app.js.
 const start=()=>{
  if(!active())return;
  inspectScoreboard().then(()=>updateScores()).catch(()=>{});
  updateMarket().catch(()=>{});
 };
 start();
 const untilReady=setInterval(()=>{
  if(active()){clearInterval(untilReady);start()}
 },5000);
 setInterval(()=>{tick().catch(()=>{})},SCORE_MS);
 setInterval(()=>{updateMarket().catch(()=>{})},MARKET_MS);
})();
