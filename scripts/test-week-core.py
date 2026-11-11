#!/usr/bin/env python3
from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
import importlib.util
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("lfa_sync",ROOT/"scripts"/"sync_sleeper.py")
sync=importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
def t(date_string):
    return datetime.fromisoformat(date_string.replace("Z","+00:00"))
class WeekTests(unittest.TestCase):
    def test_tuesday_november_2026(self):
        league={"status":"in_season"}
        nfl={"week":9,"season_type":"regular"}
        self.assertEqual(sync.current_league_week(t("2026-11-10T02:59:59Z"),league,nfl),9)
        self.assertEqual(sync.current_league_week(t("2026-11-10T03:00:00Z"),league,nfl),10)
        self.assertEqual(sync.current_league_week(t("2026-11-11T15:00:00Z"),league,nfl),10)
        self.assertEqual(sync.current_league_week(t("2026-11-17T03:00:00Z"),league,nfl),11)
    def test_pre_draft_and_next_year(self):
        league={"status":"pre_draft"}
        self.assertEqual(sync.current_league_week(t("2026-11-11T15:00:00Z"),league,{}),1)
        old=sync.SEASON
        try:
            sync.SEASON="2027"
            self.assertEqual(sync.current_league_week(t("2027-09-14T03:00:00Z"),{"status":"in_season"},{}),2)
        finally:
            sync.SEASON=old
if __name__=="__main__":
    unittest.main()
