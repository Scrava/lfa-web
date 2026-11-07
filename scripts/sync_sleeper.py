#!/usr/bin/env python3
"""Sincronizador LFA: Sleeper -> JSON para Netlify/GitHub Pages.

El script falla sin sobrescribir los datos anteriores si no puede validar la liga.
No produce lesiones ni marcadores ficticios; solo etiqueta estados reportados por Sleeper.
La API de Sleeper es de solo lectura y el catálogo de jugadores se renueva máximo 1/día.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
import json
import math
import os
import time

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
API='https://api.sleeper.app/v1/'
LEAGUE_ID='1388976988894543872'

def get(path:str):
    req=Request(API+path,headers={'Accept':'application/json','User-Agent':'LFA-archive/1.0 (noncommercial)'})
    with urlopen(req,timeout=25) as resp:
        if resp.status != 200: raise RuntimeError(f'{path}: HTTP {resp.status}')
        return json.load(resp)

def write_json(path,object):
    tmp=path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(object,ensure_ascii=False,indent=2,sort_keys=False)+'\n',encoding='utf-8')
    tmp.replace(path)

def update_catalog(now):
    path=DATA/'player_catalog.json'
    if path.exists():
        try:
            old=json.loads(path.read_text(encoding='utf-8'))
            age=(now-datetime.fromisoformat(old['generated_at']).astimezone(timezone.utc)).total_seconds()
            if age < 24*3600 and isinstance(old.get('players'),dict):
                return old['players'], False
        except (ValueError,KeyError,TypeError): pass
    # Sleeper recomienda descargar /players/nfl como máximo una vez por día.
    all_players=get('players/nfl')
    compact={str(k):{'name':p.get('full_name') or ' '.join([p.get('first_name') or '',p.get('last_name') or '']).strip(),'position':p.get('position'),'injury_status':p.get('injury_status'),'team':p.get('team')}
             for k,p in all_players.items() if isinstance(p,dict)}
    write_json(path,{'generated_at':now.isoformat(),'source':'Sleeper /players/nfl','players':compact})
    return compact, True

def name_of_roster(rid,league,users,rosters):
    r=next((r for r in rosters if str(r.get('roster_id'))==str(rid)),None)
    if not r:return f'Roster {rid}'
    u=next((u for u in users if str(u.get('user_id'))==str(r.get('owner_id'))),{})
    return r.get('metadata',{}).get('team_name') or u.get('metadata',{}).get('team_name') or u.get('display_name') or f'Roster {rid}'

def player_name(pid,players):
    return players.get(str(pid),{}).get('name') or f'Jugador #{pid}'

def completed_matchups(matchups,week,playoff_start):
    results=[]
    for w,rows in matchups.items():
        try:wi=int(w)
        except ValueError:continue
        if wi>=week:continue # no confundir puntos de la semana en juego con resultados definitivos
        pairs={}
        for r in rows:
            if r.get('matchup_id') is not None:pairs.setdefault(str(r['matchup_id']),[]).append(r)
        for rs in pairs.values():
            if len(rs)!=2:continue
            a,b=rs
            if not all(v.get('points') is not None for v in rs):continue
            try:pa,pb=float(a['points']),float(b['points'])
            except (TypeError,ValueError):continue
            if not (math.isfinite(pa) and math.isfinite(pb)):continue
            results.append({'week':wi,'a':a['roster_id'],'b':b['roster_id'],'pa':pa,'pb':pb,'phase':'playoffs' if wi>=playoff_start else 'regular'})
    return sorted(results,key=lambda a:a['week'])

def build_news(now,league,users,rosters,matchups,transactions,players,week):
    stamp=now.isoformat();news=[]
    def add(category,title,description,fact,tag):
        news.append({'id':tag,'category':category,'title':title,'description':description,'fact':fact,'updated_at':stamp,'source':'Sleeper API','season':2026})
    stands=sorted(rosters,key=lambda r:(-int(r.get('settings',{}).get('wins') or 0),int(r.get('settings',{}).get('losses') or 0),-float(r.get('settings',{}).get('fpts') or 0)))
    if stands:
        top,bot=stands[0],stands[-1]
        tn=name_of_roster(top['roster_id'],league,users,rosters);bn=name_of_roster(bot['roster_id'],league,users,rosters)
        ts,bs=top.get('settings',{}),bot.get('settings',{})
        add('PANORAMA','El termómetro de la LFA',f'{tn} está primero ({ts.get("wins",0)}–{ts.get("losses",0)}). {bn} cierra la tabla ({bs.get("wins",0)}–{bs.get("losses",0)}). Los puntos no dan lugar a la interpretación; los memes, sí.',f'Standings de Sleeper · corte {now.strftime("%d/%m/%Y %H:%M UTC")}',f'standings-{week}')
    games=completed_matchups(matchups,week,int(league.get('settings',{}).get('playoff_week_start') or 15))
    latest=[g for g in games if g['week']==week-1]
    if latest:
        g=max(latest,key=lambda a:abs(a['pa']-a['pb']))
        win=g['a'] if g['pa']>=g['pb'] else g['b'];lose=g['b'] if win==g['a'] else g['a']
        add('FOLKLORE','La peor paliza de la última fecha',f'{name_of_roster(win,league,users,rosters)} le ganó a {name_of_roster(lose,league,users,rosters)} por {abs(g["pa"]-g["pb"]):.2f} puntos. El calendario no declara en el tribunal de las excusas.',f'Sleeper, semana {g["week"]} · resultado final',f'rout-{g["week"]}')
    trx=[t for ts in transactions.values() for t in ts if t.get('status')=='complete' and t.get('type') in ('trade','waiver','free_agent')]
    trx.sort(key=lambda t:t.get('status_updated') or t.get('created') or 0,reverse=True)
    for t in trx[:3]:
        names=[player_name(pid,players) for pid in (t.get('adds') or {}).keys()][:3]
        parties=[name_of_roster(r,league,users,rosters) for r in (t.get('roster_ids') or [])]
        operation={'waiver':'waiver','trade':'trade','free_agent':'movimiento de agente libre'}.get(t.get('type'),t.get('type','operación'))
        tail=f' Los jugadores adquiridos: {", ".join(names)}.' if names else ' El desglose de los jugadores está en Mercado.'
        add('MERCADO',f'Se confirmó un {operation}',f'{" y ".join(parties) or "Una franquicia"} registró una operación completada.{tail}',f'Sleeper · ID {t.get("transaction_id", "")} · fecha {datetime.fromtimestamp((t.get("status_updated") or t.get("created") or 0)/1000,timezone.utc).strftime("%d/%m/%Y")}',f'tx-{t.get("transaction_id")}')
    flagged=[]
    for r in rosters:
        for pid in r.get('starters') or []:
            p=players.get(str(pid)) or {}
            status=str(p.get('injury_status') or '')
            if status in ('Out','Questionable','Doubtful','IR','Injured Reserve','Suspended'):
                flagged.append((str(pid),r.get('roster_id'),status))
    for pid,rid,status in flagged[:2]:
        add('PLANTELES',f'{player_name(pid,players)}: estado a seguir',f'{name_of_roster(rid,league,users,rosters)} tiene a {player_name(pid,players)} con etiqueta “{status}” en Sleeper. Es una clasificación de esa plataforma, no un parte médico independiente.',f'Estado del roster consultado {now.strftime("%d/%m/%Y %H:%M UTC")}',f'status-{pid}-{week}')
    return news

def main():
    now=datetime.now(timezone.utc)
    # La validación de temporada va antes de escribir cualquier archivo.
    league=get(f'league/{LEAGUE_ID}')
    if not isinstance(league,dict) or str(league.get('league_id'))!=LEAGUE_ID or str(league.get('season'))!='2026':
        raise RuntimeError('Sleeper no confirmó la liga 2026: no se actualizará nada.')
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures={k:pool.submit(get,k) for k in [f'league/{LEAGUE_ID}/users',f'league/{LEAGUE_ID}/rosters','state/nfl',f'league/{LEAGUE_ID}/drafts',f'league/{LEAGUE_ID}/winners_bracket']}
        answers={k:f.result() for k,f in futures.items()}
    users=answers[f'league/{LEAGUE_ID}/users'];rosters=answers[f'league/{LEAGUE_ID}/rosters'];nfl=answers['state/nfl']
    if not isinstance(users,list) or not isinstance(rosters,list) or len(rosters)<1:raise RuntimeError('Sleeper devolvió usuarios/rosters incompletos.')
    week=max(1,min(18,int(nfl.get('week') or 1)))
    paths=[(i,f'league/{LEAGUE_ID}/{kind}/{i}') for i in range(1,week+1) for kind in ('matchups','transactions')]
    matchups={};transactions={}
    with ThreadPoolExecutor(max_workers=5) as pool:
        ff={pool.submit(get,p): (i,p) for i,p in paths}
        for f in as_completed(ff):
            i,p=ff[f]
            try:data=f.result()
            except Exception as exc:raise RuntimeError(f'Error de sincronización en {p}: {exc}')
            (matchups if '/matchups/' in p else transactions)[str(i)]=data
    drafts=answers[f'league/{LEAGUE_ID}/drafts'] or []
    draft=next((d for d in drafts if str(d.get('draft_id'))==str(league.get('draft_id'))),None) or next((d for d in drafts if str(d.get('season'))=='2026'),None)
    picks=get(f'draft/{draft["draft_id"]}/picks') if draft else []
    bracket=answers[f'league/{LEAGUE_ID}/winners_bracket'] or []
    try:players,fetched=update_catalog(now)
    except Exception as exc:
        print('AVISO: catálogo no disponible:',exc)
        try:players=json.loads((DATA/'player_catalog.json').read_text(encoding='utf-8'))['players']
        except Exception:players={}
    used={str(p) for r in rosters for p in (r.get('players') or [])}
    for t in [tt for ts in transactions.values() for tt in ts]:used.update(map(str,(t.get('adds') or {}).keys()));used.update(map(str,(t.get('drops') or {}).keys()))
    for p in picks:used.add(str(p.get('player_id')))
    small={pid:players[pid] for pid in used if pid in players}
    snap={'generated_at':now.isoformat(),'source':'Sleeper API','league_id':LEAGUE_ID,'week':week,'league':league,'users':users,'rosters':rosters,'nfl':nfl,'matchups':matchups,'transactions':transactions,'bracket':bracket,'draft':draft,'picks':picks,'players':small}
    news=build_news(now,league,users,rosters,matchups,transactions,players,week)
    write_json(DATA/'live_snapshot.json',snap)
    write_json(DATA/'auto_news.json',news)
    print(f'LFA {LEAGUE_ID}: temporada {league["season"]}, semana {week}, {len(rosters)} rosters, {len(picks)} picks, {len(news)} noticias. Catálogo: {len(players)} jugadores. {now.isoformat()}')

if __name__=='__main__':main()
