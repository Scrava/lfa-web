/* LFA V3 — sin dependencias. Datos 2026 desde Sleeper; históricos documentados o en revisión. */
'use strict';
const D=window.LFA_DATA;
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fmt=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const dt=ms=>ms?new Date(ms).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}):'—';
const franchise=id=>D.franchises.find(f=>f.id===id);
const teamName=id=>franchise(id)?.name||id||'Sin identificar';
const logo=id=>franchise(id)?.logo||'';
const logoImg=(id,cls='')=>logo(id)?`<img class="${cls}" src="${esc(logo(id))}" alt="Escudo ${esc(teamName(id))}" loading="lazy">`:'';
const table=(head,rows)=>`<table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const LIVE_ID=D.league.sleeper_league_id;
const API_ROOT='https://api.sleeper.app/v1/';
let live={ready:false,league:null,users:[],rosters:[],nfl:null,currentWeek:1,selectedWeek:1,bracket:[],draft:null,picks:[],matchups:{},transactions:{},players:{},news:[],syncedAt:null,snapshot:false,mappings:{}};
try{live.mappings=JSON.parse(localStorage.getItem('lfa_roster_map_2026')||'{}')||{}}catch{live.mappings={}}
function roster(id){return live.rosters.find(r=>String(r.roster_id)===String(id))}
function user(r){return live.users.find(u=>String(u.user_id)===String(r?.owner_id))||{}}
function sleeperName(r){const u=user(r);return String(r?.metadata?.team_name||u.metadata?.team_name||u.display_name||`Roster #${r?.roster_id||'?'}`)}
function assigned(r){if(!r)return null;const manual=live.mappings[String(r.roster_id)];if(manual&&franchise(manual))return franchise(manual);
 const u=user(r),names=[r.metadata?.team_name,u.metadata?.team_name,u.display_name,u.username].filter(Boolean).map(normal);
 const matches=D.franchises.filter(f=>[f.name,f.manager,...(f.aliases||[]),...(f.manager_aliases||[])].map(normal).some(alias=>names.includes(alias)));
 return matches.length===1?matches[0]:null;
}
function rname(id){const r=roster(id);return assigned(r)?.name||sleeperName(r)}
function rchip(id){const r=roster(id),f=assigned(r);return `<span class="cellteam">${f?logoImg(f.id):''}<span>${esc(f?.name||sleeperName(r))}</span></span>`}
function points(s,side='fpts'){return Number(s?.[side]||0)+Number(s?.[`${side}_decimal`]||0)/100}
const record=r=>({wins:Number(r?.settings?.wins||0),losses:Number(r?.settings?.losses||0),ties:Number(r?.settings?.ties||0),pf:points(r?.settings,'fpts'),pa:points(r?.settings,'fpts_against')});
function sortedRosters(){return live.rosters.slice().sort((a,b)=>{let x=record(a),y=record(b);return y.wins-x.wins||x.losses-y.losses||y.pf-x.pf})}
function api(path,timeout=15000){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);return fetch(API_ROOT+path,{signal:ctrl.signal,cache:'no-store',headers:{Accept:'application/json'}}).then(r=>{if(!r.ok)throw Error(`Sleeper HTTP ${r.status}`);return r.json()}).finally(()=>clearTimeout(timer))}
async function jsonLocal(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Sin snapshot');return r.json()}
function setStatus(ok,message,snapshot=false){$('apiDot').classList.toggle('ok',ok);$('apiText').textContent=message;
 $('sourceStatus').textContent=ok?message:'Sin conexión verificada';$('liveNotice').textContent=ok?`${live.league?.name||'LFA'} · ${snapshot?'Última actualización guardada':'En vivo'} · ${live.syncedAt?dt(new Date(live.syncedAt).getTime()):'—'}`:'Datos en vivo no disponibles temporalmente.';
 $('syncInfo').textContent=ok?`2026 · ${snapshot?'Snapshot':'Sleeper en vivo'} · ${live.syncedAt?dt(new Date(live.syncedAt).getTime()):'consultando'}`:'Sleeper: sin conexión';
}
function nav(page){if(!document.querySelector(`.view[data-view="${page}"]`))return;
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===page));
 document.querySelectorAll('.navbutton').forEach(v=>v.classList.toggle('active',v.dataset.page===page));
 const label=document.querySelector(`.navbutton[data-page="${page}"]`)?.textContent||page;$('breadcrumb').textContent=label.toUpperCase();
 window.scrollTo({top:0,behavior:'instant'});
}
document.querySelectorAll('[data-page],[data-go]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.page||b.dataset.go)));
$('refresh').addEventListener('click',()=>connect(true));
function titles(id){return D.seasons.filter(s=>s.official&&s.champion_franchise_id===id).length}
function finals(id){return D.seasons.filter(s=>s.official&&(s.champion_franchise_id===id||s.runner_up_franchise_id===id)).length}
function championRow(s){return `<div class="champ-row"><span class="year">${s.year}</span>${logoImg(s.champion_franchise_id)}<div><strong>${esc(s.champion_name)}</strong><small>vs ${esc(s.runner_up_name)} · ${esc(s.editorial)}</small></div><span class="score">${fmt(s.final_score.champion)} – ${fmt(s.final_score.runner_up)}</span></div>`}
function storyHtml(s,liveStory=false){let over=liveStory?`${esc(s.category||'NOTICIA')} · 2026`:`${s.year} · ${s.type==='folklore'?'FOLKLORE':'CRÓNICA HISTÓRICA'}`;return `<article class="storycard"><div class="overline">${over}</div><h3>${esc(s.title)}</h3><p>${esc(s.description||s.body||'')}</p><div class="fact">${esc(s.fact||s.source||'')}</div>${liveStory?`<div class="date">${esc(s.updated_at?dt(new Date(s.updated_at).getTime()):'Fuente: Sleeper')}</div>`:''}</article>`}
function renderHistory(){const seasons=D.seasons.filter(s=>s.official),ranking=D.franchises.slice().sort((a,b)=>titles(b.id)-titles(a.id)||a.name.localeCompare(b.name));
 $('championsList').innerHTML=seasons.slice().reverse().map(championRow).join('');
 $('titleChart').innerHTML=ranking.map(f=>`<div class="rank-row"><span class="inline-logo">${logoImg(f.id)} <b>${esc(f.name)}</b></span><div class="meter"><i style="width:${titles(f.id)/2*100}%"></i></div><em>${titles(f.id)}</em></div>`).join('');
 $('champRank').innerHTML=ranking.map((f,i)=>`<div class="rank-row"><span class="inline-logo"><span class="muted">${i+1}.</span>${logoImg(f.id)}<b>${esc(f.name)}</b></span><em>${titles(f.id)} título${titles(f.id)===1?'':'s'}</em></div>`).join('');
 $('legacyRanks').innerHTML=D.legacy_rankings_review.slice().sort((a,b)=>b.legacy_score-a.legacy_score).map((v,i)=>`<div class="rank-row"><span>${i+1}. <b>${esc(v.manager_source)}</b></span><em>${fmt(v.legacy_score)}*</em></div>`).join('')+'<p class="muted small">*Ranking anterior sin corte certificado. No corresponde a la clasificación 2026.</p>';
 $('standings2025').innerHTML=table(['#','Equipo','G','P','PF','PA','Dif.'],D.standings_2025.map(s=>[s.rank,`<span class="cellteam">${logoImg(s.franchise_id)}${esc(teamName(s.franchise_id))}</span>`,s.wins,s.losses,fmt(s.pf),fmt(s.pa),(s.difference>=0?'+':'')+fmt(s.difference)]));
 const top=D.standings_2025.reduce((a,b)=>b.pf>a.pf?b:a);
 const cards=[['Final más ajustada','0,76','All Bros 125,24–Cougars FT 124,48 (2023)'],['Mayor anotación en una final documentada','174,22','Boom or Bust, final de 2020'],['Mejor récord en 2025','13–2','Boom or Bust'],['Más PF en 2025',fmt(top.pf),teamName(top.franchise_id)],['Bicampeones de la era', '2 títulos', 'All Bros y Fantasy Gods'],['2018 no profesional','Nuevos Santos','Temporada cero, fuera del palmarés']];
 $('verifiedRecords').innerHTML=cards.map(([l,n,f])=>`<div class="recordcard"><label>${esc(l)}</label><b>${esc(n)}</b><p>${esc(f)}</p></div>`).join('');
 $('franchiseGrid').innerHTML=D.franchises.map(f=>`<button type="button" class="teamcard" data-franchise="${esc(f.id)}">${logoImg(f.id)}<b>${esc(f.name)}</b><span>${esc(f.manager)} · ${titles(f.id)} título${titles(f.id)!==1?'s':''}</span></button>`).join('');
 document.querySelectorAll('[data-franchise]').forEach(b=>b.addEventListener('click',()=>showFranchise(b.dataset.franchise)));
 showFranchise('all-bros');
 $('historicalStories').innerHTML=D.editorial.map(s=>storyHtml(s,false)).join('');
 $('h2hTable').innerHTML=table(['Franquicia A','Franquicia B','RS A–B','PO A–B'],D.legacy_h2h_review.map(h=>[`<span class="cellteam">${logoImg(h.franchise_a_id)}${esc(teamName(h.franchise_a_id))}</span>`,`<span class="cellteam">${logoImg(h.franchise_b_id)}${esc(teamName(h.franchise_b_id))}</span>`,`${h.regular_wins_a}–${h.regular_wins_b}`,`${h.playoff_wins_a}–${h.playoff_wins_b}`]));
 const options=D.franchises.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');$('h2hA').innerHTML=options;$('h2hB').innerHTML=options;$('h2hA').value='all-bros';$('h2hB').value='scravengers';
 $('h2hA').addEventListener('change',renderComparison);$('h2hB').addEventListener('change',renderComparison);renderComparison();
}
function showFranchise(id){document.querySelectorAll('[data-franchise]').forEach(b=>b.classList.toggle('selected',b.dataset.franchise===id));const f=franchise(id);if(!f)return;
 const won=D.seasons.filter(s=>s.official&&s.champion_franchise_id===id).map(s=>s.year),runners=D.seasons.filter(s=>s.official&&s.runner_up_franchise_id===id).map(s=>s.year),s=D.standings_2025.find(x=>x.franchise_id===id);
 const liveR=live.rosters.find(r=>assigned(r)?.id===id);const ls=liveR?record(liveR):null;
 $('franchiseDetail').innerHTML=`<div class="detail-head">${logoImg(id)}<div><div class="eyetop">FRANQUICIA HISTÓRICA</div><h2>${esc(f.name)}</h2><p>Manager: <b>${esc(f.manager)}</b> · Mismo dueño desde el inicio profesional</p><div class="detail-metrics"><div><b>${titles(id)}</b><span>anillos oficiales</span></div><div><b>${finals(id)}</b><span>finales</span></div><div><b>${ls?`${ls.wins}–${ls.losses}`:'—'}</b><span>2026 actual</span></div></div></div></div><hr><div class="grid two"><div><h3>Archivo de la franquicia</h3><p>Campeonatos: ${won.length?won.join(', '):'ninguno hasta 2025'}</p><p>Subcampeonatos: ${runners.length?runners.join(', '):'ninguno documentado'}</p></div><div><h3>Temporada 2025</h3><p>${s?`Puesto ${s.rank} · ${s.wins}–${s.losses} · ${fmt(s.pf)} PF · ${fmt(s.pa)} PA`:'Datos pendientes'}</p><p class="muted small">Los escudos de los 8 equipos son los proporcionados por la liga.</p></div></div>`;
}
function selectedH2H(){const a=$('h2hA').value,b=$('h2hB').value;return D.legacy_h2h_review.find(h=>[h.franchise_a_id,h.franchise_b_id].includes(a)&&[h.franchise_a_id,h.franchise_b_id].includes(b));}
function completedGames(){const games=[];const current=live.currentWeek;for(const [wk,rows] of Object.entries(live.matchups)){const week=Number(wk);if(week>=current||!Array.isArray(rows))continue;
 const groups={};rows.forEach(r=>{if(r.matchup_id!=null)(groups[r.matchup_id]??=[]).push(r)});
 for(const pair of Object.values(groups)){if(pair.length!==2||pair.some(x=>x.points==null))continue;
  const [a,b]=pair;if(!Number.isFinite(Number(a.points))||!Number.isFinite(Number(b.points)))continue;
  games.push({week,a:Number(a.roster_id),b:Number(b.roster_id),pa:Number(a.points),pb:Number(b.points),type:week<Number(live.league?.settings?.playoff_week_start||15)?'regular':'playoffs'});
 }}return games.sort((x,y)=>x.week-y.week)}
function renderComparison(){const a=$('h2hA').value,b=$('h2hB').value;if(a===b){$('h2hResult').innerHTML='<div class="note">Elegí dos franquicias distintas.</div>';return;}
 const h=selectedH2H(),back=h&&h.franchise_a_id!==a,wa=h?(back?h.regular_wins_b:h.regular_wins_a):null,wb=h?(back?h.regular_wins_a:h.regular_wins_b):null;
 const ra=live.rosters.find(r=>assigned(r)?.id===a)?.roster_id,rb=live.rosters.find(r=>assigned(r)?.id===b)?.roster_id;
 const games=completedGames().filter(g=>[g.a,g.b].includes(Number(ra))&&[g.a,g.b].includes(Number(rb))&&ra!=null&&rb!=null);
 let aa=0,bb=0,ties=0;for(const g of games){const ax=g.a===Number(ra)?g.pa:g.pb,bx=g.a===Number(ra)?g.pb:g.pa;if(ax>bx)aa++;else if(ax<bx)bb++;else ties++}
 $('h2hResult').innerHTML=`<div class="grid two"><div class="stat"><span>Archivo anterior · sin fecha de corte</span><strong>${wa==null?'—':`${wa}–${wb}`}</strong><p>${esc(teamName(a))} / ${esc(teamName(b))} · fase regular</p></div><div class="stat"><span>2026 verificado · partidos ya cerrados</span><strong>${aa}–${bb}${ties?` · ${ties} empate(s)`:''}</strong><p>${games.length} partido(s) · Sleeper · no se suman al legado</p></div></div>`;
}
function render2026H2H(){const games=completedGames().filter(g=>g.type==='regular');const rows=[];
 for(let i=0;i<D.franchises.length;i++)for(let j=i+1;j<D.franchises.length;j++){
 const fa=D.franchises[i],fb=D.franchises[j],ra=live.rosters.find(r=>assigned(r)?.id===fa.id)?.roster_id,rb=live.rosters.find(r=>assigned(r)?.id===fb.id)?.roster_id;
 if(ra==null||rb==null)continue;const gg=games.filter(g=>[g.a,g.b].includes(Number(ra))&&[g.a,g.b].includes(Number(rb)));
 if(!gg.length)continue;const wa=gg.filter(g=>(g.a===Number(ra)?g.pa:g.pb)>(g.a===Number(ra)?g.pb:g.pa)).length;const wb=gg.filter(g=>(g.a===Number(rb)?g.pa:g.pb)>(g.a===Number(rb)?g.pb:g.pa)).length;
 rows.push([`<span class="cellteam">${logoImg(fa.id)}${esc(fa.name)}</span>`,`<span class="cellteam">${logoImg(fb.id)}${esc(fb.name)}</span>`,`${wa}–${wb}`,gg.map(g=>`S${g.week}`).join(', ')]);
 }$('h2h2026').innerHTML=rows.length?`<div class="tablewrap">${table(['A','B','Balance','Fechas'],rows)}</div>`:'<div class="empty">Aún no hay enfrentamientos completos verificables o quedan equipos sin vincular a sus rosters.</div>';
 renderComparison();
}
function playerName(id){const p=live.players[String(id)];return p?.name||p?.full_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ')||`Jugador #${id}`}
function playerStatus(id){const p=live.players[String(id)];return p?.injury_status||p?.status||''}
function typeName(type){return ({waiver:'Waiver',free_agent:'Agente libre',trade:'Trade'})[type]||type||'Movimiento'}
function txDetail(t){const sides=new Map();const add=(rid,kind,item)=>{if(!sides.has(String(rid)))sides.set(String(rid),{adds:[],drops:[],picks:[],budget:[]});sides.get(String(rid))[kind].push(item)};
 Object.entries(t.adds||{}).forEach(([pid,rid])=>add(rid,'adds',playerName(pid)));
 Object.entries(t.drops||{}).forEach(([pid,rid])=>add(rid,'drops',playerName(pid)));
 for(const p of t.draft_picks||[]){if(p.owner_id!=null)add(p.owner_id,'picks',`Recibe elección R${p.round} (${p.season})`);if(p.previous_owner_id!=null)add(p.previous_owner_id,'picks',`Entrega elección R${p.round} (${p.season})`)}
 for(const b of t.waiver_budget||[]){if(b.receiver!=null)add(b.receiver,'budget',`Recibe $${b.amount} FAAB`);if(b.sender!=null)add(b.sender,'budget',`Entrega $${b.amount} FAAB`)}
 for(const rid of t.roster_ids||[]){if(!sides.has(String(rid)))add(rid,'picks','Operación registrada')}
 const rows=[...sides].map(([rid,data])=>`<div class="market-side"><b>${rchip(rid)}</b>${data.adds.map(n=>`<p class="add">+ ${esc(n)}</p>`).join('')}${data.drops.map(n=>`<p class="drop">− ${esc(n)}</p>`).join('')}${data.picks.map(n=>`<p>⇄ ${esc(n)}</p>`).join('')}${data.budget.map(n=>`<p>${esc(n)}</p>`).join('')}</div>`).join('');
 return `<div class="market-entry"><div class="market-title"><span>${esc(typeName(t.type))}</span><span class="chip">${esc(dt(t.created||t.status_updated))}</span></div><div class="market-detail">${rows||'<span class="muted small">No hay desglose de jugadores disponible en esta operación.</span>'}</div>${t.settings?.waiver_bid!=null?`<small>Oferta waiver: ${esc(t.settings.waiver_bid)} FAAB</small>`:''}</div>`;
}
function transactionsList(){return Object.values(live.transactions).flat().filter(t=>t.status==='complete').filter(t=>t.type==='trade'||t.type==='waiver'||t.type==='free_agent').sort((a,b)=>(b.status_updated||b.created||0)-(a.status_updated||a.created||0))}
function renderTransactions(){const week=Number($('transactionWeek').value),type=$('transactionFilter').value,items=(live.transactions[week]||[]).filter(t=>t.status==='complete'&&(type==='all'||t.type===type)).sort((a,b)=>(b.status_updated||b.created||0)-(a.status_updated||a.created||0));
 $('transactionData').innerHTML=items.length?items.map(txDetail).join(''):`<div class="empty">No hay operaciones completadas de este tipo en la semana ${week}.</div>`;
 const recent=transactionsList().slice(0,3);$('homeMoves').innerHTML=recent.length?recent.map(txDetail).join(''):'<div class="empty">Todavía no hay movimientos confirmados para mostrar.</div>';
}
function renderDraft(){if(!live.draft){$('draftData').innerHTML='<div class="empty">Aún no se recibió el draft 2026 desde Sleeper.</div>';return;}
 const picks=live.picks.slice().sort((a,b)=>a.pick_no-b.pick_no);const slots=Math.max(live.rosters.length||8,...picks.map(p=>Number(p.draft_slot)||0)),rounds=Math.max(0,...picks.map(p=>Number(p.round)||0),Number(live.draft.settings?.rounds||0));
 $('draftTotal').textContent=`${picks.length} picks · ${rounds} rondas`;
 const select=$('draftRound');const previous=select.value;select.innerHTML='<option value="all">Todas las rondas</option>'+Array.from({length:rounds},(_,i)=>`<option value="${i+1}">Ronda ${i+1}</option>`).join('');if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;
 const filter=select.value;const byKey=new Map(picks.map(p=>[`${p.round}-${p.draft_slot}`,p]));
 const headers=Array.from({length:slots},(_,i)=>{const slot=i+1,rosterId=live.draft?.slot_to_roster_id?.[String(slot)];return rosterId!=null?rchip(rosterId):`Pick ${slot}`});
 const rows=[];for(let round=1;round<=rounds;round++){
  if(filter!=='all'&&Number(filter)!==round)continue;
  rows.push(`<tr><td>R${round}</td>${Array.from({length:slots},(_,i)=>{
    const pick=byKey.get(`${round}-${i+1}`);if(!pick)return `<td><div class="pick unpicked">Sin elección registrada</div></td>`;
    const name=[pick.metadata?.first_name,pick.metadata?.last_name].filter(Boolean).join(' ')||playerName(pick.player_id),pos=pick.metadata?.position||live.players[String(pick.player_id)]?.position||'—',who=roster(pick.roster_id)?rname(pick.roster_id):(user({owner_id:pick.picked_by}).display_name||'Sin dueño');
    return `<td><div class="pick" data-pos="${esc(pos)}"><span class="picknum">#${esc(pick.pick_no)} · ${esc(pick.metadata?.team||'NFL')}</span><span class="player">${esc(name)}</span><span class="pos">${esc(pos)}</span><span class="owner">${esc(who)}</span></div></td>`;
  }).join('')}</tr>`);
 }
 $('draftData').innerHTML=`<p class="muted small">Estado: ${esc(live.draft.status||'—')} · Formato: ${esc(live.draft.type||'—')}. Deslizá el tablero de izquierda a derecha para recorrer los ocho equipos.</p><div class="board-scroll"><table class="draftboard"><thead><tr><th>RONDA</th>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function matchupPairs(w){const groups={};for(const r of live.matchups[w]||[]){if(r.matchup_id==null)continue;(groups[r.matchup_id]??=[]).push(r)}return Object.values(groups).filter(p=>p.length===2)}
function renderMatchups(){const w=live.selectedWeek,pairs=matchupPairs(w);const out=pairs.map(pair=>{const [a,b]=pair;const current=w===live.currentWeek;const score=x=>x.points==null?'—':fmt(Number(x.points));return `<div class="matchbox"><div class="muted small">SEMANA ${w} · ${current?'MARCADOR EN CURSO / PROVISIONAL':w<live.currentWeek?'RESULTADO':'FUTURA'}</div><div class="matchline">${rchip(a.roster_id)}<b>${score(a)}</b></div><div class="divider"></div><div class="matchline">${rchip(b.roster_id)}<b>${score(b)}</b></div></div>`}).join('');
 $('matchupsLive').innerHTML=out||'<div class="empty">Sleeper no devolvió enfrentamientos completos para esta semana.</div>';
 $('homeWeekLabel').textContent=`SEMANA ${live.currentWeek}`;
 const homePairs=matchupPairs(live.currentWeek);$('homeGames').innerHTML=homePairs.length?homePairs.map(pair=>{const [a,b]=pair;return `<div class="matchbox"><div class="matchline">${rchip(a.roster_id)}<b>${a.points==null?'—':fmt(Number(a.points))}</b></div><div class="divider"></div><div class="matchline">${rchip(b.roster_id)}<b>${b.points==null?'—':fmt(Number(b.points))}</b></div></div>`}).join(''):'<div class="empty">Sin enfrentamientos publicados para la fecha actual.</div>';
}
function renderBracket(){if(!live.bracket?.length){$('playoffView').textContent='Sleeper todavía no publicó el cuadro de playoffs.';return}const rows=live.bracket.map(g=>[g.r,g.m,g.t1!=null?esc(rname(g.t1)):'Por definir',g.t2!=null?esc(rname(g.t2)):'Por definir',g.w!=null?esc(rname(g.w)):'Pendiente']);$('playoffView').innerHTML=`<div class="tablewrap">${table(['Ronda','Partido','A','B','Ganador'],rows)}</div>`}
function renderStandings(){const sorted=sortedRosters();$('homeLive').innerHTML=sorted.length?sorted.map((r,i)=>{const s=record(r);return `<div class="rank-row"><span class="inline-logo"><span class="muted">${i+1}.</span>${rchip(r.roster_id)}</span><em>${s.wins}–${s.losses}</em></div>`}).join(''):'<div class="empty">Sin tabla cargada</div>';
 $('standingsLive').innerHTML=table(['#','Franquicia','G','P','E','PF','PA'],sorted.map((r,i)=>{let s=record(r);return [i+1,rchip(r.roster_id),s.wins,s.losses,s.ties,fmt(s.pf),fmt(s.pa)]}));
 $('liveStats').innerHTML=[['Liga',live.league.name||'LFA'],['Franquicias',live.rosters.length],['Semana NFL',live.currentWeek],['Estado',live.league.status||'—']].map(([l,v])=>`<div class="stat"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join('');
}
function renderCurrentRecords(){const games=completedGames();const weekScores=games.flatMap(g=>[{id:g.a,points:g.pa,week:g.week},{id:g.b,points:g.pb,week:g.week}]);
 if(!games.length){$('currentRecords').innerHTML='<div class="empty">Se calculan al cerrar los primeros partidos de 2026 y al vincular los rosters.</div>';$('ranking2026').innerHTML='<div class="empty">Sin semanas cerradas.</div>';render2026H2H();return;}
 const max=weekScores.slice().sort((a,b)=>b.points-a.points)[0],min=weekScores.slice().sort((a,b)=>a.points-b.points)[0],largest=games.slice().sort((a,b)=>Math.abs(b.pa-b.pb)-Math.abs(a.pa-a.pb))[0],closest=games.slice().sort((a,b)=>Math.abs(a.pa-a.pb)-Math.abs(b.pa-b.pb))[0];
 const cards=[['Mayor puntaje semanal',fmt(max.points),`${rname(max.id)} · semana ${max.week}`],['Menor puntaje semanal',fmt(min.points),`${rname(min.id)} · semana ${min.week}`],['Paliza más amplia',fmt(Math.abs(largest.pa-largest.pb)),`${rname(largest.a)} vs ${rname(largest.b)} · semana ${largest.week}`],['Partido más cerrado',fmt(Math.abs(closest.pa-closest.pb)),`Semana ${closest.week}: ${rname(closest.a)} / ${rname(closest.b)}`]];
 $('currentRecords').innerHTML=`<div class="grid four">${cards.map(([a,b,c])=>`<div class="recordcard"><label>${esc(a)}</label><b>${esc(b)}</b><p>${esc(c)}</p></div>`).join('')}</div><p class="muted small">Semanas finalizadas: 1–${Math.max(0,live.currentWeek-1)}.</p>`;
 $('recordsCutoff').textContent=`${games.length} encuentros verificados`;
 const regular=games.filter(g=>g.type==='regular'),stats=new Map();for(const g of regular){for(const [rid,score,other] of [[g.a,g.pa,g.pb],[g.b,g.pb,g.pa]]){const id=assigned(roster(rid))?.id||`roster-${rid}`;if(!stats.has(id))stats.set(id,{id,pf:0,games:0,wins:0,loses:0});const s=stats.get(id);s.pf+=score;s.games++;s.wins+=score>other?1:0;s.loses+=score<other?1:0}}
 const rank=[...stats.values()].map(s=>({...s,score:(10*s.wins+Math.floor(s.pf/250))/Math.max(1,s.games)})).sort((a,b)=>b.score-a.score);
 $('ranking2026').innerHTML=rank.length?table(['Pos.','Equipo','G-P','Puntos 2026','Índice parcial'],rank.map((s,i)=>[i+1,esc(teamName(s.id)),`${s.wins}–${s.loses}`,fmt(s.pf),fmt(s.score)])):'<div class="empty">Sin partidos de temporada regular cerrados.</div>';
 render2026H2H();
}
function generatedStories(){const now=live.syncedAt||new Date().toISOString();const recent=transactionsList();const stories=[];
 const push=(category,title,description,fact,priority=3)=>stories.push({category,title,description,fact,updated_at:now,priority});
 if(!live.ready)return stories;
 const standing=sortedRosters();if(standing.length){const best=standing[0],last=standing[standing.length-1],a=record(best),b=record(last);
 push('PANORAMA','El campeonato tiene líder, y también tiene sótano',`${rname(best.roster_id)} encabeza la tabla con ${a.wins}–${a.losses}. ${rname(last.roster_id)} cierra con ${b.wins}–${b.losses}. La calculadora no concede puntos de consuelo.`,`Standings Sleeper 2026 · corte ${dt(new Date(now).getTime())}`,2);
 }
 const games=completedGames(),latest=games.filter(g=>g.week===Math.max(0,live.currentWeek-1));if(latest.length){const blow=latest.slice().sort((a,b)=>Math.abs(b.pa-b.pb)-Math.abs(a.pa-a.pb))[0];if(blow){const winner=blow.pa>=blow.pb?blow.a:blow.b,loser=blow.pa>=blow.pb?blow.b:blow.a;
 push('FOLKLORE','El parte policial de la última fecha',`${rname(winner)} le ganó a ${rname(loser)} por ${fmt(Math.abs(blow.pa-blow.pb))} puntos. Si alguien necesita hablar del calendario, la redacción abre los lunes.`,`Resultado Sleeper · semana ${blow.week}`,1)}}
 if(recent.length){for(const t of recent.slice(0,2)){const ids=Object.keys(t.adds||{}),players=ids.map(playerName).slice(0,2);const rids=t.roster_ids||[];
 push('MERCADO',`${typeName(t.type)} en la LFA: se mueve el tablero`,`${rids.map(rname).join(' y ')||'Una franquicia'} protagonizó una operación${players.length?` con ${players.join(' y ')}`:''}. En Mercado está el detalle completo de altas y bajas.`,`Transacción Sleeper ${String(t.transaction_id||'').slice(-8)} · ${dt(t.status_updated||t.created)}`,1)}}
 const injured=[];for(const r of live.rosters){for(const pid of r.starters||[]){const p=live.players[String(pid)];if(p&&['Out','Doubtful','Questionable','Injured Reserve','IR','Suspended'].includes(String(p.injury_status||'')))injured.push({pid,team:rname(r.roster_id),p});}}
 if(injured.length){const v=injured[0];push('PLANTELES',`Situación a vigilar: ${playerName(v.pid)}`,`${v.team} tiene a ${playerName(v.pid)} con etiqueta “${v.p.injury_status}” en Sleeper. Es un estado de la plataforma, no una confirmación médica independiente.`,`Estado Sleeper consultado ${dt(new Date(now).getTime())}`,2)}
 return stories.sort((a,b)=>a.priority-b.priority);
}
function renderNews(){const seen=new Set(),merged=[...generatedStories(),...(live.news||[])].filter(s=>{const key=normal(s.title)+normal(s.fact);if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
 $('newsGrid').innerHTML=merged.length?merged.map(s=>storyHtml(s,true)).join(''):'<div class="empty">Todavía no hay novedades de 2026 verificadas. El diario no publica rumores como hechos.</div>';
 $('homeNews').innerHTML=merged.length?merged.slice(0,3).map(s=>storyHtml(s,true)).join(''):'<div class="empty">Las notas de 2026 aparecen cuando Sleeper aporta información contrastable.</div>';
 $('newsStatus').textContent=live.ready?`Boletín 2026 · ${live.snapshot?'snapshot programado':'datos de Sleeper al abrir la web'} · Última consulta ${live.syncedAt?dt(new Date(live.syncedAt).getTime()):'—'}. Las noticias cambian cuando hay novedades; no se inventan hechos por cumplir un horario.`:'No hay conexión de datos 2026 para alimentar el diario. Los hechos anteriores están en “Hechos históricos”.';
}
function renderMapping(){if(!live.ready)return;const opts='<option value="">Automático / sin asignar</option>'+D.franchises.map(f=>`<option value="${f.id}">${esc(f.name)} · ${esc(f.manager)}</option>`).join('');
 $('mappingArea').innerHTML='<p class="muted small">Solo si Sleeper usa apodos distintos: vinculá cada roster a su franquicia. Este ajuste se guarda localmente en este navegador.</p>'+live.rosters.map(r=>`<div class="mapping-row"><div>Roster #${r.roster_id}<br><small class="muted">${esc(sleeperName(r))}</small></div><select class="select" data-roster-map="${r.roster_id}">${opts}</select></div>`).join('');
 document.querySelectorAll('[data-roster-map]').forEach(sel=>{const r=roster(sel.dataset.rosterMap);sel.value=live.mappings[sel.dataset.rosterMap]||'';sel.title=assigned(r)?`Identificado: ${assigned(r).name}`:'Sin asociación inequívoca';sel.addEventListener('change',()=>{if(sel.value)live.mappings[sel.dataset.rosterMap]=sel.value;else delete live.mappings[sel.dataset.rosterMap];localStorage.setItem('lfa_roster_map_2026',JSON.stringify(live.mappings));renderAll();})});
}
function renderAll(){renderStandings();renderMatchups();renderTransactions();renderDraft();renderBracket();renderCurrentRecords();renderNews();for(const f of D.franchises){/* no-op */}const selected=document.querySelector('.teamcard.selected')?.dataset.franchise||'all-bros';showFranchise(selected)}
function populateWeeks(){for(let w=1;w<=18;w++){const option=`<option value="${w}">${w}</option>`;$('weekSelect').insertAdjacentHTML('beforeend',option);$('transactionWeek').insertAdjacentHTML('beforeend',option)}
 $('weekSelect').addEventListener('change',async()=>{live.selectedWeek=Number($('weekSelect').value);if(!live.matchups[live.selectedWeek]&&live.ready)try{live.matchups[live.selectedWeek]=await api(`league/${LIVE_ID}/matchups/${live.selectedWeek}`)}catch{}renderMatchups()});
 $('transactionWeek').addEventListener('change',async()=>{const w=Number($('transactionWeek').value);if(!live.transactions[w]&&live.ready)try{live.transactions[w]=await api(`league/${LIVE_ID}/transactions/${w}`)}catch{}renderTransactions()});
 $('transactionFilter').addEventListener('change',renderTransactions);$('draftRound').addEventListener('change',renderDraft);
}
async function fetchPlayers(){
 // Si existe la copia diaria publicada, todos los visitantes usan la misma copia
 // y evitamos descargar el catálogo gigante desde Sleeper por cada usuario.
 try{const published=await jsonLocal('data/player_catalog.json');
  if(published?.players&&published.generated_at&&Date.now()-new Date(published.generated_at).getTime()<48*3600e3){
   live.players={...published.players,...live.players};renderTransactions();renderNews();renderDraft();return;
  }
 }catch{}
 try{const cached=JSON.parse(localStorage.getItem('lfa_players_compact_v3')||'null');if(cached&&cached.at&&Date.now()-cached.at<24*3600e3){live.players={...cached.data,...live.players};renderTransactions();renderNews();renderDraft();return;}}catch{}
 // Solo primera prueba/despliegue sin sincronizador: una descarga por navegador cada 24 horas.
 try{const all=await api('players/nfl',45000),mini={};for(const [id,p] of Object.entries(all||{})){mini[id]={name:p.full_name||`${p.first_name||''} ${p.last_name||''}`.trim(),position:p.position,injury_status:p.injury_status,team:p.team}}live.players={...mini,...live.players};
 try{localStorage.setItem('lfa_players_compact_v3',JSON.stringify({at:Date.now(),data:mini}))}catch{}
 renderTransactions();renderNews();renderDraft();
 }catch(e){console.warn('[LFA] El catálogo de jugadores no estuvo disponible',e.message)}
}
async function connect(force=false){$('refresh').disabled=true;setStatus(false,'Conectando…');
 try{
  const [league,users,rosters,nfl]=await Promise.all([api(`league/${LIVE_ID}`),api(`league/${LIVE_ID}/users`),api(`league/${LIVE_ID}/rosters`),api('state/nfl')]);
  if(!league?.league_id||String(league.season)!=='2026'||!Array.isArray(users)||!Array.isArray(rosters))throw Error('Liga ausente o temporada no coincidente');
  live={...live,ready:true,league,users,rosters,nfl,currentWeek:Math.max(1,Math.min(18,Number(nfl.week||1))),snapshot:false,syncedAt:new Date().toISOString(),matchups:{},transactions:{},news:[],bracket:[]};
  live.selectedWeek=live.currentWeek;$('weekSelect').value=String(live.currentWeek);$('transactionWeek').value=String(live.currentWeek);setStatus(true,'Sleeper 2026 conectado');renderStandings();
  const tasks=[...Array(live.currentWeek)].map((_,i)=>i+1);await Promise.allSettled(tasks.map(async w=>{
    try{live.matchups[w]=await api(`league/${LIVE_ID}/matchups/${w}`)}catch{live.matchups[w]=[]}
    try{live.transactions[w]=await api(`league/${LIVE_ID}/transactions/${w}`)}catch{live.transactions[w]=[]}
  }));
  const [drafts,bracket]=await Promise.allSettled([api(`league/${LIVE_ID}/drafts`),api(`league/${LIVE_ID}/winners_bracket`)]);
  if(bracket.status==='fulfilled')live.bracket=bracket.value||[];
  if(drafts.status==='fulfilled'){const dd=drafts.value||[];live.draft=dd.find(x=>String(x.draft_id)===String(league.draft_id))||dd.find(x=>String(x.season)==='2026')||null;if(live.draft){try{live.picks=await api(`draft/${live.draft.draft_id}/picks`);for(const p of live.picks)if(p.player_id&&p.metadata?.first_name)live.players[String(p.player_id)]={name:`${p.metadata.first_name} ${p.metadata.last_name||''}`.trim(),position:p.metadata.position}}catch{live.picks=[]}}}
  renderMapping();renderAll();fetchPlayers();
 }catch(e){console.warn('[LFA] No se pudo verificar Sleeper:',e.message);await fallbackSnapshot()}
 finally{$('refresh').disabled=false;}
}
async function fallbackSnapshot(){try{const snap=await jsonLocal('data/live_snapshot.json');if(!snap||snap.league_id!==LIVE_ID||!snap.league?.league_id)throw Error('No hay snapshot publicado');
 live={...live,ready:true,snapshot:true,syncedAt:snap.generated_at,league:snap.league,users:snap.users||[],rosters:snap.rosters||[],nfl:snap.nfl||null,currentWeek:Math.min(18,Math.max(1,Number(snap.week||1))),matchups:snap.matchups||{},transactions:snap.transactions||{},bracket:snap.bracket||[],draft:snap.draft||null,picks:snap.picks||[],players:{...live.players,...(snap.players||{})}};
 live.selectedWeek=live.currentWeek;$('weekSelect').value=String(live.currentWeek);$('transactionWeek').value=String(live.currentWeek);
 try{live.news=await jsonLocal('data/auto_news.json')}catch{live.news=[]}
 setStatus(true,'Snapshot 2026 disponible',true);renderMapping();renderAll();
 if(live.syncedAt&&Date.now()-new Date(live.syncedAt).getTime()>12*3600e3)$('sourceDetails').textContent='Advertencia: último snapshot hace más de 12 horas. No se deben confundir datos archivados con marcadores en vivo.';
 }catch{live.ready=false;setStatus(false,'Sleeper sin acceso');for(const el of ['homeLive','homeGames','homeMoves','standingsLive','matchupsLive','transactionData','draftData','currentRecords','ranking2026','h2h2026'])$(el).innerHTML='<div class="empty">No se pudieron verificar los datos de 2026 en este navegador.</div>';renderNews();}}
renderHistory();populateWeeks();connect();
// Reconsulta silenciosa mientras la página permanezca abierta. Los snapshots persistentes se publican por GitHub Actions.
setInterval(()=>{if(!document.hidden)connect()},30*60*1000);
