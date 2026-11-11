#!/usr/bin/env python3
"""Archivado confirmado y transición segura LFA entre ligas Sleeper.

Nunca inventa campeones ni cambia de año por fecha. Exige liga anterior finalizada,
resultado de la final verificable y sucesora vinculada por previous_league_id.
"""
from __future__ import annotations

import copy
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
API = "https://api.sleeper.app/v1/"
BOOT_PREFIX = "window.LFA_DATA = "


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_bootstrap(path: Path):
    raw = path.read_text(encoding="utf-8").strip()
    if not raw.startswith(BOOT_PREFIX) or not raw.endswith(";"):
        raise ValueError("Formato de bootstrap LFA no reconocido")
    return json.loads(raw[len(BOOT_PREFIX):-1])


def write_bootstrap(path: Path, value):
    path.write_text(BOOT_PREFIX + json.dumps(value, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")


def get(path: str):
    with urlopen(Request(API + path, headers={"Accept": "application/json", "User-Agent": "LFA-season-manager/1.0"}), timeout=22) as r:
        if r.status != 200:
            raise RuntimeError("Sleeper " + path + " HTTP " + str(r.status))
        return json.load(r)


def norm(value):
    return re.sub(r"[^a-z0-9]+", "", unicodedata.normalize("NFD", str(value or "")).encode("ascii", "ignore").decode("ascii").lower())


def roster_franchises(snapshot, franchises):
    users = {str(x.get("user_id")): x for x in snapshot["users"]}
    mapping = {}
    for r in snapshot["rosters"]:
        owner = str(r.get("owner_id") or "")
        stable = [f for f in franchises if f.get("sleeper_user_id") and str(f["sleeper_user_id"]) == owner]
        if stable:
            matches = stable
        else:
            user = users.get(owner, {})
            values = [(r.get("metadata") or {}).get("team_name"),
                      (user.get("metadata") or {}).get("team_name"),
                      user.get("display_name")]
            matches = [f for f in franchises if any(norm(v) and norm(v) in {
                norm(z) for z in [f.get("name"), f.get("manager"), *(f.get("aliases") or []),
                                  *(f.get("manager_aliases") or [])]
            } for v in values)]
        if len(matches) != 1:
            raise ValueError("No se puede asociar inequívocamente roster " + str(r.get("roster_id")) + " a franquicia LFA")
        mapping[str(r["roster_id"])] = matches[0]["id"]
    if len(set(mapping.values())) != len(mapping):
        raise ValueError("Franquicias repetidas en la asociación de Sleeper")
    return mapping


def season_games(snapshot, identities):
    games = []
    settings = snapshot["league"].get("settings") or {}
    playoff_start = int(settings.get("playoff_week_start") or 15)
    for wk, entries in (snapshot.get("matchups") or {}).items():
        try:
            week = int(wk)
        except (TypeError, ValueError):
            continue
        groups = {}
        for row in entries or []:
            if row.get("matchup_id") is not None:
                groups.setdefault(row["matchup_id"], []).append(row)
        for pair in groups.values():
            if len(pair) != 2 or any(row.get("points") is None for row in pair):
                continue
            a, b = pair
            ra, rb = str(a["roster_id"]), str(b["roster_id"])
            if ra not in identities or rb not in identities:
                continue
            pa, pb = float(a["points"]), float(b["points"])
            games.append({"week": week, "roster_a": ra, "roster_b": rb, "franchise_a": identities[ra],
                          "franchise_b": identities[rb], "score_a": pa, "score_b": pb,
                          "type": "playoffs" if week >= playoff_start else "regular"})
    return sorted(games, key=lambda x: (x["week"], x["franchise_a"]))


def find_final(snapshot, identities, games):
    bracket = snapshot.get("bracket") or []
    # Sleeper usa p=1 para la final y p=3 para el tercer puesto.
    candidates = [g for g in bracket if int(g.get("p") or 0) == 1 and g.get("w") is not None and g.get("l") is not None]
    if len(candidates) != 1:
        return None
    game = candidates[0]
    winner, loser = str(game["w"]), str(game["l"])
    if winner not in identities or loser not in identities or winner == loser:
        return None
    playoff_start = int(snapshot["league"].get("settings", {}).get("playoff_week_start") or 15)
    matching = [g for g in games if g["type"] == "playoffs"
                and g["week"] >= playoff_start
                and {g["roster_a"], g["roster_b"]} == {winner, loser}]
    if not matching:
        return None
    final = max(matching, key=lambda g: g["week"])
    champion_score = final["score_a"] if final["roster_a"] == winner else final["score_b"]
    runner_score = final["score_b"] if final["roster_a"] == winner else final["score_a"]
    if champion_score <= runner_score:
        return None
    return {
        "champion_franchise_id": identities[winner], "runner_up_franchise_id": identities[loser],
        "champion_roster_id": winner, "runner_up_roster_id": loser, "week": final["week"],
        "final_score": {"champion": champion_score, "runner_up": runner_score},
        "source": "Sleeper winners_bracket + matchups, puntuaciones confirmadas"
    }


def make_archive(snapshot, franchises):
    league = snapshot.get("league") or {}
    if league.get("status") != "complete" or str(league.get("season")) != str(snapshot.get("season", league.get("season"))):
        return None
    size = len(snapshot.get("rosters") or [])
    if size not in (8, 10) or len(snapshot.get("users") or []) < size:
        return None
    mapping = roster_franchises(snapshot, franchises)
    games = season_games(snapshot, mapping)
    final = find_final(snapshot, mapping, games)
    if final is None:
        return None
    def scored(row, key):
        st = row.get("settings") or {}
        return float(st.get(key) or 0) + float(st.get(key + "_decimal") or 0) / 100
    rank = sorted(snapshot["rosters"], key=lambda r: (
        -int(r.get("settings", {}).get("wins") or 0),
        int(r.get("settings", {}).get("losses") or 0), -scored(r, "fpts")))
    standings = []
    for i, r in enumerate(rank, 1):
        pts, against = scored(r, "fpts"), scored(r, "fpts_against")
        settings = r.get("settings") or {}
        standings.append({"rank": i, "franchise_id": mapping[str(r["roster_id"])],
                          "wins": int(settings.get("wins") or 0), "losses": int(settings.get("losses") or 0),
                          "ties": int(settings.get("ties") or 0), "pf": round(pts, 2),
                          "pa": round(against, 2), "difference": round(pts - against, 2)})
    return {
        "season": int(league["season"]), "league_id": str(snapshot["league_id"]),
        "archived_at": datetime.now(timezone.utc).isoformat(),
        "final": final, "standings": standings, "games": games,
        "roster_to_franchise": mapping, "snapshot": snapshot,
        "status": "verified_final",
        "source": "Sleeper liga finalizada, final y estadísticas semanales"
    }


def combine_head_to_head(entries, games):
    """Agregar una única vez resultados cerrados, manteniendo conteos previos."""
    next_entries = copy.deepcopy(entries)
    for game in games:
        a, b = game["franchise_a"], game["franchise_b"]
        if game["score_a"] == game["score_b"]:
            continue
        row = next((x for x in next_entries if {x["franchise_a_id"], x["franchise_b_id"]} == {a, b}), None)
        if row is None:
            raise ValueError("Falta pareja histórica " + a + " / " + b)
        winner = a if game["score_a"] > game["score_b"] else b
        side = "a" if winner == row["franchise_a_id"] else "b"
        field = ("playoff" if game["type"] == "playoffs" else "regular") + "_wins_" + side
        row[field] = int(row.get(field) or 0) + 1
    return next_entries


def candidates_successor(old_id, new_year, users, fetch=get):
    found = {}
    commissioners = [u for u in users if u.get("is_owner")]
    # Comisionado primero, luego demás GM. La vinculación previene elegir otra liga del mismo usuario.
    for user in [*commissioners, *[u for u in users if u not in commissioners]]:
        uid = str(user.get("user_id") or "")
        if not uid:
            continue
        try:
            leagues = fetch("user/" + uid + "/leagues/nfl/" + str(new_year))
        except Exception:
            continue
        for league in leagues if isinstance(leagues, list) else []:
            if str(league.get("previous_league_id")) == str(old_id) and str(league.get("season")) == str(new_year):
                found[str(league["league_id"])] = league
        if found:
            break
    return list(found.values())


def promote_candidate(old_snapshot, fetch=get):
    league = old_snapshot["league"]
    year = int(league["season"]) + 1
    matches = candidates_successor(league["league_id"], year, old_snapshot["users"], fetch)
    if len(matches) != 1:
        return None
    candidate = fetch("league/" + str(matches[0]["league_id"]))
    if (not isinstance(candidate, dict)
        or str(candidate.get("previous_league_id")) != str(league["league_id"])
        or str(candidate.get("season")) != str(year)
        or int(candidate.get("total_rosters") or 0) not in (8, 10)):
        return None
    rosters = fetch("league/" + str(candidate["league_id"]) + "/rosters")
    users = fetch("league/" + str(candidate["league_id"]) + "/users")
    count = int(candidate.get("total_rosters") or 0)
    if not isinstance(rosters, list) or len(rosters) != count or not isinstance(users, list) or len(users) < count:
        return None
    if len({str(r.get("owner_id")) for r in rosters}) != count or any(not r.get("owner_id") for r in rosters):
        return None
    return candidate


def extend_h2h(entries, franchises, debut_year):
    """Conservar intactos los 28 cruces originales y crear únicamente las parejas nuevas."""
    rows = copy.deepcopy(entries)
    seen = set()
    for item in rows:
        key = frozenset((item["franchise_a_id"], item["franchise_b_id"]))
        if len(key) != 2 or key in seen:
            raise ValueError("El historial de paternidades contiene parejas repetidas")
        seen.add(key)
    for i, a in enumerate(franchises):
        for b in franchises[i + 1:]:
            key = frozenset((a["id"], b["id"]))
            if key in seen:
                continue
            if not (a.get("debut_year", 2019) == debut_year or b.get("debut_year", 2019) == debut_year):
                raise ValueError("Falta un cruce de las franquicias originales")
            rows.append({
                "franchise_a_id": a["id"], "franchise_b_id": b["id"],
                "regular_wins_a": 0, "regular_wins_b": 0,
                "playoff_wins_a": 0, "playoff_wins_b": 0,
                "source": "Debut LFA " + str(debut_year) + ", sin partidos anteriores",
                "snapshot_date": None, "status": "nuevo_equipo_sin_cruces"
            })
            seen.add(key)
    if len(rows) != len(franchises) * (len(franchises) - 1) // 2:
        raise ValueError("Matriz histórica incompleta en la nueva temporada")
    return rows


def prepare_successor(old_snapshot, next_league, franchises, fetch=get):
    """Validar identidad de los GM, sumar dos debutantes SOLO si la liga tiene 10 rosters.

    Los ID de usuario Sleeper son estables entre ligas; el ID numérico de roster no lo es.
    No se adivinan identidades ni se cambia el catálogo si faltan integrantes.
    """
    old_mapping = roster_franchises(old_snapshot, franchises)
    old_by_owner = {
        str(r["owner_id"]): old_mapping[str(r["roster_id"])]
        for r in old_snapshot["rosters"]
    }
    league_id = str(next_league["league_id"])
    roster_list = fetch("league/" + league_id + "/rosters")
    users = fetch("league/" + league_id + "/users")
    count = int(next_league.get("total_rosters") or 0)
    if count not in (8, 10) or not isinstance(roster_list, list) or len(roster_list) != count:
        raise ValueError("La sucesora debe tener 8 o 10 rosters completos")
    if not isinstance(users, list) or len(users) < count:
        raise ValueError("Faltan usuarios para confirmar la sucesora")
    roster_owners = [str(r.get("owner_id") or "") for r in roster_list]
    if not all(roster_owners) or len(set(roster_owners)) != count:
        raise ValueError("La sucesora tiene GM ausentes o duplicados")
    if not set(old_by_owner).issubset(roster_owners):
        raise ValueError("Hay un cambio de los ocho GM originales: requiere revisión manual")
    expected_new = count - len(old_by_owner)
    if expected_new not in (0, 2):
        raise ValueError("Cantidad de incorporaciones distinta a cero o dos")
    if any(str(f.get("sleeper_user_id")) not in ("None", uid)
           for uid, fid in old_by_owner.items()
           for f in franchises if f["id"] == fid):
        raise ValueError("La identidad histórica de un GM cambió")
    by_user = {str(u.get("user_id")): u for u in users}
    updated = copy.deepcopy(franchises)
    by_id = {f["id"]: f for f in updated}
    newcomers = []
    for roster in roster_list:
        uid = str(roster["owner_id"])
        if uid in old_by_owner:
            f = by_id[old_by_owner[uid]]
            f["sleeper_user_id"] = uid
            f["sleeper_roster_id"] = roster["roster_id"]
            continue
        user = by_user.get(uid)
        if user is None:
            raise ValueError("No se encuentra la cuenta Sleeper de un debutante")
        name = str((roster.get("metadata") or {}).get("team_name") or
                   (user.get("metadata") or {}).get("team_name") or
                   user.get("display_name") or "").strip()
        gm = str(user.get("display_name") or user.get("username") or "").strip()
        if not name or not gm:
            raise ValueError("Falta el nombre de la franquicia o del GM debutante")
        if norm(name) in {norm(x["name"]) for x in updated}:
            raise ValueError("Dos franquicias usan el mismo nombre")
        new = {
            "id": "sleeper-" + uid,
            "name": name, "manager": gm, "logo": "assets/lfa.webp",
            "aliases": [name], "manager_aliases": [gm],
            "owner_stable": True, "sleeper_user_id": uid,
            "sleeper_roster_id": roster["roster_id"],
            "debut_year": int(next_league["season"]),
            "titles_2019_2025": 0,
            "source": "Sleeper temporada " + str(next_league["season"]),
            "logo_status": "provisorio_hasta_recibir_escudo"
        }
        updated.append(new)
        newcomers.append(new)
    if len(newcomers) != expected_new or len(updated) != count:
        raise ValueError("No coinciden los participantes de la liga sucesora")
    return updated, newcomers



def update_archive_files(year, archive, D):
    DATA.joinpath("archive").mkdir(exist_ok=True)
    archive_path = DATA / "archive" / (str(year) + ".json")
    if archive_path.exists():
        raise ValueError("Archivo final existente; no sobrescribir temporadas")
    write_json(archive_path, archive)
    season = {
        "year": year, "era": "profesional", "official": True,
        "champion_franchise_id": archive["final"]["champion_franchise_id"],
        "runner_up_franchise_id": archive["final"]["runner_up_franchise_id"],
        "champion_name": next(f["name"] for f in D["franchises"] if f["id"] == archive["final"]["champion_franchise_id"]),
        "runner_up_name": next(f["name"] for f in D["franchises"] if f["id"] == archive["final"]["runner_up_franchise_id"]),
        "final_score": archive["final"]["final_score"],
        "editorial": "Final verificada por Sleeper; resultados y Draft conservados en el archivo.",
        "source": "Sleeper API, winners_bracket + matchups",
    }
    seasons = read_json(DATA / "seasons.json")
    if any(int(s["year"]) == year for s in seasons):
        raise ValueError("Ya figura la temporada " + str(year) + " en palmarés")
    seasons.append(season)
    write_json(DATA / "seasons.json", seasons)
    D["seasons"] = seasons
    old_entries = read_json(DATA / "legacy_h2h_review.json")
    freeze = D.get("h2h_baseline") or {}
    games_to_add = [
        g for g in archive["games"]
        if not (int(freeze.get("season") or 0) == int(year)
                and int(g["week"]) <= int(freeze.get("through_week") or 0))
    ]
    updated = combine_head_to_head(old_entries, games_to_add)
    write_json(DATA / "legacy_h2h_review.json", updated)
    D["legacy_h2h_review"] = updated
    D.setdefault("archived_seasons", {})[str(year)] = {
        "league_id": archive["league_id"], "standings": archive["standings"],
        "final": archive["final"], "status": archive["status"],
        "source": archive["source"],
    }
    # El nuevo archivo es accesible aunque siga activa la liga anterior.
    editorial = read_json(DATA / "editorial.json")
    item = {
        "id": "final-verificada-" + str(year),
        "year": year, "type": "editorial", "status": "historical_verified",
        "title": "El anillo de " + str(year) + " ya tiene dueño: " + season["champion_name"],
        "related": [season["champion_franchise_id"], season["runner_up_franchise_id"]],
        "description": season["champion_name"] + " venció a " + season["runner_up_name"] +
                       " por " + str(season["final_score"]["champion"]) + " a " +
                       str(season["final_score"]["runner_up"]) + ". La LFA guarda el resultado definitivo en su archivo.",
        "fact": "Final " + str(year) + ", Sleeper API",
    }
    if not any(e.get("id") == item["id"] for e in editorial):
        editorial.append(item)
        write_json(DATA / "editorial.json", editorial)
    D["editorial"] = editorial


def main():
    cfg = read_json(DATA / "league.json")
    active = int(cfg["current_season"])
    old_id = str(cfg["sleeper_league_id"])
    snap = read_json(DATA / "live_snapshot.json")
    if (str(snap.get("league_id")) != old_id or
        str((snap.get("league") or {}).get("season")) != str(active)):
        raise RuntimeError("El snapshot no corresponde a la temporada activa; transición cancelada")
    boot = DATA / "bootstrap.js"
    D = read_bootstrap(boot)
    if str(D["league"].get("sleeper_league_id")) != old_id:
        raise RuntimeError("El ID del bootstrap no coincide; transición cancelada")
    archive_path = DATA / "archive" / (str(active) + ".json")
    if snap["league"].get("status") != "complete":
        print("LFA: la temporada " + str(active) + " sigue en curso; no archivar ni cambiar de liga.")
        return
    if not archive_path.exists():
        archive = make_archive(snap, D["franchises"])
        if archive is None:
            print("LFA: final no verificada; se conserva la temporada " + str(active) + ".")
            return
        update_archive_files(active, archive, D)
        write_bootstrap(boot, D)
        print("LFA: temporada " + str(active) + " archivada con final, récord y partidos verificados.")
    else:
        archive = read_json(archive_path)
        if archive.get("status") != "verified_final" or str(archive.get("league_id")) != old_id:
            raise RuntimeError("Archivo de temporada no validado; transición cancelada")
    successor = promote_candidate(snap)
    if successor is None:
        print("LFA: aguardando liga " + str(active + 1) + " vinculada desde Sleeper; el archivo ya está preservado.")
        return
    new_year = active + 1
    # No se modifican ni el sitio ni la lista de franquicias en 2026.
    # Solo después del archivo verificado y de detectar la nueva liga real.
    updated_franchises, newcomers = prepare_successor(snap, successor, D["franchises"])
    # Los debuts confirmados entran también al archivo de Hechos Históricos.
    if newcomers:
        editorial = read_json(DATA / "editorial.json")
        for team in newcomers:
            uid = team["sleeper_user_id"]
            story_id = "debut-lfa-" + str(new_year) + "-" + uid
            if any(item.get("id") == story_id for item in editorial):
                continue
            editorial.append({
                "id": story_id, "year": new_year, "type": "editorial",
                "status": "historical_verified",
                "related": [team["id"]],
                "title": team["name"] + " se sienta en la mesa grande de LFA",
                "description": team["manager"] + " y " + team["name"] +
                    " ingresan oficialmente a la LFA en " + str(new_year) +
                    ". Su historial arranca en cero: sin títulos prestados, sin derrotas heredadas y con todas las excusas por estrenar.",
                "fact": "Ingreso confirmado por Sleeper · edición " + str(new_year),
            })
        write_json(DATA / "editorial.json", editorial)
        D["editorial"] = editorial
    current_pairs = read_json(DATA / "legacy_h2h_review.json")
    updated_pairs = extend_h2h(current_pairs, updated_franchises, new_year)
    cfg["current_teams"] = len(updated_franchises)
    D["franchises"] = updated_franchises
    D["legacy_h2h_review"] = updated_pairs
    cfg["current_season"] = new_year
    cfg["sleeper_league_id"] = str(successor["league_id"])
    write_json(DATA / "league.json", cfg)
    write_json(DATA / "franchises.json", updated_franchises)
    write_json(DATA / "legacy_h2h_review.json", updated_pairs)
    D["league"] = cfg
    for entry in D.get("site_map", []):
        for key in ("label", "source"):
            if isinstance(entry.get(key), str):
                entry[key] = entry[key].replace(str(active), str(new_year))
    if "site_map" in D:
        write_json(DATA / "site_map.json", D["site_map"])
    write_bootstrap(boot, D)
    print("LFA: transición verificada a " + str(new_year) + " (liga " +
          str(successor["league_id"]) + "), " + str(len(updated_franchises)) +
          " equipos, " + str(len(newcomers)) + " debutantes.")


if __name__ == "__main__":
    main()
