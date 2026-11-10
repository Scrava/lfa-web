#!/usr/bin/env python3
"""Pruebas de archivo final y descubrimiento de sucesores Sleeper, 100% sin red."""
from __future__ import annotations
import copy
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('lfa_season_manager',ROOT/'scripts'/'season_manager.py')
manager=importlib.util.module_from_spec(spec)
spec.loader.exec_module(manager)


class LfaSeasonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.current=json.loads((ROOT/'data'/'live_snapshot.json').read_text())
        cls.franchises=json.loads((ROOT/'data'/'franchises.json').read_text())

    def completed(self):
        snap=copy.deepcopy(self.current)
        snap['league']['status']='complete'
        snap['bracket']=[{'r':1,'m':1,'w':1,'l':2,'p':1}]
        # Liga de prueba: marcador confirmado desde un playoff posterior al inicio oficial.
        week=int(snap['league']['settings']['playoff_week_start'])
        snap['matchups'][str(week)]=[
            {'roster_id':1,'matchup_id':1,'points':152.8},
            {'roster_id':2,'matchup_id':1,'points':146.4},
        ]
        return snap

    def test_no_archivar_liga_en_curso(self):
        self.assertIsNone(manager.make_archive(self.current,self.franchises))

    def test_no_inventar_campeon_si_falta_final(self):
        snap=self.completed()
        snap['bracket']=[]
        self.assertIsNone(manager.make_archive(snap,self.franchises))

    def test_final_y_marcador_coinciden(self):
        snap=self.completed()
        archive=manager.make_archive(snap,self.franchises)
        self.assertIsNotNone(archive)
        self.assertEqual(archive['season'],2026)
        self.assertEqual(archive['final']['champion_franchise_id'],'all-bros')
        self.assertEqual(archive['final']['runner_up_franchise_id'],'scravengers')
        self.assertEqual(archive['final']['final_score']['champion'],152.8)
        self.assertEqual(len(archive['standings']),8)
        snap['bracket'][0]['w']=2;snap['bracket'][0]['l']=1
        self.assertIsNone(manager.make_archive(snap,self.franchises))

    def test_historial_suma_solo_partidos_verificados(self):
        source=json.loads((ROOT/'data'/'legacy_h2h_review.json').read_text())
        a=next(x for x in source if {'all-bros','scravengers'}=={x['franchise_a_id'],x['franchise_b_id']})
        updated=manager.combine_head_to_head(source,self.completed_game())
        b=next(x for x in updated if {'all-bros','scravengers'}=={x['franchise_a_id'],x['franchise_b_id']})
        side='a' if a['franchise_a_id']=='all-bros' else 'b'
        self.assertEqual(b['playoff_wins_'+side],a['playoff_wins_'+side]+1)

    def completed_game(self):
        snap=self.completed()
        return [g for g in manager.make_archive(snap,self.franchises)['games'] if g['type']=='playoffs']

    def test_successor_requires_exact_previous_league_and_eight_rosters(self):
        current=self.completed()
        previous=str(current['league_id'])
        nextid='LFA-2027-TEST'
        successor={'league_id':nextid,'previous_league_id':previous,'season':'2027','sport':'nfl','total_rosters':8}
        def mock(path):
            if path.startswith('user/'):return [
                {**successor,'previous_league_id':'WRONG'},
                successor,
            ]
            if path=='league/'+nextid:return successor
            if path=='league/'+nextid+'/rosters':return copy.deepcopy(current['rosters'])
            if path=='league/'+nextid+'/users':return copy.deepcopy(current['users'])
            raise AssertionError('Unexpected API '+path)
        self.assertEqual(manager.promote_candidate(current,mock)['league_id'],nextid)
        def mismatch(path):
            if path=='league/'+nextid:return {**successor,'previous_league_id':'WRONG'}
            return mock(path)
        self.assertIsNone(manager.promote_candidate(current,mismatch))

    def test_archive_once_and_preserve_other_seasons(self):
        archive=manager.make_archive(self.completed(),self.franchises)
        with TemporaryDirectory() as folder:
            previous=manager.DATA
            try:
                manager.DATA=Path(folder)
                for name in ['seasons.json','editorial.json','legacy_h2h_review.json']:
                    (manager.DATA/name).write_text((ROOT/'data'/name).read_text())
                D=manager.read_bootstrap(ROOT/'data'/'bootstrap.js')
                manager.update_archive_files(2026,archive,D)
                self.assertTrue((manager.DATA/'archive'/'2026.json').exists())
                self.assertTrue(any(int(x['year'])==2026 for x in D['seasons']))
                self.assertEqual(D['archived_seasons']['2026']['status'],'verified_final')
                with self.assertRaises(ValueError):
                    manager.update_archive_files(2026,archive,D)
            finally:
                manager.DATA=previous


if __name__=='__main__':
    unittest.main()
