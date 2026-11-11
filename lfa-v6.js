(function LfaV6(){
 'use strict';
 const $=id=>document.getElementById(id);
 const core=window.LFA_STATS_CORE;
 const weekCache=new Map(),season={points:{},positions:{},ranks:{},ready:false,loading:false},busy=new Set();
 window.LFA_V6={season,weekCache};
 const numeric=n=>typeof n==='number'&&Number.isFinite(n)?fmt(n):'—';
 const teamCode=v=>core.nflCode(v);
 function espnLogo(code,cls='nfl-shield'){
  const normalized=teamCode(code);
  const espn=normalized.toLowerCase();
  if(!/^[a-z]{2,3}$/.test(espn))return '';
  return `<img class="${cls}" loading="lazy" alt="Logo NFL ${esc(normalized)}" src="https://a.espncdn.com/i/teamlogos/nfl/500/${esc(espn)}.png" onerror="this.style.display='none'">`;
 }
 function statusLabel(v){
  const x=String(v||'').trim().toUpperCase();
  if(!x||['ACTIVE','HEALTHY','PROBABLE','P','NULL','NONE'].includes(x))return '';
  return ({QUESTIONABLE:'Q',DOUBTFUL:'D',OUT:'OUT',IR:'IR',INJURED_RESERVE:'IR',SUSPENDED:'SUSP',PUP:'PUP',NFI:'NFI'})[x]||x.slice(0,9);
 }
 function dateLocal(){return new Date().toLocaleDateString('es-AR')}
 async function getFeed(kind,week){
  const year=String(ACTIVE_SEASON);
  const prefix=kind==='stats'?'stats':'projections';
  const endpoints=kind==='stats'?[
   'https://api.sleeper.app/v1/stats/nfl/regular/'+year,
   'https://api.sleeper.com/stats/nfl/'+year+'?season_type=regular'
  ]:[
   'https://api.sleeper.app/v1/projections/nfl/regular/'+year+'/'+week,
   'https://api.sleeper.com/projections/nfl/'+year+'/'+week+'?season_type=regular'
  ];
  let error;
  for(const url of endpoints){
   try{
    const body=await getJSON(url,18000);
    if(core.mapPpr(body).points&&Object.keys(core.mapPpr(body).points).length)return body;
   }catch(e){error=e}
  }
  throw error||Error('Datos NFL PPR no publicados');
 }
 async function getJSON(url,ms=13000){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),ms);
  try{
   const r=await fetch(url,{signal:ctrl.signal});
   if(!r.ok)throw Error('HTTP '+r.status);
   return await r.json();
  }finally{clearTimeout(timer)}
 }
 async function fetchSeason(){
  if(season.ready||season.loading)return;
  season.loading=true;
  const key='lfa_'+ACTIVE_SEASON+'_ppr_totals_v6';
  let cached;
  try{cached=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
  try{
   const result=cached?.at&&Date.now()-cached.at<3*3600e3?cached.value:core.mapPpr(
    await getFeed('stats')
   );
   if(!Object.keys(result.points||{}).length)throw Error('PPR no publicado');
   season.points=result.points;season.positions=result.positions;
   season.ranks=core.ranks(result.points,result.positions,live.players);
   season.ready=true;
   try{sessionStorage.setItem(key,JSON.stringify({at:Date.now(),value:result}))}catch{}
  }catch(e){console.warn('[LFA] Totales PPR no disponibles:',e)}
  finally{season.loading=false;if(live.ready)v4RenderRosters()}
 }
 async function fetchWeek(week){
  const w=Number(week);
  if(!Number.isInteger(w)||w<1||w>18||busy.has(w)||weekCache.has(w))return;
  busy.add(w);
  const record={projections:{},opponents:{},haveProjection:false,haveSchedule:false};
  const tag='lfa_'+ACTIVE_SEASON+'_week_extras_'+w;
  let old;
  try{old=JSON.parse(sessionStorage.getItem(tag)||'null')}catch{}
  if(old?.at&&Date.now()-old.at<2*3600e3){weekCache.set(w,old.value);busy.delete(w);if(live.ready){window.v4RenderRosters();if(Number(live.selectedWeek)===w)window.v4RenderMatchups()}return}
  const [pr,sch]=await Promise.allSettled([
   getFeed('projections',w),
   getJSON('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates='+ACTIVE_SEASON+'&seasontype=2&week='+w,13000)
  ]);
  if(pr.status==='fulfilled'){
   record.projections=core.mapPpr(pr.value).points;
   record.haveProjection=Object.keys(record.projections).length>0;
  }
  if(sch.status==='fulfilled'&&Array.isArray(sch.value?.events)){
   record.haveSchedule=sch.value.events.length>0;
   for(const event of sch.value.events){
    const competitors=event.competitions?.[0]?.competitors||[];
    if(competitors.length!==2)continue;
    const a=competitors[0],b=competitors[1];
    const ac=teamCode(a.team?.abbreviation),bc=teamCode(b.team?.abbreviation);
    if(ac&&bc){
     record.opponents[ac]=(a.homeAway==='home'?'vs ':'@ ')+bc;
     record.opponents[bc]=(b.homeAway==='home'?'vs ':'@ ')+ac;
    }
   }
  }
  weekCache.set(w,record);busy.delete(w);
  try{sessionStorage.setItem(tag,JSON.stringify({at:Date.now(),value:record}))}catch{}
  if(live.ready){
   try{window.v4RenderRosters()}catch{}
   if(Number(live.selectedWeek)===w)try{window.v4RenderMatchups()}catch{}
  }
 }
 function ensureExtras(){
  if(!live.ready)return;
  fetchSeason();
  const w=Number(live.selectedWeek)||Number(live.currentWeek);
  if(w>=live.currentWeek)fetchWeek(w);
  fetchWeek(Math.min(18,live.currentWeek+1));
 }
 function marks(){
  const top=Math.min(Number(live.league?.settings?.playoff_teams||4),live.rosters.length);
  const rows=[...$('homeLive').querySelectorAll('.rank-row')];
  rows.forEach((row,i)=>{
   const qualified=i<top,slot=row.querySelector('.inline-logo');
   row.classList.toggle('playoff-spot',qualified);
   // El espacio del indicador es idéntico para los ocho equipos.
   // Va dentro de la columna del nombre, nunca como tercer hijo de la fila.
   const marker=slot?.querySelector('.playoff-gold-marker');
   if(marker){
    marker.classList.toggle('playoff-marker-empty',!qualified);
    marker.setAttribute('aria-hidden',String(!qualified));
   }else if(slot){
    slot.insertAdjacentHTML('afterbegin',
     '<span class="playoff-gold-marker'+(qualified?'':' playoff-marker-empty')+'" aria-hidden="'+(!qualified)+'" title="'+(qualified?'Zona de playoffs':'')+'">◆</span>');
   }
  });
  const tableRows=[...$('standingsLive').querySelectorAll('tbody tr')];
  tableRows.forEach((row,i)=>{
   row.classList.toggle('playoff-spot',i<top);
   if(i<top&&!row.querySelector('.playoff-gold-marker'))
    row.children[1]?.insertAdjacentHTML('afterbegin','<span class="playoff-gold-marker" title="Puesto de playoffs">◆</span>');
  });
  const last=$('liveStats').querySelector('.stat:last-child');
  if(last){const label=last.querySelector('span'),strong=last.querySelector('strong');if(label)label.textContent='Edición';if(strong)strong.textContent='EDICIÓN Nº'+(ACTIVE_SEASON-2018);last.classList.add('edition-stat')}
 }
 const oldStandings=window.renderStandings;
 window.renderStandings=function(...args){const result=oldStandings(...args);marks();return result};
 function nextWeek(){return Math.min(18,Number(live.selectedWeek||live.currentWeek||1)+1)}
 $('goNextWeek')?.addEventListener('click',()=>{
  const w=nextWeek();$('weekSelect').value=String(w);
  $('weekSelect').dispatchEvent(new Event('change',{bubbles:true}));
  fetchWeek(w);
 });
 window.v4RenderRosters=function(){
  const box=$('rosterGrid');
  if(!box||!live.ready||!live.rosters?.length)return;
  const state=window.LFA_V4;
  if(!live.rosters.some(r=>String(r.roster_id)===String(state.selectedRoster)))state.selectedRoster=String(sortedRosters()[0].roster_id);
  const current=roster(state.selectedRoster);
  if(!current)return;
  const players=(current.players||[]).map(String).filter(x=>x!=='0');
  const starts=(current.starters||[]).map(String).filter(x=>x!=='0');
  const reserve=new Set((current.reserve||[]).map(String));
  const sorted=players.slice().sort((a,b)=>(starts.includes(a)?0:reserve.has(a)?2:1)-(starts.includes(b)?0:reserve.has(b)?2:1)||String(live.players[a]?.position||'').localeCompare(String(live.players[b]?.position||''))||playerName(a).localeCompare(playerName(b)));
  const tabs=sortedRosters().map(r=>`<button class="roster-tab ${String(r.roster_id)===String(state.selectedRoster)?'selected':''}" type="button" data-roster-open="${esc(r.roster_id)}">${rchip(r.roster_id)}</button>`).join('');
  if(season.ready)season.ranks=core.ranks(season.points,season.positions,live.players);
  const rows=sorted.map(id=>{
   const p=live.players[id]||{},pos=esc(p.position||'—');
   const role=starts.includes(id)?'TITULAR':reserve.has(id)?'RESERVA':'SUPLENTE';
   const badge=statusLabel(p.injury_status);
   const health=badge?`<small class="roster-health" title="${esc(p.injury_status)}">${esc(badge)}</small>`:'';
   const player=`<span class="roster-player-cell">${espnLogo(p.team,'roster-nfl-shield')}<strong>${esc(playerName(id))}</strong>${health}</span>`;
   const total=season.ready&&Object.hasOwn(season.points,id)?numeric(season.points[id]):'—';
   const rank=season.ready?esc(season.ranks[id]||'—'):'—';
   return [`<span class="lineup-slot">${role}</span>`,`<b>${pos}</b>`,player,esc(p.team||'FA'),`<strong class="ppr-total">${total}</strong>`,`<b class="ppr-rank">${rank}</b>`];
  });
  box.innerHTML=`<div class="roster-switcher">${tabs}</div><div class="roster-header"><div><span class="eyetop">PLANTEL ${ACTIVE_SEASON}</span><h2>${rchip(current.roster_id)}</h2><p>${players.length} jugadores · ${starts.length} titulares · ${reserve.size} en reserva</p></div><span class="chip">PPR · ${season.ready?'Temporada ${ACTIVE_SEASON}':'Consultando estadísticas'}</span></div><div class="tablewrap roster-table">${table(['Rol','Pos.','Jugador','NFL','PTS PPR '+ACTIVE_SEASON,'Rank PPR'],rows)}</div><p class="roster-ranking-note">${season.ready?'Clasificación por posición entre jugadores NFL con estadísticas PPR registradas.':'Las estadísticas PPR están pendientes de la fuente; los valores no disponibles se muestran como —.'}</p>`;
 };
 function matchPlayer(id,role,week,points,projRow){
  const p=live.players[String(id)]||{},pid=String(id);
  const value=Object.hasOwn(points||{},pid)&&points[pid]!=null?Number(points[pid]):null;
  const predicted=projRow?.projections||{};
  const projection=Object.hasOwn(predicted,pid)?Number(predicted[pid]):null;
  const rival=projRow?.haveSchedule?(projRow.opponents[teamCode(p.team)]||'DESCANSA'):'—';
  const health=statusLabel(p.injury_status);
  return [`<span class="lineup-slot">${esc(role)}</span>`,
   `<span class="game-player">${espnLogo(p.team,'game-nfl-shield')}<span><strong>${esc(playerName(pid))}</strong><small>${esc(p.position||'')} · ${esc(p.team||'FA')}${health?' · '+esc(health):''}</small></span></span>`,
   `<span class="nfl-opponent">${esc(rival)}</span>`,
   Number.isFinite(value)?numeric(value):'—',
   Number.isFinite(projection)?numeric(projection):'—'];
 }
 window.v4GameLineup=function(row,week){
  const historical=week<live.currentWeek;
  const ids0=Array.isArray(row?.players)?row.players:[];
  const starts0=Array.isArray(row?.starters)?row.starters:[];
  const ids=(ids0.length?ids0:historical?[]:roster(row?.roster_id)?.players||[]).map(String).filter(x=>x&&x!=='0');
  const starts=(starts0.length?starts0:historical?[]:roster(row?.roster_id)?.starters||[]).map(String).filter(x=>x&&x!=='0');
  const bench=ids.filter(x=>!starts.includes(x));
  const pts=row?.players_points||{};
  const starterPoints=Array.isArray(row?.starters_points)?row.starters_points:[];
  const scoring={...pts};
  starts.forEach((id,i)=>{if(!Object.hasOwn(scoring,id)&&starterPoints[i]!=null)scoring[id]=starterPoints[i]});
  const extra=!historical?weekCache.get(week):null;
  const total=extra?core.totalProjected(starts,extra.projections):null;
  const projectionLabel=extra?.haveProjection&&total?.complete?numeric(total.total):'—';
  const positionSlots=live.league?.roster_positions||[];
  const playerRows=(players,isStarter)=>players.map((id,i)=>{
   const label=isStarter?positionSlots[starts.indexOf(id)]||live.players[id]?.position||'TIT':'BANCO';
   return matchPlayer(id,label,week,scoring,extra);
  });
  const projectionHead=historical?'':'<th>Proy. PPR</th>';
  const title=historical?'PTS':'PTS';
  const makeRows=(players,isStarter)=>{
   const raw=playerRows(players,isStarter);
   if(historical)return raw.map(x=>[x[0],x[1],x[3]]);
   return raw;
  };
  const col=historical?['Puesto','Jugador','PTS']:['Puesto','Jugador','Rival NFL','PTS','Proy. PPR'];
  const lineupTable=(players,isStarter)=>
   table(col,makeRows(players,isStarter)).replace('<table>',`<table class="matchup-player-table ${historical?'matchup-3cols':'matchup-5cols'}">`);
  return `<div class="lineup-team"><h4>${rchip(row.roster_id)} <em>${row.points!=null?numeric(Number(row.points)):'—'} pts</em></h4>${!historical?`<div class="team-projection">Proyección del equipo (PPR) · <b>${projectionLabel}</b>${total&&!total.complete?` <small>(${total.available}/${total.required} disponibles)</small>`:''}</div>`:''}
   <div class="lineup-label">TITULARES</div><div class="tablewrap lineup-scroll">${lineupTable(starts,true)}</div>
   <div class="lineup-label">SUPLENTES / BANCO</div><div class="tablewrap lineup-scroll">${lineupTable(bench,false)}</div>
   ${!starts.length?'<p class="muted small">Alineación todavía no publicada por Sleeper.</p>':''}</div>`;
 };
 window.v4RenderMatchups=function(){
  const w=Number(live.selectedWeek||live.currentWeek),pairs=matchupPairs(w);
  const focusedId=window.LFA_V4.openMatch;
  const focus=pairs.find(([a])=>w+'-'+a.matchup_id===focusedId);
  const renderPair=pair=>{
   const [a,b]=pair,key=w+'-'+a.matchup_id,open=window.LFA_V4.openMatch===key;
   const stage=w<live.currentWeek?'FINAL':w===live.currentWeek?'EN JUEGO':'PRÓXIMA FECHA';
   const projected=(row)=>{
    if(w<live.currentWeek)return '';
    const data=weekCache.get(w),starts=(row.starters?.length?row.starters:roster(row.roster_id)?.starters)||[];
    const obj=core.totalProjected(starts,data?.projections||{});
    return data?.haveProjection&&obj?.complete?`<small>Proy. ${numeric(obj.total)} PPR</small>`:'';
   };
   return `<div class="matchbox matchbox-clickable"><button type="button" class="match-open" data-open-match="${esc(key)}" aria-expanded="${open?'true':'false'}"><div class="muted small">SEMANA ${w} · ${stage} <span class="open-indicator">${open?'− Cerrar':'+ Ver alineaciones'}</span></div><div class="matchline">${rchip(a.roster_id)}<span class="match-score">${projected(a)}<b>${a.points==null?'—':numeric(Number(a.points))}</b></span></div><div class="divider"></div><div class="matchline">${rchip(b.roster_id)}<span class="match-score">${projected(b)}<b>${b.points==null?'—':numeric(Number(b.points))}</b></span></div></button>${open?`<div class="lineups-grid">${window.v4GameLineup(a,w)}${window.v4GameLineup(b,w)}</div>`:''}</div>`;
  };
  const shown=focus?[focus]:pairs;
  const topbar=focus?`<div class="matchup-detail-toolbar">
   <button type="button" data-close-match class="matchup-back-btn" aria-label="Cerrar enfrentamiento y volver a los cuatro partidos">← Volver a los ${pairs.length} partidos</button>
   <span>SEMANA ${w} · ENFRENTAMIENTO DETALLADO</span>
  </div>`:'';
  $('matchupsLive').innerHTML=pairs.length?topbar+`<div class="matchups-grid ${focus?'matchups-grid--focused':''}">${shown.map(renderPair).join('')}</div>`:'<div class="empty">Sleeper todavía no publicó los cruces completos de esta semana.</div>';
  $('homeWeekLabel').textContent='SEMANA '+live.currentWeek;
  const homePairs=matchupPairs(live.currentWeek);
  $('homeGames').innerHTML=homePairs.length?homePairs.map(([a,b])=>`<div class="matchbox"><button class="match-open" type="button" data-home-match="${esc(a.matchup_id)}"><div class="matchline">${rchip(a.roster_id)}<b>${a.points==null?'—':numeric(Number(a.points))}</b></div><div class="divider"></div><div class="matchline">${rchip(b.roster_id)}<b>${b.points==null?'—':numeric(Number(b.points))}</b></div><span class="open-indicator">Abrir partido ↗</span></button></div>`).join(''):'<div class="empty">Sin enfrentamientos publicados.</div>';
 };
 function ringSvg(){return `<span class="lfa-ring-lockup" role="img" aria-label="Anillo de campeón con escudo oficial LFA"><img src="assets/lfa-championship-ring.svg" class="lfa-ring-icon" alt="" aria-hidden="true" loading="lazy"><span class="lfa-ring-crest-window" aria-hidden="true"><img src="assets/lfa.webp" class="lfa-ring-official-crest" alt="" loading="lazy"></span></span>`}

 window.v4RenderBracket=function(){
  // La temporada 2026 conserva EXACTAMENTE el diseño vigente de cuatro clasificados.
  // Sólo al pasar a una liga real de 10 en 2027 se construye el cuadro flexible.
  if(ACTIVE_SEASON>=2027&&D.franchises.length===10){
   const bracket=Array.isArray(live.bracket)?live.bracket:[];
   const spots=Math.min(live.rosters.length,Math.max(2,Number(live.league?.settings?.playoff_teams||4)));
   const group=sortedRosters().slice(0,spots);
   const rounds=[...new Set(bracket.map(g=>Number(g.r||1)))].sort((a,b)=>a-b);
   const official=bracket.some(g=>g.t1!=null&&g.t2!=null);
   const roundGames=official?bracket.filter(g=>Number(g.r)===Math.min(...rounds)):[];
   const byes=!official&&spots===6?group.slice(0,2):[];
   const roundMarkup=roundGames.length?roundGames.map((g,i)=>`<div class="mini-semifinal"><small>CRUCE ${i+1}</small><div>${[g.t1,g.t2].map(id=>id==null?'<span class="pending-team">Por definir</span>':rchip(id)).join('<span class="playoff-vs">VS</span>')}</div></div>`).join(''):'<p class="muted small">Los cruces oficiales aparecerán cuando Sleeper publique el cuadro. No se inventan enfrentamientos.</p>';
   $('playoffView').innerHTML=`<div class="playoff-mini-head">${ringSvg()}<span>${official?'CUADRO OFICIAL DE SLEEPER':'ZONA DE CLASIFICACIÓN PROVISORIA'}</span></div>
    <p class="muted small playoff-teams-count">Clasifican ${spots} de ${live.rosters.length} equipos${byes.length?' · los primeros 2 tendrían descanso inicial':''}.</p>
    <div class="playoff-mini-grid">${roundMarkup}</div>
    <div class="playoff-final-note">${ringSvg()} <b>FINAL · POR EL ANILLO LFA</b></div>
    <div class="playoff-shortlist">${group.map((r,i)=>`<span class="playoff-shortlist-team"><b>${i+1}</b>${rchip(r.roster_id)}</span>`).join('')}</div>`;
   return;
  }
  const group=sortedRosters().slice(0,4),bracket=Array.isArray(live.bracket)?live.bracket:[];
  const official=bracket.some(g=>g.t1!=null&&g.t2!=null);
  const games=official?bracket.filter(g=>Number(g.r)===1).map(g=>[g.t1,g.t2]):group.length===4?[[group[0].roster_id,group[3].roster_id],[group[1].roster_id,group[2].roster_id]]:[];
  const rows=games.map((g,i)=>`<div class="mini-semifinal"><small>SEMIFINAL ${i+1}</small><div>${g.map(id=>id!=null?rchip(id):'<span class="pending-team">Por definir</span>').join('<span class="playoff-vs">VS</span>')}</div></div>`).join('');
  $('playoffView').innerHTML=`<div class="playoff-mini-head">${ringSvg()}<span>${official?'CUADRO PUBLICADO EN SLEEPER':'PROYECCIÓN SEGÚN LA TABLA ACTUAL'}</span></div><div class="playoff-mini-grid">${rows}</div><div class="playoff-final-note">${ringSvg()} <b>FINAL · POR EL ANILLO LFA</b></div><div class="playoff-shortlist">${group.map((r,i)=>`<span class="playoff-shortlist-team"><b>${i+1}</b>${rchip(r.roster_id)}</span>`).join('')}</div>`;
 };
 window.renderBracket=window.v4RenderBracket;
 window.renderMatchups=window.v4RenderMatchups;
 const previousTransaction=window.txDetail;
 window.txDetail=function(t){
  const nameWithNfl=pid=>{
   const team=live.players[String(pid)]?.team;
   return playerName(pid)+(team?' ('+teamCode(team)+')':'');
  };
  const sides=new Map();
  const put=(rid,kind,item)=>{
   const key=String(rid);
   if(!sides.has(key))sides.set(key,{adds:[],drops:[],picks:[],budget:[]});
   sides.get(key)[kind].push(item);
  };
  for(const [pid,rid] of Object.entries(t.adds||{}))put(rid,'adds',nameWithNfl(pid));
  for(const [pid,rid] of Object.entries(t.drops||{}))put(rid,'drops',nameWithNfl(pid));
  for(const p of t.draft_picks||[]){
   if(p.owner_id!=null)put(p.owner_id,'picks','Recibe elección R'+p.round+' ('+p.season+')');
   if(p.previous_owner_id!=null)put(p.previous_owner_id,'picks','Entrega elección R'+p.round+' ('+p.season+')');
  }
  for(const v of t.waiver_budget||[]){
   if(v.receiver!=null)put(v.receiver,'budget','Recibe $'+v.amount+' FAAB');
   if(v.sender!=null)put(v.sender,'budget','Entrega $'+v.amount+' FAAB');
  }
  for(const rid of t.roster_ids||[])if(!sides.has(String(rid)))put(rid,'picks','Operación registrada');
  const sections=[...sides].map(([rid,data])=>`<div class="market-side"><b>${rchip(rid)}</b>${data.adds.map(n=>`<p class="add">+ ${esc(n)}</p>`).join('')}${data.drops.map(n=>`<p class="drop">− ${esc(n)}</p>`).join('')}${data.picks.map(n=>`<p>⇄ ${esc(n)}</p>`).join('')}${data.budget.map(n=>`<p>${esc(n)}</p>`).join('')}</div>`).join('');
  return `<div class="market-entry"><div class="market-title"><span>${esc(typeName(t.type))}</span><span class="chip">${esc(dt(t.created||t.status_updated))}</span></div><div class="market-detail">${sections||'<span class="muted small">Sin desglose de jugadores.</span>'}</div>${t.settings?.waiver_bid!=null?`<small>Oferta waiver: ${esc(t.settings.waiver_bid)} FAAB</small>`:''}</div>`;
 };
 window.v4RenderDraft=function(){
  if(!live.draft){$('draftData').innerHTML='<div class="empty">Draft aún no disponible.</div>';return}
  const draft=live.draft,picks=live.picks.slice().sort((a,b)=>Number(a.pick_no)-Number(b.pick_no));
  const slots=Math.max(live.rosters.length||8,...picks.map(p=>Number(p.draft_slot)||0));
  const rounds=Math.max(Number(draft.settings?.rounds||0),...picks.map(p=>Number(p.round)||0));
  $('draftTotal').textContent=picks.length+' elecciones · '+rounds+' rondas';
  const select=$('draftRound'),old=select.value;
  select.innerHTML='<option value="all">Todas las rondas</option>'+Array.from({length:rounds},(_,i)=>`<option value="${i+1}">Ronda ${i+1}</option>`).join('');
  if([...select.options].some(x=>x.value===old))select.value=old;
  const slotToRoster=new Map();
  for(const [userId,slot] of Object.entries(draft.draft_order||{})){
   const owner=live.rosters.find(r=>String(r.owner_id)===String(userId));
   if(owner)slotToRoster.set(Number(slot),owner.roster_id);
  }
  for(const p of picks.filter(p=>Number(p.round)===1)){
   if(!slotToRoster.has(Number(p.draft_slot))){
    const owner=live.rosters.find(r=>String(r.owner_id)===String(p.picked_by));
    slotToRoster.set(Number(p.draft_slot),owner?.roster_id||p.roster_id);
   }
  }
  const owners=Array.from({length:slots},(_,i)=>{
   const rid=slotToRoster.get(i+1),f=assigned(roster(rid));
   return `<div class="draft-slot-owner"><div class="draft-slot-franchise">${f?logoImg(f.id,'draft-slot-shield'):''}<b>${esc(f?.name||rname(rid)||'Sin identificar')}</b></div></div>`;
  });
  const byKey=new Map(picks.map(p=>[p.round+'-'+p.draft_slot,p]));
  const rows=[];
  for(let r=1;r<=rounds;r++){
   if(select.value!=='all'&&String(r)!==select.value)continue;
   rows.push('<tr><td>R'+r+'</td>'+Array.from({length:slots},(_,i)=>{
    const p=byKey.get(r+'-'+(i+1));
    if(!p)return '<td><div class="pick unpicked">Sin elección</div></td>';
    const f=assigned(roster(p.roster_id)),pid=String(p.player_id||'');
    const pl=live.players[pid]||{},name=[p.metadata?.first_name,p.metadata?.last_name].filter(Boolean).join(' ')||playerName(pid);
    const pos=p.metadata?.position||pl.position||'—';
    const team=p.metadata?.team||pl.team;
    return `<td><div class="pick"><span class="draft-owner">${f?logoImg(f.id):''}<span>${esc(f?.name||rname(p.roster_id))}</span></span><span class="draft-player-line">${espnLogo(team,'draft-nfl-shield')}<strong class="player">${esc(name)}</strong></span><span class="draft-player-meta"><b>${esc(pos)}</b> · ${esc(teamCode(team)||'NFL')}</span></div></td>`;
   }).join('')+'</tr>');
  }
  $('draftData').innerHTML=`<div class="board-scroll"><table class="draftboard"><thead><tr><th>RONDA</th>${owners.map(s=>'<th>'+s+'</th>').join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
 };
 window.renderDraft=window.v4RenderDraft;
 function paintRings(){
  const target=$('titleChart');
  if(!target)return;
  const ranked=D.franchises.slice().sort((a,b)=>titles(b.id)-titles(a.id)||a.name.localeCompare(b.name));
  target.innerHTML=ranked.map(f=>{
   const count=titles(f.id);
   return `<div class="rank-row history-rings-row"><span class="inline-logo">${logoImg(f.id)}<strong>${esc(f.name)}</strong></span><span class="ring-display">${count?Array.from({length:count},()=>ringSvg()).join(''):'<small>Sin anillos</small>'}</span><b class="rings-number">${count}</b></div>`;
  }).join('');
 }
 const oldRenderAll=window.renderAll;
 window.renderAll=function(...args){const result=oldRenderAll(...args);marks();paintRings();ensureExtras();return result};
 const oldRenderHistory=window.renderHistory;
 if(typeof oldRenderHistory==='function')window.renderHistory=function(...args){const r=oldRenderHistory(...args);paintRings();return r};
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-close-match]')){
   window.LFA_V4.openMatch=null;
   window.v4RenderMatchups();
   return;
  }
  const go=event.target.closest('[data-page],[data-go]');
  if(go&&['rosters','temporada'].includes(go.dataset.page||go.dataset.go))ensureExtras();
 });
 $('weekSelect')?.addEventListener('change',()=>fetchWeek(Number($('weekSelect').value)));
 paintRings();
 if(live.ready){window.renderAll()}
})();
