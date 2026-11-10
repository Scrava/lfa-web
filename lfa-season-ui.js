/* Etiquetas dinámicas para cada nueva temporada de la LFA. */
(function initLfaSeasonUI(){
 'use strict';
 const year=Number(D.league.current_season||2026),edition=year-2018;
 // Las adaptaciones visuales de 10 equipos no se aplican a la temporada 2026.
 const expanded=year>=2027&&D.franchises.length===10;
 document.body.classList.toggle('lfa-ten-franchises',expanded);
 if(expanded){
  // Solo cuando los 10 GM están verificados en Sleeper. En 2026 no modifica el DOM.
  text('.view[data-view="rosters"] .eyetop','LOS DIEZ PLANTELES');
  text('.view[data-view="equipos"] .pagetitle','Los diez sospechosos de siempre');
  text('.view[data-view="paternidades"] .intro','El cuadro histórico de los diez equipos. Tocá cualquier cruce para conocer la rivalidad.');
  const allOpponents=document.querySelector('#h2hMode option[value="all"]');
  if(allOpponents)allOpponents.textContent='Un equipo contra los otros nueve';
  const desc=document.querySelector('meta[name="description"]');
  if(desc)desc.content=desc.content.replace('ocho franquicias','diez franquicias');
 }
 const text=(selector,value)=>{const e=document.querySelector(selector);if(e)e.textContent=value};
 text('.navbutton[data-page="temporada"]','Temporada '+year);
 text('#syncInfo','Temporada '+year);
 text('.home-heading .eyetop','LFA · TEMPORADA '+year);
 text('.view[data-view="temporada"] .pagetitle','La carrera de '+year);
 text('.season-standings-panel .panel-header .chip','Sleeper '+year);
 text('.view[data-view="movimientos"] .panel-header h3','Operaciones de '+year);
 text('.view[data-view="draft"] .eyetop','DRAFT NIGHT · '+year);
 const draftHeader=document.querySelector('.view[data-view="draft"] .panel-header h3');
 if(draftHeader&&draftHeader.firstChild)draftHeader.firstChild.textContent='Draft '+year+' ';
 text('.view[data-view="records"] .panel-header h3','Marcas destacadas · '+year);
 text('.diario-cover-date','LA VOZ DE LA LIGA · '+year);
 text('.diario-cover-footer','FANTASY FOOTBALL · EDICIÓN Nº'+edition);
 const seasonRecords=document.querySelector('#seasonRecordYear');
 if(seasonRecords&&!Array.from(seasonRecords.options).some(x=>x.value===String(year))){
  const opt=document.createElement('option');opt.value=String(year);opt.textContent=String(year);seasonRecords.prepend(opt);
 }
 const matrix=document.querySelector('#matrixScope');
 if(matrix){
  const opt=Array.from(matrix.options).find(x=>x.value!=='historico');
  if(opt){opt.value=String(year);opt.textContent='Temporada '+year}
 }
 const dock=document.querySelector('.mobile-dock [data-go="temporada"]');
 if(dock)dock.setAttribute('aria-label','Temporada '+year);
 if(year!==2026){
  const current=document.querySelector('#seasonRecordYear');
  if(current)current.value=String(year);
  window.LFA_RIVALRIES?.renderAll();
  if(typeof window.v4RenderSeasons==='function')window.v4RenderSeasons();
 }
})();
