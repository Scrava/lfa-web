/* LFA V4: diario, rosters, matchups, cuadro, estadísticas y rankings. */
'use strict';
function v4DayKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}

function v4SafeUrl(url){return typeof url==='string'&&/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(url)?url:''}

function v4StoryArticle(s,i=0){
 // Una sola estética y sección periodística; los artículos de archivo
 // conservan su fecha/categoría histórica, no el tipo de contenido.
 const tag=s.year?String(s.category||'ARCHIVO LFA').toUpperCase():'EDICIÓN LFA';
 const date=s.updated_at?new Date(s.updated_at):null;
 const when=date&&!Number.isNaN(date.getTime())?`<time>${esc(new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(date))}</time>`:'';
 const url=v4SafeUrl(s.url);
 return `<article class="paper-story ${i===0?'paper-lead':''}">
  <div class="paper-meta"><span>${esc(tag)}</span>${when}</div>
  <h3>${esc(s.title)}</h3><p>${esc(s.description||s.body||'')}</p>
  ${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Leer noticia completa ↗</a>`:''}
  </article>`;
}

function v4DailySatire(){
 const date=v4DayKey(), seed=Number(date.replace(/\D/g,''))||1;
 const teams=D.franchises;
 const jokes=[
  ['Cumbre de emergencia en el vestuario','En una reunión de vestuario, {a} habría planteado que “los puntos esperados también deberían dar victorias”. Nadie se animó a preguntarle por las derrotas.'],
  ['El GM pidió una auditoría de la suerte','{a} elevó una queja a la comisión porque la aplicación le muestra un récord injusto. Propuso contar como triunfo cada partido en el que se sintió superior.'],
  ['Una negociación que terminó en pizza','Las negociaciones entre {a} y {b} parecían encaminadas, hasta que ambos GM discutieron quién pagaba la muzzarella. No hubo trade y sobró hambre.'],
  ['Operativo encubierto en los waivers','En los pasillos de la liga cuentan que {a} instaló tres alarmas para levantar un corredor suplente. Cuando abrió Sleeper, el jugador ya lo había agarrado {b}.'],
  ['Una conferencia sin autocrítica','El GM de {a} reunió a la prensa durante 40 minutos. Su única conclusión fue: “Si mis jugadores anotaban más, ganábamos”.'],
  ['La oficina de las excusas amplía horario','El gerente de {a} anunció una nueva oficina de excusas. Trabajará los lunes después del partido y los martes después de las correcciones de puntos.'],
  ['Un scouting revolucionario','La nueva política de scouting de {a}: elegir siempre al que hizo 30 puntos la semana anterior. Los analistas intentaron explicarle el concepto de regresión a la media.'],
  ['Tensión diplomática entre franquicias','{a} y {b} protagonizaron una crisis diplomática: uno dejó el mensaje en visto y el otro interpretó que era una oferta formal de trade.'],
  ['El vestuario exige responsabilidades','Tras el entrenamiento, el plantel de {a} pidió explicaciones por el último flex. El GM respondió que lo eligió “por vibra”.'],
  ['La comisión investiga un milagro','La comisión abrió un expediente sobre {a}: su mánager habría celebrado antes del último Monday Night. El fútbol americano tiene memoria.'],
  ['Se filtró un plan táctico insólito','El plan táctico de {a} incluiría pedirle personalmente al rival que deje a su mejor receptor en el banco. La negociación continúa sin avances.'],
  ['Una oferta imposible de rechazar','{a} llamó a {b} para ofrecerle “un futuro prometedor” a cambio de tres titulares. Ambos pidieron que se elimine la grabación.'],
  ['Entrevista exclusiva con el sillón vacío','El GM de {a} faltó a la conferencia de prensa. El sillón contestó más preguntas que él y fue elegido figura de la semana.'],
  ['Una apuesta por la astrología fantasy','El nuevo asesor que circula por los pasillos de {a} recomienda dejar afuera a los jugadores de signo incompatible. Sleeper todavía no ofrece esa estadística.'],
  ['Se acabó la paciencia en el chat','{a} presentó una propuesta para declarar ilegal el trash talk de {b}. La medida fue rechazada por unanimidad de los otros seis.'],
  ['El gerente pidió otro waiver','{a} intentó reclamar un jugador del equipo de {b} sin ofrecer nada a cambio. Lo llamó “mercado de oportunidades”.'],
  ['Celebración prematura','{a} ya habría encargado una copa antes del kickoff. La organización aclaró que la compra no suma puntos al ranking.'],
  ['Una multa por exceso de optimismo','La comisión disciplinaria sancionó a {a} por anunciar que era campeón en septiembre. El manager presentó apelación en forma de meme.']
 ];
 const idx=((Math.floor(seed*1.6180339))%jokes.length+jokes.length)%jokes.length;
 return Array.from({length:Math.min(6,jokes.length)},(_,n)=>{
  const j=jokes[(idx+n*5)%jokes.length], a=teams[(seed+n*3)%teams.length], b=teams[(seed+n*3+3)%teams.length];
  const replace=s=>s.replace(/\{a\}/g,a.manager+' ('+a.name+')').replace(/\{b\}/g,b.manager+' ('+b.name+')');
  return {category:'LFA',title:replace(j[0]),description:replace(j[1]),satire:true,updated_at:new Date().toISOString(),id:`satire-${date}-${n}`};
 });
}

async function v4FetchNflNews(){
 if(window.LFA_V4.newsBusy)return;
 const cache=window.LFA_V4.nflCache;
 if(cache&&Date.now()-cache.time<15*60*1000){window.LFA_V4.nflNews=cache.data;renderNews();return}
 window.LFA_V4.newsBusy=true;
 try{
  const ctrl=new AbortController(),id=setTimeout(()=>ctrl.abort(),11000);
  let response;
  try{response=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=15',{signal:ctrl.signal})}finally{clearTimeout(id)}
  if(!response.ok)throw Error('Noticias no disponibles');
  const json=await response.json();
  const articles=Array.isArray(json.articles)?json.articles:[];
  window.LFA_V4.nflNews=articles.filter(a=>a.headline&&v4SafeUrl(a.links?.web?.href||a.links?.mobile?.href||'')).slice(0,10).map(a=>({
   category:'NFL',title:a.headline,description:a.description||a.story||'',updated_at:a.published||a.lastModified||new Date().toISOString(),
   url:a.links?.web?.href||a.links?.mobile?.href,external:true,fact:'ESPN NFL · titular y enlace a la publicación'
  }));
  window.LFA_V4.nflCache={time:Date.now(),data:window.LFA_V4.nflNews};
 }catch(e){window.LFA_V4.nflError=true;window.LFA_V4.nflNews=[]}
 finally{window.LFA_V4.newsBusy=false;renderNews()}
}

function v4RenderNews(){
 const seen=new Set();
 const real=[...(window.LFA_V4.nflNews||[]),...generatedStories(),...(live.news||[])];
 const satire=v4DailySatire();
 let stories=[...real.slice(0,7),...satire.slice(0,3),...real.slice(7),...satire.slice(3)].filter(s=>{
  const key=normal(s.title);if(seen.has(key))return false;seen.add(key);return true;
 });
 if(!live.ready&&!(window.LFA_V4.nflNews||[]).length)stories=satire;
 const date=new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date());
 const masthead=`<div class="newspaper-banner"><div class="paper-vol">FANTASY FOOTBALL · LA REDACCIÓN DE LA LFA</div><h2>ÚLTIMA HORA <span>LFA</span></h2><div class="paper-date">${esc(date)} · Actualidad de la liga y noticias NFL</div></div>`;
 $('homeNews').innerHTML=masthead+'<div class="paper-grid">'+stories.slice(0,7).map((s,i)=>v4StoryArticle(s,i)).join('')+'</div>';
 $('newsGrid').innerHTML='<div class="paper-grid">'+stories.map((s,i)=>v4StoryArticle(s,i)).join('')+'</div>';
 $('newsStatus').textContent=(window.LFA_V4.nflNews||[]).length?'Noticias NFL · Diario LFA · Edición del día':'Edición LFA · Las noticias externas pueden no estar disponibles';
}

function v4GameLineup(row,week){
 const isLive=week>=live.currentWeek;
 const historical=week<live.currentWeek;
 const actualIds=Array.isArray(row?.players)?row.players:[];
 const actualStarts=Array.isArray(row?.starters)?row.starters:[];
 const ids=(actualIds.length?actualIds:historical?[]:roster(row?.roster_id)?.players||[]).map(String).filter(x=>x!=='0'&&x!=='');
 const starts=(actualStarts.length?actualStarts:historical?[]:roster(row?.roster_id)?.starters||[]).map(String).filter(x=>x!=='0'&&x!=='');
 const bench=ids.filter(id=>!starts.includes(id));
 const pts=row?.players_points||{};
 const starterPts=Array.isArray(row?.starters_points)?row.starters_points:[];
 const positions=live.league?.roster_positions||[];
 const format=(id,starter)=>{
  const p=live.players[id]||{}, pos=esc(p.position||'—'),status=p.injury_status?`<span class="status-tag">${esc(p.injury_status)}</span>`:'';
  let val=Object.prototype.hasOwnProperty.call(pts,id)?Number(pts[id]):null;
  if(val==null&&starter){const idx=(row.starters||[]).map(String).indexOf(id);if(idx!==-1&&starterPts[idx]!=null)val=Number(starterPts[idx])}
  const label=starter?esc(positions[starts.indexOf(id)]||p.position||'TIT'):'BANCO';
  return `<tr><td><span class="lineup-slot">${label}</span></td><td><strong>${esc(playerName(id))}</strong> <small>${pos} · ${esc(p.team||'FA')}</small>${status}</td><td class="num">${Number.isFinite(val)?fmt(val):'—'}</td></tr>`;
 };
 return `<div class="lineup-team"><h4>${rchip(row.roster_id)} <em>${row.points!=null?fmt(Number(row.points)):'—'} pts</em></h4>
 <div class="lineup-label">TITULARES</div><div class="tablewrap">${table(['Puesto','Jugador','PTS'],starts.map(id=>{const p=live.players[id]||{};let val=Object.prototype.hasOwnProperty.call(pts,id)?Number(pts[id]):null; const idx=(row.starters||[]).map(String).indexOf(id);if(val==null&&idx>=0&&starterPts[idx]!=null)val=Number(starterPts[idx]);return [`<span class="lineup-slot">${esc(positions[starts.indexOf(id)]||p.position||'TIT')}</span>`,`<strong>${esc(playerName(id))}</strong> <small>${esc(p.position||'')} ${esc(p.team||'')}</small>${p.injury_status?` <span class="status-tag">${esc(p.injury_status)}</span>`:''}`,Number.isFinite(val)?fmt(val):'—'] }))}</div>
 <div class="lineup-label">SUPLENTES / BANCO</div><div class="tablewrap">${table(['Puesto','Jugador','PTS'],bench.map(id=>{const p=live.players[id]||{},v=Object.prototype.hasOwnProperty.call(pts,id)?Number(pts[id]):null;return ['BANCO',`${esc(playerName(id))} <small>${esc(p.position||'')} ${esc(p.team||'')}</small>`,Number.isFinite(v)?fmt(v):'—']}))}</div>
 ${!starts.length?`<p class="muted small">${historical?'Sleeper no conserva la alineación de este encuentro en los datos disponibles.':'La formación todavía no está disponible.'}</p>`:''}</div>`;
}

function v4RenderMatchups(){
 const w=live.selectedWeek,pairs=matchupPairs(w);
 const make=(pair,home=false)=>{
  const [a,b]=pair,k=`${w}-${a.matchup_id}`;
  const opened=window.LFA_V4.openMatch===k;
  const stage=w===live.currentWeek?'EN JUEGO':w<live.currentWeek?'FINAL':'PRÓXIMA FECHA';
  return `<div class="matchbox matchbox-clickable"><button class="match-open" data-open-match="${esc(k)}" aria-expanded="${opened?'true':'false'}" type="button">
  <div class="muted small">SEMANA ${w} · ${stage} <span class="open-indicator">${opened?'− Cerrar':'+ Ver alineaciones'}</span></div>
  <div class="matchline">${rchip(a.roster_id)}<b>${a.points==null?'—':fmt(Number(a.points))}</b></div><div class="divider"></div><div class="matchline">${rchip(b.roster_id)}<b>${b.points==null?'—':fmt(Number(b.points))}</b></div></button>
  ${opened?`<div class="lineups-grid">${v4GameLineup(a,w)}${v4GameLineup(b,w)}</div>`:''}</div>`;
 };
 $('matchupsLive').innerHTML=pairs.length?pairs.map(p=>make(p)).join(''):'<div class="empty">Todavía no hay enfrentamientos publicados para esta fecha.</div>';
 $('homeWeekLabel').textContent=`SEMANA ${live.currentWeek}`;
 const homePairs=matchupPairs(live.currentWeek);
 $('homeGames').innerHTML=homePairs.length?homePairs.map(p=>{const [a,b]=p;return `<div class="matchbox"><button class="match-open" data-home-match="${esc(a.matchup_id)}"><div class="matchline">${rchip(a.roster_id)}<b>${a.points==null?'—':fmt(Number(a.points))}</b></div><div class="divider"></div><div class="matchline">${rchip(b.roster_id)}<b>${b.points==null?'—':fmt(Number(b.points))}</b></div><span class="open-indicator">Abrir partido ↗</span></button></div>`}).join(''):'<div class="empty">La fecha actual aún no tiene cruces publicados.</div>';
}

function v4RenderBracket(){
 const bracket=Array.isArray(live.bracket)?live.bracket:[];
 const predicted=sortedRosters().slice(0,Math.min(Number(live.league?.settings?.playoff_teams||4),live.rosters.length));
 const rounds=[...new Set(bracket.map(g=>Number(g.r)||1))].sort((a,b)=>a-b);
 const finalRound=Math.max(...rounds,0);
 const cols=rounds.length?rounds.map(r=>{
  const games=bracket.filter(g=>Number(g.r)===r);
  return `<div class="bracket-col"><div class="bracket-round">${r===finalRound?'🏆 GRAN FINAL':`RONDA ${r}`}</div>${games.map(g=>`<div class="bracket-game"><div class="bracket-team">${g.t1!=null?rchip(g.t1):'<span class="pending-team">Por definir</span>'}</div><div class="bracket-team">${g.t2!=null?rchip(g.t2):'<span class="pending-team">Por definir</span>'}</div>${g.w!=null?`<div class="bracket-winner">Ganador: ${esc(rname(g.w))}</div>`:''}</div>`).join('')}</div>`
 }).join(''):`<div class="bracket-col"><div class="bracket-round">🏆 GRAN FINAL</div><div class="bracket-game"><span class="pending-team">El cuadro oficial se confirmará en Sleeper</span></div></div>`;
 $('playoffView').innerHTML=`<div class="playoff-title">CAMINO AL TROFEO <span>🏆</span></div><div class="bracket-scroll"><div class="bracket-grid">${cols}</div></div>
 <h4 class="bracket-subtitle">Si terminara hoy, entrarían</h4><div class="playoff-contenders">${predicted.map((r,i)=>`<div class="contender"><b>#${i+1}</b>${rchip(r.roster_id)}<span>${record(r).wins}–${record(r).losses}</span></div>`).join('')}</div>`;
}

function v4RenderRosters(){
 const target=$('rosterGrid');if(!target)return;
 if(!live.ready||!live.rosters.length){target.innerHTML='<div class="empty">Cargando rosters de Sleeper…</div>';return}
 const state=window.LFA_V4;
 if(!live.rosters.some(r=>String(r.roster_id)===String(state.selectedRoster)))state.selectedRoster=String(sortedRosters()[0].roster_id);
 const current=roster(state.selectedRoster), players=(current?.players||[]).map(String).filter(x=>x!=='0');
 const starts=(current?.starters||[]).map(String).filter(x=>x!=='0');
 const reserve=new Set((current?.reserve||[]).map(String));
 const next=Math.min(18,live.currentWeek+1);
 const score=id=>state.projections?.[id];
 const order=id=>starts.includes(id)?0:reserve.has(id)?2:1;
 const sorted=players.slice().sort((a,b)=>order(a)-order(b)||String(live.players[a]?.position||'').localeCompare(String(live.players[b]?.position||''))||playerName(a).localeCompare(playerName(b)));
 const tabs=sortedRosters().map(r=>`<button type="button" class="roster-tab ${String(r.roster_id)===state.selectedRoster?'selected':''}" data-roster-open="${esc(r.roster_id)}">${rchip(r.roster_id)}</button>`).join('');
 target.innerHTML=`<div class="roster-switcher">${tabs}</div><div class="roster-header"><div><span class="eyetop">PLANTEL ${ACTIVE_SEASON}</span><h2>${rchip(current.roster_id)}</h2><p>${players.length} jugadores · ${starts.length} titulares · ${reserve.size} en reserva</p></div><div class="projection-note">Proyecciones PPR · Semana ${next}<small>${Object.keys(state.projections||{}).length?'Valores publicados en el feed de proyecciones de Sleeper; pueden diferir de la puntuación personalizada de LFA.':'Proyecciones no disponibles actualmente'}</small></div></div>
 <div class="tablewrap">${table(['Rol','Jugador','NFL','Estado','Proyección PPR'],sorted.map(id=>{const p=live.players[id]||{};const role=starts.includes(id)?'TITULAR':reserve.has(id)?'RESERVA':'BANCO';const projected=score(id);
 return [`<span class="lineup-slot">${role}</span>`,`<strong>${esc(playerName(id))}</strong> <small>${esc(p.position||'—')}</small>`,esc(p.team||'FA'),`<span class="${p.injury_status?'status-tag':''}">${esc(p.injury_status||'—')}</span>`,Number.isFinite(projected)?fmt(projected):'—'];
 }))}</div>`;
}

async function v4FetchProjections(){
 const state=window.LFA_V4,week=Math.min(18,live.currentWeek+1),key=`2026-${week}`;
 if(!live.ready||state.projectionBusy||state.projectionKey===key)return;
 state.projectionBusy=true;state.projectionKey=key;
 try{
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),11000);
  let resp;try{resp=await fetch(`https://api.sleeper.com/projections/nfl/2026/${week}?season_type=regular`,{signal:ctrl.signal})}finally{clearTimeout(timer)}
  if(!resp.ok)throw Error('Sin feed de proyecciones');
  const json=await resp.json(),raw=Array.isArray(json)?json:Array.isArray(json?.players)?json.players:Object.values(json||{});
  const map={};
  for(const p of raw){if(!p||typeof p!=='object')continue;const pid=String(p.player_id||p.player?.player_id||p.id||'');const pts=Number(p.stats?.pts_ppr??p.pts_ppr);if(pid&&pid!=='undefined'&&Number.isFinite(pts))map[pid]=pts}
  state.projections=map;
 }catch{state.projections={}}
 finally{state.projectionBusy=false;v4RenderRosters()}
}

function v4RenderTransactions(){
 const val=$('transactionWeek').value,type=$('transactionFilter').value;
 const all=val==='all',week=Number(val);
 let items=(all?transactionsList():live.transactions[week]||[]).filter(t=>t.status==='complete'&&(type==='all'||t.type===type)).sort((a,b)=>(b.status_updated||b.created||0)-(a.status_updated||a.created||0));
 $('transactionData').innerHTML=items.length?`<p class="muted small">${items.length} operaciones · ${all?'Toda la temporada':`Semana ${week}`}</p>`+items.map(txDetail).join(''):`<div class="empty">No se registraron operaciones completas en ${all?'la temporada':`la semana ${week}`}.</div>`;
 const recent=transactionsList().slice(0,3);$('homeMoves').innerHTML=recent.length?recent.map(txDetail).join(''):'<div class="empty">Sin movimientos completados.</div>';
}

function v4RenderDraft(){
 if(!live.draft){$('draftData').innerHTML='<div class="empty">Draft todavía no publicado.</div>';return}
 const picks=live.picks.slice().sort((a,b)=>a.pick_no-b.pick_no),rounds=Math.max(0,...picks.map(p=>Number(p.round)||0),Number(live.draft?.settings?.rounds||0)),slots=Math.max(live.rosters.length||8,...picks.map(p=>Number(p.draft_slot)||0));
 $('draftTotal').textContent=`${picks.length} elecciones · ${rounds} rondas`;
 const select=$('draftRound'),prev=select.value;select.innerHTML='<option value="all">Todas las rondas</option>'+Array.from({length:rounds},(_,i)=>`<option value="${i+1}">Ronda ${i+1}</option>`).join('');if([...select.options].some(o=>o.value===prev))select.value=prev;
 const filter=select.value,byKey=new Map(picks.map(p=>[`${p.round}-${p.draft_slot}`,p]));
 const headers=Array.from({length:slots},(_,i)=>{const rid=live.draft?.slot_to_roster_id?.[String(i+1)];return rid?rchip(rid):`Turno ${i+1}`});
 const rows=[];
 for(let r=1;r<=rounds;r++){if(filter!=='all'&&Number(filter)!==r)continue;
  rows.push(`<tr><td>R${r}</td>${Array.from({length:slots},(_,i)=>{
   const pick=byKey.get(`${r}-${i+1}`);if(!pick)return '<td><div class="pick unpicked">Sin selección</div></td>';
   const f=assigned(roster(pick.roster_id)),name=[pick.metadata?.first_name,pick.metadata?.last_name].filter(Boolean).join(' ')||playerName(pick.player_id),pos=pick.metadata?.position||live.players[String(pick.player_id)]?.position||'—';
   const abbr=String(pick.metadata?.team||live.players[String(pick.player_id)]?.team||'').toLowerCase().replace(/[^a-z]/g,''),img=abbr?`<img class="nfl-logo" loading="lazy" alt="NFL ${esc(abbr.toUpperCase())}" src="https://a.espncdn.com/i/teamlogos/nfl/500/${esc(abbr)}.png" onerror="this.style.display='none'">`:'';
   return `<td><div class="pick" data-pos="${esc(pos)}"><span class="draft-owner">${f?logoImg(f.id):''}<span>${esc(f?.name||rname(pick.roster_id))}</span></span><span class="player">${esc(name)}</span><span class="nfl-team">${img}<b>${esc(pos)}</b> · ${esc(pick.metadata?.team||'NFL')}</span></div></td>`;
  }).join('')}</tr>`);
 }
 $('draftData').innerHTML=`<div class="board-scroll"><table class="draftboard"><thead><tr><th>RONDA</th>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function v4RenderComparison(){
 const a=$('h2hA').value,b=$('h2hB').value,mode=$('h2hMode')?.value||'duel';
 const field=$('h2hBField');if(field)field.style.display=mode==='all'?'none':'';
 const ra=live.rosters.find(r=>assigned(r)?.id===a)?.roster_id;
 const games=completedGames();
 function calculate(opponent){
  const h=D.legacy_h2h_review.find(x=>[x.franchise_a_id,x.franchise_b_id].includes(a)&&[x.franchise_a_id,x.franchise_b_id].includes(opponent));
  const old=h?(h.franchise_a_id===a?`${h.regular_wins_a}–${h.regular_wins_b}`:`${h.regular_wins_b}–${h.regular_wins_a}`):'—';
  const rb=live.rosters.find(r=>assigned(r)?.id===opponent)?.roster_id;
  const gg=games.filter(g=>ra!=null&&rb!=null&&[g.a,g.b].includes(Number(ra))&&[g.a,g.b].includes(Number(rb)));
  const wins=gg.filter(g=>(g.a===Number(ra)?g.pa:g.pb)>(g.a===Number(ra)?g.pb:g.pa)).length;
  const losses=gg.filter(g=>(g.a===Number(ra)?g.pa:g.pb)<(g.a===Number(ra)?g.pb:g.pa)).length;
  return {old,now:`${wins}–${losses}`,games:gg};
 }
 if(mode==='all'){
  const rows=D.franchises.filter(f=>f.id!==a).map(f=>{const r=calculate(f.id);return [`<span class="cellteam">${logoImg(f.id)}${esc(f.name)}</span>`,r.now,r.old,r.games.map(g=>`S${g.week}`).join(', ')||'—']});
  $('h2hResult').innerHTML=`<h3>${esc(teamName(a))} frente a los otros siete</h3><div class="tablewrap">${table(['Rival','2026','Archivo histórico','Fechas 2026'],rows)}</div>`;
 }else{
  if(a===b){$('h2hResult').innerHTML='<div class="note">Seleccioná dos equipos distintos.</div>';return}
  const r=calculate(b);
  $('h2hResult').innerHTML=`<div class="rivalry-hero">${logoImg(a)}<strong>${esc(teamName(a))}</strong><span>${r.now}</span><strong>${esc(teamName(b))}</strong>${logoImg(b)}</div><p class="muted small">2026 · ${r.games.length} partidos cerrados · Registro anterior: ${esc(r.old)} (independiente, sin sumar)</p>`;
 }
}

function v4HistoricalRows(){
 const source=D.legacy_stats_review||[],finished=ACTIVE_SEASON===2026&&live.ready?completedGames().filter(g=>g.type==='regular'):[];
 const before=finished.filter(g=>g.week>=1&&g.week<=8),after=finished.filter(g=>g.week>8);
 return D.franchises.map(f=>{
  const current=live.rosters.find(r=>assigned(r)?.id===f.id),rid=current?.roster_id;
  const baseScore=before.reduce((sum,g)=>sum+(g.a===Number(rid)?g.pa:g.b===Number(rid)?g.pb:0),0);
  let s=source.find(x=>x.franchise_id===f.id),inferred=false;
  if(!s&&rid!=null&&before.length>=28){
   const choices=source.filter(x=>!x.franchise_id&&Math.abs(Number(x.season_points?.['2026'])-baseScore)<=6.1);
   if(choices.length===1){s=choices[0];inferred=true}
  }
  const oldWins=Number(s?.wins_reported),oldRate=Number(s?.win_rate_reported),basePF=Number(s?.points_total_reported);
  const ok=!!s&&rid!=null&&before.length>=28&&Math.abs(Number(s.season_points?.['2026'])-baseScore)<=6.1;
  const extra=ok?after.filter(g=>g.a===Number(rid)||g.b===Number(rid)):[];
  const deltaWins=extra.reduce((sum,g)=>sum+((g.a===Number(rid)?g.pa>g.pb:g.pb>g.pa)?1:0),0);
  const deltaLosses=extra.reduce((sum,g)=>sum+((g.a===Number(rid)?g.pa<g.pb:g.pb<g.pa)?1:0),0);
  const deltaPF=extra.reduce((sum,g)=>sum+(g.a===Number(rid)?g.pa:g.pb),0);
  const baseGames=Number.isFinite(oldWins)&&Number.isFinite(oldRate)&&oldRate>0?Math.round(oldWins/(oldRate/100)):null;
  const baseLosses=baseGames!=null?Math.max(0,baseGames-oldWins):null;
  const wins=Number.isFinite(oldWins)?oldWins+deltaWins:null;
  const losses=baseLosses!=null?baseLosses+deltaLosses:null;
  const games=baseGames!=null?baseGames+extra.length:null;
  const rate=games&&wins!=null?100*wins/games:oldRate;
  const baseIndex=Number((D.legacy_rankings_review||[]).find(x=>x.franchise_id===f.id)?.legacy_score);
  const ptsBonus=ok&&Number.isFinite(basePF)?Math.floor((basePF+deltaPF)/250)-Math.floor(basePF/250):0;
  const score=Number.isFinite(baseIndex)&&baseGames!=null?(baseIndex*baseGames+10*deltaWins+ptsBonus)/Math.max(1,games):null;
  return {f,wins,losses,rate,games,score,source:s,verifiedFromWeek8:ok,inferred,deltaGames:extra.length,deltaWins,deltaPF};
 });
}
function v4EnhanceHistory(){
 const stories=[...D.editorial];
 const finals=D.seasons.filter(s=>s.official).map(s=>({year:s.year,type:'editorial',title:`${s.year}: ${s.champion_name} escribe su capítulo`,description:`${s.champion_name} levantó el título frente a ${s.runner_up_name}, por ${fmt(s.final_score.champion)} a ${fmt(s.final_score.runner_up)}. Los campeonatos se recuerdan; las excusas se guardan para la próxima edición.`,fact:`Final ${s.year} · Diferencia ${fmt(Math.abs(s.final_score.champion-s.final_score.runner_up))} puntos`}));
 if(live.ready&&live.picks.length){
  const top=live.picks.slice().sort((a,b)=>Number(a.pick_no)-Number(b.pick_no))[0];
  if(top?.player_id)stories.push({year:ACTIVE_SEASON,type:'editorial',title:'El primer nombre de la noche del draft',description:`${rname(top.roster_id)} abrió el tablero del Draft ${ACTIVE_SEASON} seleccionando a ${playerName(top.player_id)}. La elección queda escrita en el libro de las primeras decisiones.`,fact:`Elección #1 del Draft LFA ${ACTIVE_SEASON}`});
 }
 if(live.ready){
  const cancelled=Object.values(live.transactions).flat().filter(t=>t.type==='trade'&&['failed','vetoed','cancelled'].includes(t.status));
  if(cancelled.length){
   const x=cancelled[0];stories.push({year:ACTIVE_SEASON,type:'editorial',title:'Un trade que quedó en el camino',description:`La operación entre ${x.roster_ids?.map(rname).join(' y ')||'dos franquicias'} no terminó completada. La oficina del comisionado tiene una historia más para contar.`,fact:`Estado de operación registrado: ${x.status}`});
  }
 }
 const all=[...stories,...finals].sort((a,b)=>b.year-a.year);
 $('historicalStories').innerHTML='<div class="oldpaper-banner"><span>EL ARCHIVO · DESDE 2019</span><h2>CRÓNICAS DE OTRA ÉPOCA</h2><p>Glorias, humillaciones y rachas que dejaron huella en la LFA</p></div><div class="paper-grid">'+all.map((s,i)=>v4StoryArticle({...s,category:`${s.year} · ARCHIVO`,updated_at:null},i)).join('')+'</div>';
 const historic=v4HistoricalRows().filter(v=>v.wins!=null).sort((a,b)=>(b.score??0)-(a.score??0));
 $('legacyRanks').innerHTML=`<div class="tablewrap">${table(['#','Franquicia','Índice*','G–P acumulado'],historic.map((r,i)=>[i+1,logoImg(r.f.id)+esc(r.f.name),Number.isFinite(r.score)?fmt(r.score):'—',`${r.wins}–${r.losses??'—'}`]))}</div><p class="muted small">Ranking histórico provisional.</p>`;
 const el=$('historicalOverall');if(el)el.innerHTML=`<div class="tablewrap">${table(['Franquicia','G','P','% victorias','Último agregado'],historic.map(r=>[logoImg(r.f.id)+esc(r.f.name),r.wins,r.losses??'—',r.rate==null?'—':`${fmt(r.rate)}%`,r.verifiedFromWeek8?(r.deltaGames?`+${r.deltaGames} fechas`:'Hasta semana 8'):'Pendiente']))}</div><p class="muted small">Récord histórico provisional.</p>`;
}
function v4ShowFranchise(id){
 document.querySelectorAll('[data-franchise]').forEach(b=>b.classList.toggle('selected',b.dataset.franchise===id));
 const f=franchise(id);if(!f)return;
 const recordLegacy=v4HistoricalRows().find(r=>r.f.id===id);
 const champion=D.seasons.filter(s=>s.official&&s.champion_franchise_id===id).map(s=>s.year),runner=D.seasons.filter(s=>s.official&&s.runner_up_franchise_id===id).map(s=>s.year),regular=D.standings_2025.find(s=>s.franchise_id===id);
 const current=live.rosters.find(r=>assigned(r)?.id===id),now=current?record(current):null;
 $('franchiseDetail').innerHTML=`<div class="franchise-profile"><div class="franchise-profile-head">${logoImg(id)}<div><div class="eyetop">PERFIL DE FRANQUICIA</div><h2>${esc(f.name)}</h2><p>General Manager: <strong>${esc(f.manager)}</strong></p></div></div>
 <div class="franchise-summary"><div><span>TÍTULOS</span><strong>${titles(id)}</strong></div><div><span>FINALES</span><strong>${finals(id)}</strong></div><div><span>RÉCORD ACTUAL</span><strong>${now?`${now.wins}–${now.losses}`:'—'}</strong></div><div><span>HISTÓRICO*</span><strong>${recordLegacy?.wins!=null?`${recordLegacy.wins}–${recordLegacy.losses??'?'}`:'—'}</strong></div></div>
 <div class="grid two spaced"><div class="franchise-section"><h3>Palmarés</h3><p><b>Campeonatos:</b> ${champion.length?champion.join(', '):'Sin campeonatos'}</p><p><b>Subcampeonatos:</b> ${runner.length?runner.join(', '):'Sin subcampeonatos registrados'}</p></div><div class="franchise-section"><h3>Rendimiento por temporada</h3><p><b>2025:</b> ${regular?`${regular.wins} G – ${regular.losses} P · ${fmt(regular.pf)} PF`:'Sin registros completos'}</p><p><b>Actual:</b> ${now?`${fmt(now.pf)} PF · ${fmt(now.pa)} PA`:'Esperando resultados'}</p></div></div>
 <small class="muted">*Récord histórico provisional.</small></div>`;
}

function v4RenderSeasons(){
 const select=$('seasonRecordYear');if(!select)return;
 const year=Number(select.value);
 if(year===ACTIVE_SEASON){const rows=sortedRosters().map((r,i)=>{const x=record(r);return [i+1,rchip(r.roster_id),x.wins,x.losses,fmt(x.pf),fmt(x.pa)]});$('seasonRecords').innerHTML=`<div class="tablewrap">${table(['#','Equipo','G','P','PF','PA'],rows)}</div>`;return}
 const archived=D.archived_seasons?.[String(year)];
 if(archived?.standings?.length){
  const rows=archived.standings.map(r=>[r.rank,logoImg(r.franchise_id)+esc(teamName(r.franchise_id)),r.wins,r.losses,fmt(r.pf),fmt(r.pa)]);
  $('seasonRecords').innerHTML=`<div class="tablewrap">${table(['#','Equipo','G','P','PF','PA'],rows)}</div><p class="muted small">Temporada ${year} · Resultados finales archivados desde Sleeper.</p>`;
  return;
 }
 if(year===2025){const rows=D.standings_2025.map(r=>[r.rank,logoImg(r.franchise_id)+esc(teamName(r.franchise_id)),r.wins,r.losses,fmt(r.pf),fmt(r.pa)]);$('seasonRecords').innerHTML=`<div class="tablewrap">${table(['#','Equipo','G','P','PF','PA'],rows)}</div>`;return}
 const rows=(D.legacy_stats_review||[]).filter(r=>r.franchise_id&&r.season_points?.[year]!=null&&Number(r.season_points[year])>0).sort((a,b)=>Number(b.season_points[year])-Number(a.season_points[year])).map((r,i)=>[i+1,logoImg(r.franchise_id)+esc(teamName(r.franchise_id)),fmt(Number(r.season_points[year]))]);
 $('seasonRecords').innerHTML=`<div class="tablewrap">${table(['#','Franquicia','Puntos a favor registrados'],rows)}</div><p class="muted small">Para este año no hay resultados semanales completos en el archivo disponible.</p>`;
}

function v4RenderAll(){
 window.LFA_V4.oldRenderAll();
 v4RenderRosters();v4RenderSeasons();v4EnhanceHistory();
}

function v4Init(){
 window.LFA_V4={openMatch:null,selectedRoster:null,projections:{},projectionKey:null,projectionBusy:false,nflNews:[],nflCache:null,nflError:false,newsBusy:false};
 window.renderMatchups=v4RenderMatchups;
 window.renderBracket=v4RenderBracket;
 window.renderTransactions=v4RenderTransactions;
 window.renderDraft=v4RenderDraft;
 window.renderNews=v4RenderNews;
 window.renderComparison=v4RenderComparison;
 window.showFranchise=v4ShowFranchise;
 window.LFA_V4.oldRenderAll=renderAll;
 window.renderAll=v4RenderAll;
 const oldFetchPlayers=fetchPlayers;
 window.fetchPlayers=async function(){await oldFetchPlayers();v4RenderRosters();v4RenderMatchups();v4RenderNews()};
 const tx=$('transactionWeek');if(tx&&!tx.querySelector('option[value="all"]'))tx.insertAdjacentHTML('afterbegin','<option value="all">Todas las semanas</option>');
 tx?.addEventListener('change',ev=>{if(tx.value==='all'){ev.stopImmediatePropagation();v4RenderTransactions()}},true);
 const h2h=$('h2hMode');h2h?.addEventListener('change',v4RenderComparison);
 $('seasonRecordYear')?.addEventListener('change',v4RenderSeasons);
 document.addEventListener('click',e=>{
  const game=e.target.closest('[data-open-match]');if(game){const id=game.dataset.openMatch;window.LFA_V4.openMatch=window.LFA_V4.openMatch===id?null:id;v4RenderMatchups();return}
  const home=e.target.closest('[data-home-match]');if(home){window.LFA_V4.openMatch=`${live.currentWeek}-${home.dataset.homeMatch}`;live.selectedWeek=live.currentWeek;$('weekSelect').value=String(live.currentWeek);nav('temporada');v4RenderMatchups();return}
  const rosterBtn=e.target.closest('[data-roster-open]');if(rosterBtn){window.LFA_V4.selectedRoster=rosterBtn.dataset.rosterOpen;v4RenderRosters();return}
  if(e.target.closest('[data-page="rosters"],[data-go="rosters"]'))v4FetchProjections();
 });
 v4EnhanceHistory();
 v4RenderNews();
 v4FetchNflNews();
 const now=v4DayKey();window.LFA_V4.day=now;
 const todayLabel=$('todayLabel');if(todayLabel)todayLabel.textContent=new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date()).toUpperCase();
 setInterval(()=>{if(window.LFA_V4.day!==v4DayKey()){window.LFA_V4.day=v4DayKey();v4RenderNews()}},30*60*1000);
 setInterval(()=>{if(!document.hidden)v4FetchNflNews()},30*60*1000);
}
v4Init();
