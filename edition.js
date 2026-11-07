/* LFA · Edición 5: portada, español, estadísticas y paleta de la liga. */
(function LfaEditionV5(){
 'use strict';
 const $=window.$ || (id=>document.getElementById(id));
 const stats=window.LFA_V4;
 const ESC=typeof window.esc==='function'?window.esc:(v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
 const idKey=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const nflTeams={
  ARI:'Arizona Cardinals',ATL:'Atlanta Falcons',BAL:'Baltimore Ravens',BUF:'Buffalo Bills',CAR:'Carolina Panthers',CHI:'Chicago Bears',CIN:'Cincinnati Bengals',CLE:'Cleveland Browns',
  DAL:'Dallas Cowboys',DEN:'Denver Broncos',DET:'Detroit Lions',GB:'Green Bay Packers',HOU:'Houston Texans',IND:'Indianapolis Colts',JAX:'Jacksonville Jaguars',JAC:'Jacksonville Jaguars',
  KC:'Kansas City Chiefs',LAC:'Los Angeles Chargers',LAR:'Los Angeles Rams',LV:'Las Vegas Raiders',MIA:'Miami Dolphins',MIN:'Minnesota Vikings',NE:'New England Patriots',
  NO:'New Orleans Saints',NYG:'New York Giants',NYJ:'New York Jets',PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',SEA:'Seattle Seahawks',SF:'San Francisco 49ers',
  TB:'Tampa Bay Buccaneers',TEN:'Tennessee Titans',WAS:'Washington Commanders',WSH:'Washington Commanders'
 };
 function nflName(code){const c=String(code||'').toUpperCase();return nflTeams[c]|| (c?c:'Agente libre')}
 function localeNow(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return Date.UTC(Number(map.year),Number(map.month)-1,Number(map.day));
 }
 function issue(){return Math.floor(localeNow()/(3*86400000))}
 function editionStart(){return new Date(issue()*3*86400000)}
 const prevHistory=window.v4EnhanceHistory;
 // Los relatos humorísticos cambian por edición (cada 72 horas), nunca por recarga.
 window.v4DayKey=()=>editionStart().toISOString().slice(0,10);
 function likelySpanish(s){
  const text=String(s||'');
  if(!text)return false;
  return /\b(el|la|los|las|de|del|para|tras|ante|sobre|entre|lesi[oó]n|temporada|jugadores|equipo|semana|entrenador|regresa|confirma|anuncia|victoria|derrota|afirma)\b/i.test(text)&&!/\b(the|after|says|will|could|with|ahead|against|have|their)\b/i.test(text);
 }
 async function translateTitle(title){
  const raw=String(title||'').trim().slice(0,210);
  if(!raw)return null;
  if(likelySpanish(raw))return raw;
  try{
   const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),6500);
   let response;
   try{response=await fetch('https://api.mymemory.translated.net/get?q='+encodeURIComponent(raw)+'&langpair=en%7Ces',{signal:ctrl.signal})}finally{clearTimeout(timeout)}
   if(!response.ok)throw Error('Sin traducción');
   const data=await response.json();
   const translated=String(data?.responseData?.translatedText||'').trim();
   if(translated && !/^MYMEMORY WARNING/i.test(translated) && translated!==raw && likelySpanish(translated))return translated.slice(0,250);
  }catch{}
  return null; // no se presentan titulares en inglés como si fueran noticias en español
 }
 window.v4FetchNflNews=async function(){
  if(stats.newsBusy)return;
  const key=issue();
  try{
   const cache=JSON.parse(localStorage.getItem('lfa_nfl_es_edicion_v5')||'null');
   if(cache?.edition===key && Array.isArray(cache.articles)){
    stats.nflNews=cache.articles;
    window.renderNews();
    return;
   }
  }catch{}
  stats.newsBusy=true;
  try{
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),11000);
   let response;
   try{
    response=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=12&lang=es&region=mx',{signal:ctrl.signal,headers:{'Accept-Language':'es-MX,es;q=0.9'}});
   }finally{clearTimeout(timer)}
   if(!response.ok)throw Error('Noticias NFL no disponibles');
   const payload=await response.json();
   const articles=Array.isArray(payload.articles)?payload.articles:[];
   const selected=articles.filter(x=>x?.headline && window.v4SafeUrl(x.links?.web?.href||x.links?.mobile?.href||'')).slice(0,7);
   const translated=await Promise.all(selected.map(async x=>{
    const title=await translateTitle(x.headline);
    if(!title)return null;
    const description=likelySpanish(x.description)?String(x.description).slice(0,270):'';
    return {id:'nfl-'+String(x.id||idKey(x.headline)),title,description,category:'ACTUALIDAD NFL',url:x.links?.web?.href||x.links?.mobile?.href,updated_at:x.published||x.lastModified||null,external:true,translated:title!==x.headline};
   }));
   stats.nflNews=translated.filter(Boolean);
   try{localStorage.setItem('lfa_nfl_es_edicion_v5',JSON.stringify({edition:key,articles:stats.nflNews}))}catch{}
   stats.nflError=false;
  }catch{
   stats.nflError=true;
   // Conservamos los titulares de la última edición si existen; nunca dejamos inglés visible.
   try{const old=JSON.parse(localStorage.getItem('lfa_nfl_es_edicion_v5')||'null');stats.nflNews=Array.isArray(old?.articles)?old.articles:[]}catch{stats.nflNews=[]}
  }finally{
   stats.newsBusy=false;
   window.renderNews();
  }
 };
 window.v4RenderNews=function(){
  const seen=new Set(),satire=window.v4DailySatire();
  const ext=(stats.nflNews||[]).filter(n=>n?.title && likelySpanish(n.title));
  const real=[...ext,...window.generatedStories(),...(live.news||[])];
  const stories=[...real.slice(0,4),...satire.slice(0,3),...real.slice(4),...satire.slice(3)].filter(s=>{
   const key=idKey(s.title);if(!key||seen.has(key))return false;seen.add(key);return true;
  });
  const news=$('newsGrid');
  if(news)news.innerHTML='<div class="paper-grid">'+stories.map((s,i)=>window.v4StoryArticle(s,i)).join('')+'</div>';
  const status=$('newsStatus');
  if(status)status.textContent='Edición '+editionStart().toLocaleDateString('es-AR',{day:'numeric',month:'long',timeZone:'UTC'})+' · Nuevas crónicas cada tres días · Resultados LFA en vivo';
 };
 window.v4RenderRosters=function(){
  const target=$('rosterGrid');if(!target)return;
  if(!live.ready||!live.rosters.length){target.innerHTML='<div class="empty">Cargando planteles…</div>';return}
  if(!live.rosters.some(r=>String(r.roster_id)===String(stats.selectedRoster)))stats.selectedRoster=String(window.sortedRosters()[0].roster_id);
  const current=window.roster(stats.selectedRoster);
  const players=(current?.players||[]).map(String).filter(x=>x!=='0');
  const starts=(current?.starters||[]).map(String).filter(x=>x!=='0');
  const reserve=new Set((current?.reserve||[]).map(String));
  const week=Math.min(18,live.currentWeek+1);
  const sorted=players.slice().sort((a,b)=>{
   const order=id=>starts.includes(id)?0:reserve.has(id)?2:1;
   return order(a)-order(b)||String(live.players[a]?.position||'').localeCompare(String(live.players[b]?.position||''))||window.playerName(a).localeCompare(window.playerName(b));
  });
  const tabs=window.sortedRosters().map(r=>`<button type="button" class="roster-tab ${String(r.roster_id)===stats.selectedRoster?'selected':''}" data-roster-open="${ESC(r.roster_id)}">${window.rchip(r.roster_id)}</button>`).join('');
  const rows=sorted.map(id=>{
   const p=live.players[id]||{},role=starts.includes(id)?'TITULAR':reserve.has(id)?'RESERVA':'SUPLENTE';
   const proyeccion=Number(stats.projections?.[id]),projected=stats.projections&&Object.prototype.hasOwnProperty.call(stats.projections,id)&&Number.isFinite(proyeccion)?fmt(proyeccion):'—';
   return [`<span class="lineup-slot">${role}</span>`,`<b>${ESC(p.position||'—')}</b>`,`<strong>${ESC(window.playerName(id))}</strong>`,ESC(nflName(p.team)),`<span class="${p.injury_status?'status-tag':''}">${ESC(p.injury_status||'—')}</span>`,projected];
  });
  target.innerHTML=`<div class="roster-switcher">${tabs}</div>
   <div class="roster-header"><div><span class="eyetop">PLANTEL 2026</span><h2>${window.rchip(current.roster_id)}</h2><p>${players.length} jugadores · ${starts.length} titulares · ${reserve.size} en reserva</p></div>
   <div class="projection-note">Proyección · Semana ${week}<small>Proyección PPR si Sleeper la publica. Puede diferir de la puntuación propia de la LFA.</small></div></div>
   <div class="tablewrap roster-table">${table(['Rol','Posición','Jugador','Equipo NFL','Estado','Proyección PPR'],rows)}</div>`;
 };
 window.v4RenderDraft=function(){
  if(!live.draft){$('draftData').innerHTML='<div class="empty">Draft aún no publicado.</div>';return}
  const draft=live.draft,picks=live.picks.slice().sort((a,b)=>a.pick_no-b.pick_no);
  const slots=Math.max(live.rosters.length||8,...picks.map(p=>Number(p.draft_slot)||0));
  const rounds=Math.max(Number(draft.settings?.rounds||0),...picks.map(p=>Number(p.round)||0));
  $('draftTotal').textContent=`${picks.length} elecciones · ${rounds} rondas`;
  const select=$('draftRound'),old=select.value;
  select.innerHTML='<option value="all">Todas las rondas</option>'+Array.from({length:rounds},(_,i)=>`<option value="${i+1}">Ronda ${i+1}</option>`).join('');
  if([...select.options].some(x=>x.value===old))select.value=old;
  const teamBySlot=new Map();
  for(const [uid,slot] of Object.entries(draft.draft_order||{})){
   const match=live.rosters.find(r=>String(r.owner_id)===String(uid));
   if(match)teamBySlot.set(Number(slot),match.roster_id);
  }
  for(const [slot,rid] of Object.entries(draft.slot_to_roster_id||{}))if(!teamBySlot.has(Number(slot)))teamBySlot.set(Number(slot),rid);
  for(const p of picks.filter(p=>Number(p.round)===1)){
   if(!teamBySlot.has(Number(p.draft_slot))){
    const match=live.rosters.find(r=>String(r.owner_id)===String(p.picked_by));
    teamBySlot.set(Number(p.draft_slot),match?.roster_id||p.roster_id);
   }
  }
  // Encabezado: franquicia titular del turno original (Sleeper draft_order).
  const headers=Array.from({length:slots},(_,i)=>{
   const slot=i+1;
   const firstRound=picks.find(p=>Number(p.round)===1&&Number(p.draft_slot)===slot);
   const byUser=live.rosters.find(r=>String(r.owner_id)===String(firstRound?.picked_by));
   const rid=teamBySlot.get(slot)??byUser?.roster_id??firstRound?.roster_id;
   const f=window.assigned(window.roster(rid));
   const name=f?.name||window.rname(rid)||'Franquicia';
   const shield=f?window.logoImg(f.id,'draft-slot-shield'):'';
   return `<div class="draft-slot-owner"><span class="draft-slot-number">TURNO ${slot}</span><div class="draft-slot-franchise">${shield}<b>${ESC(name)}</b></div></div>`;
  });
  const byKey=new Map(picks.map(p=>[`${p.round}-${p.draft_slot}`,p]));
  const rows=[];
  for(let r=1;r<=rounds;r++){
   if(select.value!=='all'&&String(r)!==select.value)continue;
   rows.push(`<tr><td>R${r}</td>${Array.from({length:slots},(_,i)=>{
    const p=byKey.get(`${r}-${i+1}`);if(!p)return '<td><div class="pick unpicked">Sin elección</div></td>';
    const f=window.assigned(window.roster(p.roster_id));
    const name=[p.metadata?.first_name,p.metadata?.last_name].filter(Boolean).join(' ')||window.playerName(p.player_id);
    const pos=p.metadata?.position||live.players[String(p.player_id)]?.position||'—';
    const teamCode=String(p.metadata?.team||live.players[String(p.player_id)]?.team||'').toUpperCase();
    const espnCode=({'JAC':'jax','WSH':'wsh','LA':'lar','OAK':'lv','SD':'lac','STL':'lar'})[teamCode]||teamCode.toLowerCase();
    const validCode=/^[a-z]{2,3}$/.test(espnCode);
    const pic=validCode?`<img class="draft-nfl-shield" loading="lazy" alt="Escudo ${ESC(nflName(teamCode))}" src="https://a.espncdn.com/i/teamlogos/nfl/500/${ESC(espnCode)}.png" onerror="this.style.display='none'">`:'';
    return `<td><div class="pick" data-pos="${ESC(pos)}"><span class="draft-owner">${f?window.logoImg(f.id):''}<span>${ESC(f?.name||window.rname(p.roster_id))}</span></span><span class="draft-player-line">${pic}<strong class="player">${ESC(name)}</strong></span><span class="draft-player-meta"><b>${ESC(pos)}</b> · ${ESC(nflName(teamCode))}</span></div></td>`;
   }).join('')}</tr>`);
  }
  $('draftData').innerHTML=`<div class="board-scroll"><table class="draftboard"><thead><tr><th>RONDA</th>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
 };
 window.v4RenderComparison=function(){
  const output=$('h2hResult'),mode=$('h2hMode')?.value==='all'?'all':'duel';
  const a=$('h2hA')?.value||'',b=$('h2hB')?.value||'';
  const field=$('h2hBField');if(field){field.hidden=mode==='all';field.style.display=mode==='all'?'none':'';}
  if(!output)return;
  if(!window.franchise(a)){output.innerHTML='<p class="empty">Elegí una franquicia.</p>';return}
  const history=Array.isArray(D.legacy_h2h_review)?D.legacy_h2h_review:[];
  const matches=window.completedGames().filter(g=>g.type==='regular');
  const ra=live.rosters.find(r=>window.assigned(r)?.id===a)?.roster_id;
  const statsFor=opp=>{
   const h=history.find(x=>(x.franchise_a_id===a&&x.franchise_b_id===opp)||(x.franchise_a_id===opp&&x.franchise_b_id===a));
   const old=h?(h.franchise_a_id===a?`${h.regular_wins_a}–${h.regular_wins_b}`:`${h.regular_wins_b}–${h.regular_wins_a}`):'—';
   const rb=live.rosters.find(r=>window.assigned(r)?.id===opp)?.roster_id;
   const games=ra!=null&&rb!=null?matches.filter(g=>(g.a===Number(ra)&&g.b===Number(rb))||(g.a===Number(rb)&&g.b===Number(ra))):[];
   const wins=games.filter(g=>(g.a===Number(ra)?g.pa:g.pb)>(g.a===Number(ra)?g.pb:g.pa)).length;
   const losses=games.filter(g=>(g.a===Number(ra)?g.pa:g.pb)<(g.a===Number(ra)?g.pb:g.pa)).length;
   const ties=games.length-wins-losses;
   return {old,now:`${wins}–${losses}${ties?' · '+ties+' E':''}`,games};
  };
  if(mode==='all'){
   const rows=D.franchises.filter(f=>f.id!==a).map(f=>{
    const s=statsFor(f.id);
    return [`<span class="cellteam">${window.logoImg(f.id)}${ESC(f.name)}</span>`,s.now,s.old,s.games.map(g=>'S'+g.week).join(', ')||'—'];
   });
   output.innerHTML=`<h3>${ESC(window.teamName(a))} frente a toda la LFA</h3><div class="tablewrap">${table(['Rival','Balance 2026','Historial','Semanas jugadas'],rows)}</div>`;
   return;
  }
  if(!window.franchise(b)||a===b){output.innerHTML='<p class="note">Elegí dos equipos distintos.</p>';return}
  const r=statsFor(b);
  output.innerHTML=`<div class="rivalry-hero">${window.logoImg(a)}<strong>${ESC(window.teamName(a))}</strong><span>${ESC(r.now)}</span><strong>${ESC(window.teamName(b))}</strong>${window.logoImg(b)}</div><p class="rivalry-foot">2026 · ${r.games.length} cruces disputados · Historial registrado: ${ESC(r.old)}</p>`;
 };
 window.v4EnhanceHistory=function(){
  if(typeof prevHistory==='function')prevHistory();
  const rank=$('legacyRanks');
  if(rank){
   const base=(window.v4HistoricalRows?.()||[]), scores=D.legacy_rankings_review||[];
   const rows=base.map(v=>{
    const legacy=scores.find(s=>s.franchise_id===v.f.id);
    const index=Number.isFinite(v.score)?v.score:Number(legacy?.legacy_score);
    return {...v,index};
   }).sort((a,b)=>(Number.isFinite(b.index)?b.index:-Infinity)-(Number.isFinite(a.index)?a.index:-Infinity));
   rank.innerHTML=table(['#','Franquicia','Índice LFA','G–P histórico','Títulos'],rows.map((v,i)=>[
    i+1,`<span class="cellteam">${window.logoImg(v.f.id)}<strong>${ESC(v.f.name)}</strong></span>`,
    Number.isFinite(v.index)?fmt(v.index):'—',v.wins!=null?`${v.wins}–${v.losses??'—'}`:'—',window.titles(v.f.id)
   ]))+'<p class="ranking-foot">Índice LFA histórico · Cifras provisionales en revisión.</p>';
  }
  const archive=$('historicalStories');if(!archive)return;
  const stories=(D.editorial||[]).map(s=>({title:s.title,description:s.description,year:s.year,category:s.status==='historical_document_review'?'ARCHIVO EN REVISIÓN':`${s.year} · HISTORIA`}));
  const standings=Array.isArray(D.standings_2025)?D.standings_2025:[];
  const pick=(cmp)=>standings.length?standings.slice().sort(cmp)[0]:null;
  const topPF=pick((a,b)=>b.pf-a.pf),bottomPF=pick((a,b)=>a.pf-b.pf),worstPA=pick((a,b)=>b.pa-a.pa),bestDiff=pick((a,b)=>b.difference-a.difference);
  if(topPF)stories.push({year:2025,title:'La ofensiva que hizo temblar la calculadora',description:`${window.teamName(topPF.franchise_id)} sumó ${fmt(topPF.pf)} puntos a favor en la fase regular de 2025. La planilla pidió vacaciones.`,category:'2025 · RÉCORD DE PUNTOS'});
  if(bottomPF)stories.push({year:2025,title:'Un ataque en huelga de puntos',description:`${window.teamName(bottomPF.franchise_id)} terminó 2025 con ${fmt(bottomPF.pf)} puntos a favor: el menor total entre los ocho equipos.`,category:'2025 · NÚMEROS CRUELES'});
  if(worstPA)stories.push({year:2025,title:'La defensa que recibió una lluvia de touchdowns',description:`A ${window.teamName(worstPA.franchise_id)} le anotaron ${fmt(worstPA.pa)} puntos en 2025: nadie recibió más durante aquella fase regular.`,category:'2025 · ANTIRRÉCORD'});
  if(bestDiff)stories.push({year:2025,title:'La mayor diferencia… y aun así no garantiza la copa',description:`${window.teamName(bestDiff.franchise_id)} terminó con ${fmt(bestDiff.difference)} puntos de diferencia en 2025. Un colchón enorme en la fase regular.`,category:'2025 · DIFERENCIA'});
  const finals=(D.seasons||[]).filter(s=>s.official&&s.final_score);
  const topFinal=finals.slice().sort((a,b)=>b.final_score.champion-a.final_score.champion)[0];
  const wide=finals.slice().sort((a,b)=>Math.abs(b.final_score.margin)-Math.abs(a.final_score.margin))[0];
  if(topFinal)stories.push({year:topFinal.year,title:'La noche en que una final rompió el marcador',description:`${topFinal.champion_name} metió ${fmt(topFinal.final_score.champion)} puntos en la final de ${topFinal.year}. Una marca de campeón entre las finales documentadas.`,category:`${topFinal.year} · FINAL BRUTAL`});
  if(wide)stories.push({year:wide.year,title:'La final con menos suspenso del archivo',description:`${wide.champion_name} aventajó a ${wide.runner_up_name} por ${fmt(Math.abs(wide.final_score.margin))} puntos en ${wide.year}. El subcampeón sigue pidiendo revancha.`,category:`${wide.year} · PALIZA HISTÓRICA`});
  const legacy=Array.isArray(D.legacy_stats_review)?D.legacy_stats_review:[];
  const seasons=legacy.flatMap(s=>Object.entries(s.season_points||{}).filter(([y,pts])=>Number(y)>=2019&&Number(y)<=2024&&Number(pts)>0&&s.franchise_id).map(([year,pts])=>({year:Number(year),pts:Number(pts),franchise:s.franchise_id})));
  const high=seasons.sort((a,b)=>b.pts-a.pts)[0];
  if(high)stories.push({year:high.year,title:'El año de los puntos imposibles',description:`El archivo de temporada registra ${fmt(high.pts)} puntos para ${window.teamName(high.franchise)} en ${high.year}. Una cifra enorme pendiente de cotejo definitivo.`,category:`${high.year} · MARCA DE ARCHIVO`});
  stories.push({year:2018,title:'Antes de los anillos hubo una era salvaje',description:'Nuevos Santos levantó la copa de 2018, la prehistoria de la LFA. Aquella temporada no cuenta para el palmarés profesional iniciado en 2019.',category:'2018 · PREHISTORIA'});
  const seen=new Set(),unique=stories.sort((a,b)=>b.year-a.year).filter(s=>{const key=idKey(s.title);if(seen.has(key))return false;seen.add(key);return true});
  archive.innerHTML='<div class="oldpaper-banner"><span>HECHOS HISTÓRICOS · LA MEMORIA DE LA LFA</span><h2>EL ARCHIVO PROHIBIDO</h2><p>Rachas, ridículos, grandes noches y números que nadie pudo borrar</p></div><div class="paper-grid">'+unique.map((s,i)=>window.v4StoryArticle(s,i)).join('')+'</div>';
 };
 // Las funciones originales de app.js utilizan referencias globales a estos nombres.
 window.renderNews=window.v4RenderNews;
 window.renderDraft=window.v4RenderDraft;
 window.renderComparison=window.v4RenderComparison;
 // Captura de eventos para impedir que el handler antiguo procese la vista 'uno contra siete'.
 for(const id of ['h2hA','h2hB','h2hMode']){
  $(id)?.addEventListener('change',e=>{e.stopImmediatePropagation();window.v4RenderComparison()},true);
 }
 // Poner los nuevos renderizadores en acción sin esperar una sincronización de Sleeper.
 if($('newsGrid'))window.v4RenderNews();
 if(live.ready){
  window.v4RenderRosters();
  window.v4RenderDraft();
  window.v4RenderComparison();
 }
 window.v4EnhanceHistory();
 // Preferencia española, traducción solo si se consigue verificar y nunca en texto visible inglés.
 window.v4FetchNflNews();
 // El módulo anterior pudo iniciar una consulta justo antes de cargar esta edición.
 // Reintentar después de su timeout para asegurar titulares en español desde la primera visita.
 setTimeout(()=>window.v4FetchNflNews(),12000);
})();
