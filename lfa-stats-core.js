window.LFA_STATS_CORE = (function StatsCore(){
 'use strict';
 function rows(payload){
  if(Array.isArray(payload))return payload;
  if(Array.isArray(payload?.players))return payload.players;
  if(Array.isArray(payload?.data))return payload.data;
  if(payload&&typeof payload==="object")return Object.entries(payload).map(([id,v])=>v&&typeof v==="object"?{...v,player_id:v.player_id||id}:null).filter(Boolean);
  return [];
 }
 function mapPpr(payload){const points={},positions={};
  for(const r of rows(payload)){
   if(!r||typeof r!=="object")continue;
   const id=String(r.player_id??r.player?.player_id??r.id??'');
   const v=r.stats?.pts_ppr??r.pts_ppr;
   const pts=v==null?NaN:Number(v);
   if(!id||!Number.isFinite(pts))continue;
   points[id]=pts;
   const pos=String(r.player?.position||r.position||r.player?.fantasy_positions?.[0]||'').toUpperCase();
   if(pos)positions[id]=pos;
  }
  return {points,positions};
 }
 function ranks(points,positions,fallback={}){
  const groups={};const out={};
  for(const [id,value] of Object.entries(points||{})){
   const pos=String(positions?.[id]||fallback?.[id]?.position||'').toUpperCase();
   if(!['QB','RB','WR','TE','K','DEF'].includes(pos))continue;
   (groups[pos]||=[]).push([id,Number(value)]);
  }
  for(const [pos,pairs] of Object.entries(groups)){
   pairs.sort((a,b)=>b[1]-a[1]);let rank=0,previous=null;
   for(let i=0;i<pairs.length;i++){if(previous===null||pairs[i][1]!==previous)rank=i+1;out[pairs[i][0]]=pos+rank;previous=pairs[i][1]}
  }
  return out;
 }
 function totalProjected(starters,points){
  const ids=(starters||[]).map(String).filter(x=>x&&x!=='0');
  if(!ids.length)return null;
  const found=ids.filter(id=>Object.hasOwn(points||{},id)&&Number.isFinite(Number(points[id])));
  return {available:found.length,required:ids.length,complete:found.length===ids.length,
   total:found.reduce((sum,id)=>sum+Number(points[id]),0)};
 }
 function nflCode(v){const x=String(v||'').toUpperCase();return ({JAC:'JAX',WSH:'WAS',OAK:'LV',SD:'LAC',STL:'LAR',LA:'LAR'})[x]||x}
 return {rows,mapPpr,ranks,totalProjected,nflCode};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=window.LFA_STATS_CORE;
