#!/usr/bin/env python3
"""Expansión opcional 2027: no toca los archivos de la liga real."""
from __future__ import annotations
import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("lfa_season_manager",ROOT/"scripts"/"season_manager.py")
manager=importlib.util.module_from_spec(spec)
spec.loader.exec_module(manager)


class ExpansionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path=ROOT/"data"/"archive"/"2026.json"
        cls.snap=(json.loads(path.read_text())["snapshot"] if path.exists()
                  else json.loads((ROOT/"data"/"live_snapshot.json").read_text()))
        cls.teams=[x for x in json.loads((ROOT/"data"/"franchises.json").read_text())
                   if not x.get("debut_year")]
        cls.pairs=[x for x in json.loads((ROOT/"data"/"legacy_h2h_review.json").read_text())
                   if x["franchise_a_id"] in {t["id"] for t in cls.teams}
                   and x["franchise_b_id"] in {t["id"] for t in cls.teams}]

    def successor(self, size):
        next_id="LFA-2027-FICTICIA"
        league={
            "league_id":next_id,"previous_league_id":str(self.snap["league_id"]),
            "season":"2027","sport":"nfl","total_rosters":size}
        rosters=copy.deepcopy(self.snap["rosters"])
        users=copy.deepcopy(self.snap["users"])
        for n in range(9,size+1):
            uid=str(9988776600+n)
            name="Franquicia nueva "+str(n)
            users.append({"user_id":uid,"display_name":"GM Invitado "+str(n),"metadata":{"team_name":name}})
            rosters.append({"roster_id":n,"owner_id":uid,"metadata":{"team_name":name},
                            "settings":{"wins":0,"losses":0,"fpts":0}})
        def mock(path):
            if path.startswith("user/"):return [league]
            if path=="league/"+next_id:return league
            if path=="league/"+next_id+"/rosters":return rosters
            if path=="league/"+next_id+"/users":return users
            raise AssertionError("Petición imprevista "+path)
        return league,rosters,users,mock

    def test_2026_unchanged(self):
        league=json.loads((ROOT/"data"/"league.json").read_text())
        if int(league["current_season"])==2026:
            self.assertEqual(int(league["current_teams"]),8)
            self.assertEqual(len(self.teams),8)
            self.assertEqual(len(self.pairs),28)
        self.assertIsNone(manager.make_archive(self.snap,self.teams) if self.snap["league"]["status"]!="complete" else None)

    def test_eight_remains_eight_no_new_franquicias(self):
        league,rosters,users,mock=self.successor(8)
        found=manager.promote_candidate(self.snap,mock)
        self.assertEqual(found["league_id"],league["league_id"])
        updated,newbies=manager.prepare_successor(self.snap,found,self.teams,mock)
        self.assertEqual((len(updated),len(newbies)),(8,0))
        self.assertEqual(len(manager.extend_h2h(self.pairs,updated,2027)),28)
        self.assertEqual([x["id"] for x in updated],[x["id"] for x in self.teams])

    def test_ten_creates_exactly_seventeen_zero_rivalries(self):
        league,rosters,users,mock=self.successor(10)
        found=manager.promote_candidate(self.snap,mock)
        self.assertEqual(found["league_id"],league["league_id"])
        updated,newbies=manager.prepare_successor(self.snap,found,self.teams,mock)
        self.assertEqual((len(updated),len(newbies)),(10,2))
        self.assertEqual(len({x["sleeper_user_id"] for x in newbies}),2)
        for new in newbies:
            self.assertEqual(new["debut_year"],2027)
            self.assertEqual(new["titles_2019_2025"],0)
            self.assertEqual(new["logo"],"assets/lfa.webp")
        for before,after in zip(self.teams,updated[:8]):
            self.assertEqual(after["id"],before["id"])
            self.assertEqual(after["name"],before["name"])
            self.assertEqual(after["logo"],before["logo"])
        expanded=manager.extend_h2h(self.pairs,updated,2027)
        self.assertEqual(len(expanded),45)
        self.assertEqual(expanded[:28],self.pairs,"Los 28 cruces históricos deben mantenerse intactos")
        for pair in expanded[28:]:
            self.assertTrue(any(t["id"] in {pair["franchise_a_id"],pair["franchise_b_id"]} for t in newbies))
            self.assertEqual(sum(pair[k] for k in ("regular_wins_a","regular_wins_b","playoff_wins_a","playoff_wins_b")),0)
        again=manager.extend_h2h(expanded,updated,2027)
        self.assertEqual(again,expanded,"No duplicar cruces después de un reinicio")

    def test_not_promote_with_missing_rosters_or_swapped_founders(self):
        league,rosters,users,mock=self.successor(10)
        incomplete=lambda path:rosters[:-1] if path.endswith("/rosters") else mock(path)
        self.assertIsNone(manager.promote_candidate(self.snap,incomplete))
        broken=copy.deepcopy(rosters)
        broken[0]["owner_id"]="SUSTITUTO"
        swap=lambda path:broken if path.endswith("/rosters") else mock(path)
        with self.assertRaises(ValueError):
            manager.prepare_successor(self.snap,league,self.teams,swap)
        wrong={**league,"previous_league_id":"OTRA-LIGA"}
        self.assertIsNone(manager.promote_candidate(self.snap,lambda path:wrong if path=="league/"+league["league_id"] else mock(path)))

    def test_ten_team_season_archives_verified_final(self):
        league,rosters,users,mock=self.successor(10)
        updated,_=manager.prepare_successor(self.snap,league,self.teams,mock)
        snap=copy.deepcopy(self.snap)
        snap["league_id"]=league["league_id"]
        snap["league"]["league_id"]=league["league_id"]
        snap["league"]["season"]="2027"
        snap["league"]["status"]="complete"
        snap["users"]=users
        snap["rosters"]=rosters
        final_week=int(snap["league"]["settings"]["playoff_week_start"])
        snap["bracket"]=[{"p":1,"m":9,"r":2,"w":1,"l":9}]
        snap["matchups"][str(final_week)]=[
            {"roster_id":1,"matchup_id":9,"points":176.25},
            {"roster_id":9,"matchup_id":9,"points":121.43}]
        archive=manager.make_archive(snap,updated)
        self.assertIsNotNone(archive)
        self.assertEqual(archive["season"],2027)
        self.assertEqual(len(archive["standings"]),10)
        self.assertEqual(len(archive["roster_to_franchise"]),10)
        self.assertEqual(archive["final"]["runner_up_franchise_id"],updated[8]["id"])


if __name__=="__main__":
    unittest.main()
