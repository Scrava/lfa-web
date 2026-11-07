/* LFA: un único cálculo de balances usado por cuadro y buscador.
   Históricos: fase regular + playoffs. 2026: partidos regulares cerrados. */
(function(root,factory){
  const lib=factory();
  if(typeof module==='object'&&module.exports)module.exports=lib;
  if(root)root.LFA_RIVALRY_CORE=lib;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  function history(entries,a,b){
    const h=(Array.isArray(entries)?entries:[]).find(x=>
      (x.franchise_a_id===a&&x.franchise_b_id===b)||
      (x.franchise_a_id===b&&x.franchise_b_id===a));
    if(!h)return null;
    const flipped=h.franchise_a_id!==a;
    const reg=[n(h.regular_wins_a),n(h.regular_wins_b)];
    const play=[n(h.playoff_wins_a),n(h.playoff_wins_b)];
    if(flipped){reg.reverse();play.reverse()}
    const wins=reg[0]+play[0],losses=reg[1]+play[1];
    return {wins,losses,ties:0,count:wins+losses,
      regular:{wins:reg[0],losses:reg[1]},
      playoffs:{wins:play[0],losses:play[1]},
      available:true};
  }
  function season(rosters,games,resolveTeam,a,b){
    const rosterRows=Array.isArray(rosters)?rosters:[];
    const rA=rosterRows.find(x=>resolveTeam(x)===a)?.roster_id;
    const rB=rosterRows.find(x=>resolveTeam(x)===b)?.roster_id;
    if(rA==null||rB==null)return null;
    const played=(Array.isArray(games)?games:[]).filter(g=>g.type==='regular'&&
      ((Number(g.a)===Number(rA)&&Number(g.b)===Number(rB))||
       (Number(g.a)===Number(rB)&&Number(g.b)===Number(rA))));
    let wins=0,losses=0,ties=0;
    for(const g of played){
      const first=Number(g.a)===Number(rA)?n(g.pa):n(g.pb);
      const second=Number(g.a)===Number(rA)?n(g.pb):n(g.pa);
      if(first>second)wins++;else if(first<second)losses++;else ties++;
    }
    return {wins,losses,ties,count:played.length,
      weeks:played.map(g=>g.week),available:true};
  }
  return {history,season};
});
