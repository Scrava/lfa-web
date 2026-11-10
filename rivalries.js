/* LFA · Una sola fuente de verdad para matriz y búsqueda de Paternidades */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const matrix=$('rivalryMatrix'),scope=$('matrixScope'),note=$('rivalryMatrixNote'),
       output=$('h2hResult'),mode=$('h2hMode'),selA=$('h2hA'),selB=$('h2hB'),
       bField=$('h2hBField'),historyPanel=$('rivalryLookup');
 const core=window.LFA_RIVALRY_CORE;
 if(!matrix||!scope||!note||!output||!mode||!selA||!selB||!core)return;
 const teams=Array.isArray(D.franchises)?D.franchises:[];
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const teamName=id=>teams.find(x=>x.id===id)?.name||id;
 const teamLogo=id=>{try{return logoImg(id)}catch{return ''}};
 const pair=(a,b)=>({
   old:core.history(D.legacy_h2h_review,a,b),
   year:core.season(live.rosters,live.ready?completedGames():[],r=>assigned(r)?.id,a,b)
 });
 const fmt=(v,withTies=false)=>!v||!v.count?'—':v.wins+'–'+v.losses+(withTies&&v.ties?' ('+v.ties+' E)':'');
 // Mostramos 0–0 cuando hay un registro histórico formal de 0 encuentros.
 const formatArchive=v=>v?v.wins+'–'+v.losses:'—';
 const formatSeason=v=>v&&v.count?v.wins+'–'+v.losses+(v.ties?' ('+v.ties+' E)':''):'—';
 const tableView=()=>scope.value===String(ACTIVE_SEASON)?'year':'old';
 function ensureOptions(){
   if(!teams.length)return;
   const valid=new Set(teams.map(f=>f.id));
   const opts=teams.map(f=>'<option value="'+safe(f.id)+'">'+safe(f.name)+'</option>').join('');
   for(const select of [selA,selB]){
     const original=select.value;
     if(select.options.length!==teams.length||[...select.options].some(x=>!valid.has(x.value))){
       select.innerHTML=opts;
       if(valid.has(original))select.value=original;
     }
   }
   if(!valid.has(selA.value))selA.value=teams[0]?.id||'';
   if(!valid.has(selB.value))selB.value=teams.find(t=>t.id!==selA.value)?.id||'';
 }
 function detailItem(a,b,p,scopeKey){
   const value=p[scopeKey];
   const text=scopeKey==='old'?formatArchive(value):formatSeason(value);
   const label=scopeKey==='old'?'Histórico registrado':'Temporada '+ACTIVE_SEASON;
   return '<div class="rivalry-detail-stat"><small>'+label+'</small><b>'+safe(text)+'</b></div>';
 }
 function renderLookup(){
   ensureOptions();
   const a=selA.value,b=selB.value,all=mode.value==='all';
   if(bField){bField.hidden=all;bField.style.display=all?'none':''}
   if(!teams.find(t=>t.id===a)){output.innerHTML='<p class="empty">Elegí un equipo.</p>';return}
   const focus=tableView();
   if(all){
     const rows=teams.filter(t=>t.id!==a).map(t=>{
       const p=pair(a,t.id);
       return '<tr><td><span class="cellteam">'+teamLogo(t.id)+safe(t.name)+'</span></td>'+
         '<td class="'+(focus==='old'?'rivalry-focus':'')+'">'+safe(formatArchive(p.old))+'</td>'+
         '<td class="'+(focus==='year'?'rivalry-focus':'')+'">'+safe(formatSeason(p.year))+'</td>'+
         '<td><button class="rivalry-action" type="button" data-focus-a="'+safe(a)+'" data-focus-b="'+safe(t.id)+'">Ver cruce</button></td></tr>';
     }).join('');
     output.innerHTML='<h3>'+safe(teamName(a))+' frente a los otros '+(teams.length===8?'siete':'nueve')+'</h3>'+
       '<div class="rivalry-results-scroll"><table class="rivalry-result-table"><thead><tr><th>Rival</th><th>Histórico</th><th>'+ACTIVE_SEASON+'</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
       '<p class="rivalry-foot">Histórico: temporada regular y playoffs registrados. El año '+ACTIVE_SEASON+' se muestra por separado.</p>';
     return;
   }
   if(a===b||!teams.find(t=>t.id===b)){output.innerHTML='<p class="note">Elegí dos franquicias distintas.</p>';return}
   const p=pair(a,b);
   const primary=focus==='old'?formatArchive(p.old):formatSeason(p.year);
   const old=p.old,year=p.year;
   const oldSubtitle=old?
     'Temporada regular '+old.regular.wins+'–'+old.regular.losses+' · Playoffs '+old.playoffs.wins+'–'+old.playoffs.losses:
     'Sin registros históricos';
   const yearSubtitle=year?.count?
     year.count+' cruces cerrados · Semanas '+(year.weeks||[]).join(', '):
     'Sin enfrentamientos cerrados en '+ACTIVE_SEASON;
   output.innerHTML='<div class="rivalry-duel">'+
     '<div class="rivalry-duel-team">'+teamLogo(a)+'<strong>'+safe(teamName(a))+'</strong></div>'+
     '<div class="rivalry-duel-score"><small>'+safe(focus==='old'?'HISTORIAL REGISTRADO':String(ACTIVE_SEASON))+'</small><b>'+safe(primary)+'</b></div>'+
     '<div class="rivalry-duel-team">'+teamLogo(b)+'<strong>'+safe(teamName(b))+'</strong></div></div>'+
     '<div class="rivalry-detail-grid">'+detailItem(a,b,p,'old')+detailItem(a,b,p,'year')+'</div>'+
     '<p class="rivalry-foot">'+safe(oldSubtitle)+'<span class="rivalry-foot-divider"> · </span>'+safe(yearSubtitle)+'</p>';
 }
 function renderMatrix(){
  ensureOptions();
  if(![8,10].includes(teams.length)){matrix.innerHTML='<p class="empty">Cuadro no disponible.</p>';return}
  const focus=tableView();
  note.textContent=focus==='old'?
   'Historial registrado: fase regular y playoffs. La temporada '+ACTIVE_SEASON+' se consulta por separado.':
   'Temporada '+ACTIVE_SEASON+': solamente enfrentamientos finalizados de fase regular.';
  const heads=teams.map(t=>'<th scope="col" title="'+safe(t.name)+'"><span class="matrix-team">'+teamLogo(t.id)+'<small>'+safe(t.name)+'</small></span></th>').join('');
  const rows=teams.map(a=>'<tr><th scope="row"><span class="matrix-row-team">'+teamLogo(a.id)+'<b>'+safe(a.name)+'</b></span></th>'+
   teams.map(b=>{
     if(a.id===b.id)return '<td class="matrix-self">◆</td>';
     const value=pair(a.id,b.id)[focus];
     const label=focus==='old'?formatArchive(value):formatSeason(value);
     const neutral=focus==='year'&&!value?.count;
     const css=neutral?'matrix-empty':value&&value.wins>value.losses?'matrix-ahead':value&&value.wins<value.losses?'matrix-behind':'matrix-even';
     return '<td class="'+css+'"><button type="button" class="matrix-cell" data-rival-a="'+safe(a.id)+'" data-rival-b="'+safe(b.id)+'" aria-label="'+safe(a.name)+' contra '+safe(b.name)+': '+safe(label)+'">'+safe(label)+'</button></td>';
   }).join('')+'</tr>').join('');
  matrix.innerHTML='<table class="rivalry-matrix'+(teams.length===10&&ACTIVE_SEASON>=2027?' rivalry-matrix-ten':'')+'"><thead><tr><th scope="col" class="matrix-corner">VS</th>'+heads+'</tr></thead><tbody>'+rows+'</tbody></table>';
 }
 function renderAll(){renderMatrix();renderLookup()}
 function selectDuel(a,b){
   ensureOptions();selA.value=a;selB.value=b;mode.value='duel';
   renderLookup();
   historyPanel?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 matrix.addEventListener('click',ev=>{
   const btn=ev.target.closest('[data-rival-a][data-rival-b]');
   if(btn)selectDuel(btn.dataset.rivalA,btn.dataset.rivalB);
 });
 output.addEventListener('click',ev=>{
   const btn=ev.target.closest('[data-focus-a][data-focus-b]');
   if(btn)selectDuel(btn.dataset.focusA,btn.dataset.focusB);
 });
 for(const control of [selA,selB,mode])control.addEventListener('change',renderLookup);
 scope.addEventListener('change',renderAll);
 window.LFA_RIVALRIES={pair,renderLookup,renderMatrix,renderAll};
 // El motor original continúa llamando renderComparison() luego de cada fecha.
 // Reemplazamos ambas funciones globales para evitar cálculos antiguos.
 window.v4RenderComparison=renderLookup;
 window.renderComparison=renderLookup;
 const originalRenderStandings=window.renderStandings;
 if(typeof originalRenderStandings==='function'){
   window.renderStandings=function(...args){
     const result=originalRenderStandings(...args);
     renderAll();
     return result;
   };
 }
 renderAll();
})();
