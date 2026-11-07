/* LFA – matriz histórica de rivalidades, con archivo y temporada separados. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const root=$('rivalryMatrix');
 const scope=$('matrixScope');
 const note=$('rivalryMatrixNote');
 if(!root||!scope||!note)return;
 const safe=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const franchises=Array.isArray(D.franchises)?D.franchises:[];
 const hist=Array.isArray(D.legacy_h2h_review)?D.legacy_h2h_review:[];
 function resolve(a,b){
  if(scope.value==='historico'){
   const h=hist.find(x=>(x.franchise_a_id===a&&x.franchise_b_id===b)||(x.franchise_a_id===b&&x.franchise_b_id===a));
   if(!h)return null;
   return h.franchise_a_id===a?
    [Number(h.regular_wins_a||0)+Number(h.playoff_wins_a||0),Number(h.regular_wins_b||0)+Number(h.playoff_wins_b||0)]:
    [Number(h.regular_wins_b||0)+Number(h.playoff_wins_b||0),Number(h.regular_wins_a||0)+Number(h.playoff_wins_a||0)];
  }
  if(!live.ready)return null;
  const ra=live.rosters.find(r=>assigned(r)?.id===a)?.roster_id;
  const rb=live.rosters.find(r=>assigned(r)?.id===b)?.roster_id;
  if(ra==null||rb==null)return null;
  const games=completedGames().filter(g=>g.type==='regular'&&
   ((g.a===Number(ra)&&g.b===Number(rb))||(g.a===Number(rb)&&g.b===Number(ra))));
  let wins=0,losses=0;
  for(const g of games){
   const pa=g.a===Number(ra)?g.pa:g.pb;
   const pb=g.a===Number(ra)?g.pb:g.pa;
   if(pa>pb)wins++;else if(pa<pb)losses++;
  }
  return [wins,losses];
 }
 function draw(){
  if(franchises.length!==8){root.innerHTML='<p class="empty">Cuadro no disponible.</p>';return}
  note.textContent=scope.value==='historico'?
   'Archivo histórico registrado: fase regular y playoffs. Corte histórico pendiente de verificación; 2026 se muestra aparte.':
   'Temporada 2026: solo encuentros de fase regular finalizados y confirmados por Sleeper.';
  const heads=franchises.map(f=>'<th scope="col" title="'+safe(f.name)+'"><span class="matrix-team">'+logoImg(f.id)+'<small>'+safe(f.name)+'</small></span></th>').join('');
  const body=franchises.map(a=>'<tr><th scope="row"><span class="matrix-row-team">'+logoImg(a.id)+'<b>'+safe(a.name)+'</b></span></th>'+
   franchises.map(b=>{
    if(a.id===b.id)return '<td class="matrix-self" aria-label="Mismo equipo">◆</td>';
    const result=resolve(a.id,b.id);
    if(!result)return '<td class="matrix-empty" title="Sin registro">—</td>';
    const [w,l]=result;
    const css=w>l?'matrix-ahead':w<l?'matrix-behind':'matrix-even';
    return '<td class="'+css+'"><button type="button" class="matrix-cell" data-rival-a="'+safe(a.id)+'" data-rival-b="'+safe(b.id)+'" aria-label="'+safe(a.name)+' contra '+safe(b.name)+': '+w+' ganados, '+l+' perdidos" title="'+safe(a.name)+' vs '+safe(b.name)+'">'+w+'–'+l+'</button></td>';
   }).join('')+'</tr>').join('');
  root.innerHTML='<table class="rivalry-matrix"><thead><tr><th scope="col" class="matrix-corner">VS</th>'+heads+'</tr></thead><tbody>'+body+'</tbody></table>';
 }
 root.addEventListener('click',ev=>{
  const button=ev.target.closest('[data-rival-a][data-rival-b]');
  if(!button)return;
  const a=$('h2hA'),b=$('h2hB'),mode=$('h2hMode');
  if(!a||!b||!mode)return;
  a.value=button.dataset.rivalA;b.value=button.dataset.rivalB;mode.value='duel';
  try{if(typeof window.v4RenderComparison==='function')window.v4RenderComparison()}catch(e){console.warn('[LFA] Rivalidad:',e)}
  $('rivalryLookup')?.scrollIntoView({behavior:'smooth',block:'start'});
 });
 scope.addEventListener('change',draw);
 ['h2hA','h2hB','h2hMode'].forEach(id=>$(id)?.addEventListener('change',draw));
 let queued=false;
 const rerender=()=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;draw()});
 };
 const standings=$('standingsLive');
 if(standings)new MutationObserver(rerender).observe(standings,{childList:true});
 draw();
})();
