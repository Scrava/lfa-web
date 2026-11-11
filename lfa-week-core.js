/* Semana LFA: cambio semanal los martes a las 00:00 de Buenos Aires. */
(function(root,factory){
 const week=factory();
 if(typeof module==='object'&&module.exports)module.exports=week;
 if(root)root.LFA_WEEK_CORE=week;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const timeZone='America/Argentina/Buenos_Aires',MS_DAY=86400000;
 function weekOneTuesday(year){
  const y=Number(year);
  if(!Number.isInteger(y)||y<2000||y>2100)return null;
  const first=new Date(Date.UTC(y,8,1));
  const daysToMonday=(8-first.getUTCDay())%7;
  return Date.UTC(y,8,1+daysToMonday+1);
 }
 function leagueDate(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{
   timeZone,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(now);
  const fields=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return Date.UTC(Number(fields.year),Number(fields.month)-1,Number(fields.day));
 }
 function calendarWeek(season,now=new Date()){
  const anchor=weekOneTuesday(season);
  if(anchor===null)return 1;
  const elapsed=Math.floor((leagueDate(now)-anchor)/MS_DAY);
  return Math.max(1,Math.min(18,Math.floor(elapsed/7)+1));
 }
 function resolveWeek({season,status,nflWeek,seasonType}={},now=new Date()){
  if(['pre_draft','drafting'].includes(String(status||'').toLowerCase()))return 1;
  if(String(status||'').toLowerCase()==='complete')return 18;
  if(String(seasonType||'').toLowerCase()==='post')
   return Math.max(1,Math.min(18,Number(nflWeek)||18));
  return calendarWeek(season,now);
 }
 return {weekOneTuesday,calendarWeek,resolveWeek,leagueDate};
});
