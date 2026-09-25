"""Offline tests: every adapter is exercised against payloads shaped like the real APIs.

Run:  python -m unittest discover -s tests -v
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import openpyxl

from etl import build, http
from etl.adapters import ilostat, nhm, owid, pip, sdg, whr, worldbank
from etl.adapters.base import AdapterError

COUNTRIES = [
    {"iso3": "DEU", "name": "Germany", "m49": 276, "gw": 260, "aliases": ["Germany"]},
    {"iso3": "KEN", "name": "Kenya", "m49": 404, "gw": 501, "aliases": ["Kenya"]},
]


# ----------------------------------------------------------------- fake server
def wb_payload(rows):
    return [{"page": 1, "pages": 1, "total": len(rows)},
            [{"countryiso3code": iso, "date": str(y), "value": v, "obs_status": ""} for iso, y, v in rows]]


def sdg_row(area, year, value, dims, series="S1", nature="C"):
    return {"series": series, "seriesDescription": series + " desc", "geoAreaCode": str(area),
            "timePeriodStart": float(year), "value": str(value), "dimensions": dims,
            "attributes": {"Nature": nature, "Units": "PERCENT"}}


def xlsx_bytes(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


class FakeServer:
    """Routes URLs (regex) to payloads. Unknown URLs raise like a 404."""

    def __init__(self):
        self.routes: list[tuple[re.Pattern, object]] = []
        self.calls: list[tuple[str, dict]] = []

    def on(self, pattern, payload):
        self.routes.insert(0, (re.compile(pattern), payload))

    def __call__(self, url, params, headers):
        self.calls.append((url, params or {}))
        for pat, payload in self.routes:
            if pat.search(url):
                if callable(payload):
                    payload = payload(url, params or {}, headers or {})
                if isinstance(payload, Exception):
                    raise payload
                if isinstance(payload, bytes):
                    return payload
                if isinstance(payload, str):
                    return payload.encode()
                return json.dumps(payload).encode()
        raise http.FetchError(f"HTTP 404 from {url}")


class Base(unittest.TestCase):
    def setUp(self):
        http.reset_memo()
        self.srv = FakeServer()
        http.transport = self.srv

    def tearDown(self):
        http.transport = None
        http.reset_memo()


# ---------------------------------------------------------------------- tests
class WorldBankTest(Base):
    def test_parse_and_per100k(self):
        self.srv.on(r"indicator/VC\.BTL\.DETH", wb_payload([("KEN", 2020, 50), ("KEN", 2021, None), ("DEU", 2020, None)]))
        self.srv.on(r"indicator/SP\.POP\.TOTL", wb_payload([("KEN", 2020, 50_000_000), ("DEU", 2020, 83_000_000)]))
        res = worldbank.fetch({"indicator": "VC.BTL.DETH", "transform": "per100k"}, COUNTRIES, {})
        self.assertEqual(list(res.series), ["KEN"])
        self.assertAlmostEqual(res.series["KEN"][0].value, 0.1)
        self.assertIn("per 100,000", res.notes["KEN"][0])

    def test_api_error_message(self):
        self.srv.on(r"indicator/BAD", [{"message": [{"id": "120", "value": "Invalid value"}]}])
        with self.assertRaises(AdapterError):
            worldbank.fetch({"indicator": "BAD"}, COUNTRIES, {})


class SdgTest(Base):
    def test_prefers_configured_and_total_dims(self):
        rows = [
            sdg_row(276, 2018, 10, {"Sex": "BOTHSEX", "Age": "15-49", "Reporting Type": "G"}),
            sdg_row(276, 2018, 99, {"Sex": "BOTHSEX", "Age": "15+", "Reporting Type": "G"}),
            sdg_row(276, 2018, 55, {"Sex": "BOTHSEX", "Age": "15-49", "Reporting Type": "N"}),
            sdg_row(276, 2018, 12, {"Sex": "FEMALE", "Age": "15-49", "Reporting Type": "G"}),
            sdg_row(404, 2019, 20, {"Sex": "BOTHSEX", "Age": "15-49", "Reporting Type": "G"}, nature="M"),
        ]
        self.srv.on(r"Series/Data", {"totalPages": 1, "data": rows})
        res = sdg.fetch({"series": "S1", "dims": {"Age": ["15-49", "15+"]}}, COUNTRIES, {})
        self.assertEqual([p.value for p in res.series["DEU"]], [10])
        self.assertEqual(res.series["KEN"][0].nature, "M")

    def test_combine_ratio_and_fallback_to_indicator(self):
        rows = [
            sdg_row(276, 2020, 20, {"Sex": "FEMALE", "Occupation": "TOTAL"}, series="SL_EMP_EARN"),
            sdg_row(276, 2020, 25, {"Sex": "MALE", "Occupation": "TOTAL"}, series="SL_EMP_EARN"),
            sdg_row(276, 2020, 30, {"Sex": "FEMALE", "Occupation": "MANAGERS"}, series="SL_EMP_EARN"),
            sdg_row(276, 2021, 21, {"Sex": "FEMALE", "Occupation": "TOTAL"}, series="SL_EMP_EARN"),  # no male -> skipped
        ]
        self.srv.on(r"Series/Data", http.FetchError("HTTP 404"))
        self.srv.on(r"Indicator/Data", {"totalPages": 1, "data": rows})
        params = {"series": "SL_EMP_EARN", "indicator": "8.5.1", "dims": {"Occupation": ["TOTAL"]},
                  "combine": {"dim": "Sex", "values": ["FEMALE", "MALE"], "op": "ratio_pct"}}
        res = sdg.fetch(params, COUNTRIES, {})
        self.assertEqual(len(res.series["DEU"]), 1)
        self.assertAlmostEqual(res.series["DEU"][0].value, 80.0)
        self.assertTrue(any("ratio" in n for n in res.notes["DEU"]))

    def test_substring_match_and_mean(self):
        rows = [
            sdg_row(404, 2019, 40, {"Type of skill": "SKILL_READ", "Education level": "LOWSEC", "Sex": "BOTHSEX"}),
            sdg_row(404, 2019, 30, {"Type of skill": "SKILL_MATH", "Education level": "LOWSEC", "Sex": "BOTHSEX"}),
            sdg_row(404, 2019, 90, {"Type of skill": "SKILL_READ", "Education level": "PRIMAR", "Sex": "BOTHSEX"}),
        ]
        self.srv.on(r"Series/Data", {"totalPages": 1, "data": rows})
        params = {"series": "S1", "dims": {"Education level": ["LOWSEC"], "Sex": ["BOTHSEX"]},
                  "combine": {"dim": "Type of skill", "values": ["READ", "MATH"], "op": "mean"}}
        res = sdg.fetch(params, COUNTRIES, {})
        self.assertAlmostEqual(res.series["KEN"][0].value, 35.0)

    def test_pagination(self):
        def page(url, params, headers):
            p = params["page"]
            return {"totalPages": 2, "data": [sdg_row(276, 2000 + p, p, {})]}
        self.srv.on(r"Series/Data", page)
        res = sdg.fetch({"series": "S1"}, COUNTRIES, {})
        self.assertEqual([p.year for p in res.series["DEU"]], [2001, 2002])


class PipTest(Base):
    def test_spl_fixed_at_baseline(self):
        def pipf(url, params, headers):
            if "povline" not in params:
                return [
                    {"country_code": "KEN", "reporting_year": 2015, "reporting_level": "national", "median": 3.0, "headcount": 0.4, "welfare_type": "consumption", "mean": 4.0},
                    {"country_code": "KEN", "reporting_year": 2021, "reporting_level": "national", "median": 3.5, "headcount": 0.35, "welfare_type": "consumption", "mean": 4.5},
                    {"country_code": "KEN", "reporting_year": 2021, "reporting_level": "urban", "median": 6.0, "headcount": 0.1, "welfare_type": "consumption", "mean": 8.0},
                ]
            line = params["povline"]
            return [
                {"country_code": "KEN", "reporting_year": 2015, "reporting_level": "national", "headcount": 0.5, "welfare_type": "consumption"},
                {"country_code": "KEN", "reporting_year": 2021, "reporting_level": "national", "headcount": 0.45 if line == 3.0 else 0.9, "welfare_type": "consumption"},
            ]
        self.srv.on(r"pip/v1/pip", pipf)
        res = pip.fetch_spl({"baseline": 2017}, [COUNTRIES[1]], {})
        # baseline survey 2015 (closest to 2017): SPL = max(3.00, 1.15 + 1.5) = 3.00
        self.assertEqual(res.meta["KEN"]["line"], 3.0)
        self.assertEqual([round(p.value, 1) for p in res.series["KEN"]], [50.0, 45.0])
        mean = pip.fetch_mean({}, [COUNTRIES[1]], {})
        self.assertAlmostEqual(mean.series["KEN"][-1].value, 4.5 * 365)
        self.assertEqual(mean.meta["KEN"]["welfare"], "consumption")


class OwidTest(Base):
    def test_grapher_alt_slug(self):
        csv_text = "Entity,Code,Year,Wealth share of the richest 1%\nGermany,DEU,2021,29.1\nWorld,OWID_WRL,2021,38\nKenya,KEN,2020,\n"
        self.srv.on(r"grapher/wealth-share-richest\.csv", lambda u, p, h: csv_text if p.get("quantile") == "richest_1pct" else "x")
        res = owid.fetch_grapher({"slug": "gone", "altSlugs": [{"slug": "wealth-share-richest", "query": {"quantile": "richest_1pct"}}]}, COUNTRIES, {})
        self.assertEqual(res.series["DEU"][0].value, 29.1)
        self.assertNotIn("KEN", res.series)

    def test_indicator_search_and_cache(self):
        tmp = Path(tempfile.mkdtemp())
        with mock.patch.object(owid, "ID_CACHE", tmp / "ids.json"):
            def meta(url, params, headers):
                i = int(re.search(r"/(\d+)\.metadata", url).group(1))
                if i == 105:
                    return {"shortName": "target", "dimensions": {"entities": {"values": [{"id": 1, "code": "DEU"}, {"id": 2, "code": "KEN"}]}}}
                return {"shortName": f"other_{i}"}
            self.srv.on(r"\d+\.metadata\.json", meta)
            self.srv.on(r"105\.data\.json", {"values": [40.5, 30.0], "years": [2022, 2018], "entities": [1, 2]})
            res = owid.fetch_indicator({"shortName": "target", "searchAround": 100, "window": 10}, COUNTRIES, {})
            self.assertEqual(res.series["DEU"][0].value, 40.5)
            self.assertEqual(json.loads((tmp / "ids.json").read_text())["target"], 105)
        shutil.rmtree(tmp)


class IlostatTest(Base):
    def test_bulk_filter(self):
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["ref_area", "source", "indicator", "sex", "classif1", "time", "obs_value", "obs_status"])
        w.writerow(["DEU", "BA:1", "X", "SEX_T", "AGE_YTHADULT_YGE15", "2023", "7.1", ""])
        w.writerow(["DEU", "BA:1", "X", "SEX_F", "AGE_YTHADULT_YGE15", "2023", "8.0", ""])
        w.writerow(["DEU", "BA:1", "X", "SEX_T", "AGE_YTHADULT_Y15-24", "2023", "15", ""])
        w.writerow(["KEN", "BA:9", "X", "SEX_T", "AGE_YTHADULT_YGE15", "2019", "20", "E"])
        self.srv.on(r"rplumber", http.FetchError("HTTP 500"))
        self.srv.on(r"WEB_bulk_download", gzip.compress(buf.getvalue().encode()))
        res = ilostat.fetch({"indicator": "X", "filters": {"sex": "SEX_T", "classif1": ["AGE_YTHADULT_YGE15"]}}, COUNTRIES, {})
        self.assertEqual(res.series["DEU"][0].value, 7.1)
        self.assertEqual(res.series["KEN"][0].nature, "E")


class WhrTest(Base):
    def test_finds_latest_panel_file(self):
        html = '<a href="/files/WHR24_Data_Figure_2.1.xlsx">fig</a><a href="https://files.example/WHR25_DataForTable2.1.xlsx">panel</a><a href="/files/WHR24_DataForTable2.1.xlsx">old</a>'
        self.srv.on(r"worldhappiness\.report/data-sharing", html)
        self.srv.on(r"WHR25_DataForTable2\.1", xlsx_bytes([["Country name", "year", "Life Ladder", "Social support"],
                                                            ["Germany", 2023, 6.9, 0.91], ["Kenya", 2023, 4.5, 0.70], ["Kenya", 2022, 4.4, None]]))
        res = whr.fetch({"column": ["Social support"], "multiply": 100}, COUNTRIES, {})
        self.assertAlmostEqual(res.series["DEU"][0].value, 91.0)
        self.assertEqual(len(res.series["KEN"]), 1)


class NhmTest(Base):
    def test_ckan_csv_detection(self):
        self.srv.on(r"package_show", {"success": True, "result": {"resources": [
            {"id": "r1", "name": "Readme", "format": "PDF", "url": "https://x/readme.pdf"},
            {"id": "r2", "name": "Country-level BII", "format": "CSV", "url": "https://x/bii_country.csv"}]}})
        self.srv.on(r"bii_country\.csv", "area_code,area_name,year,scenario,bii,bii_lower,bii_upper\n"
                                         "DEU,Germany,2010,SSP2,0.52,0.5,0.54\nDEU,Germany,2014,SSP2,0.51,0.49,0.53\n"
                                         "DEU,Germany,2030,SSP2,0.49,0.4,0.6\nKEN,Kenya,2014,SSP2,0.8,0.7,0.9\n")
        res = nhm.fetch({"package": "bii-bte", "maxYear": 2014}, COUNTRIES, {})
        self.assertEqual([p.year for p in res.series["DEU"]], [2010, 2014])
        self.assertAlmostEqual(res.series["DEU"][-1].value, 51.0)
        self.assertAlmostEqual(res.series["KEN"][0].hi, 90.0)


# ------------------------------------------------------------ full build run
class BuildTest(Base):
    def setUp(self):
        super().setUp()
        self.tmp = Path(tempfile.mkdtemp())
        self.patches = [
            mock.patch.object(build, "SITE_DATA", self.tmp / "site"),
            mock.patch.object(build, "STATE_DIR", self.tmp / "state"),
            mock.patch.object(owid, "ID_CACHE", self.tmp / "state" / "owid_ids.json"),
        ]
        for p in self.patches:
            p.start()
        s = self.srv
        s.on(r"api\.worldbank\.org/v2/country/[A-Z;]+$", [{}, [
            {"id": c, "name": n, "incomeLevel": {"id": inc, "value": inc}, "region": {"value": "R"}}
            for c, n, inc in [("DEU", "Germany", "HIC"), ("USA", "United States", "HIC"), ("BRA", "Brazil", "UMC"),
                              ("IND", "India", "LMC"), ("IDN", "Indonesia", "UMC"), ("KEN", "Kenya", "LMC")]]])
        s.on(r"/indicator/", lambda u, p, h: wb_payload([(iso, y, 10 + y % 7) for iso in ("DEU", "USA", "BRA", "IND", "IDN", "KEN") for y in (2019, 2020, 2021)]))
        s.on(r"SDGAPI/v1/sdg/(Series|Indicator)/Data", lambda u, p, h: {"totalPages": 1, "data": [
            sdg_row(a, 2018, 12, {"Sex": "BOTHSEX"}, series=p.get("seriesCode", "S")) for a in (276, 404, 76)] + [
            sdg_row(a, 2018, v, {"Sex": sx}, series="SL_EMP_EARN") for a in (276,) for sx, v in (("FEMALE", 18), ("MALE", 22))]})
        s.on(r"pip/v1/pip", lambda u, p, h: [{"country_code": p["country"], "reporting_year": 2019, "reporting_level": "national",
                                              "median": 5, "headcount": 0.2, "mean": 7, "welfare_type": "income"}])
        s.on(r"ourworldindata\.org/grapher/", "Entity,Code,Year,Value\nGermany,DEU,2022,8.1\nKenya,KEN,2022,1.1\n")
        s.on(r"api\.ourworldindata\.org/v1/indicators/\d+\.metadata", lambda u, p, h: {"shortName": "x", "dimensions": {"entities": {"values": [{"id": 1, "code": "KEN"}]}}})
        s.on(r"api\.ourworldindata\.org/v1/indicators/\d+\.data", {"values": [37.0], "years": [2022], "entities": [1]})
        s.on(r"grapher/healthy-life-expectancy", "Entity,Code,Year,HALE\nGermany,DEU,2021,70.2\n")
        s.on(r"ghoapi", http.FetchError("HTTP 503 from WHO"))

    def tearDown(self):
        for p in self.patches:
            p.stop()
        shutil.rmtree(self.tmp)
        super().tearDown()

    def run_build(self):
        http.reset_memo()
        build.run(log=lambda *a: None)
        site = self.tmp / "site"
        return (json.loads((site / "dashboard.json").read_text()),
                json.loads((site / "status.json").read_text()),
                json.loads((site / "registry.json").read_text()))

    def test_full_run(self):
        dash, status, reg = self.run_build()
        v = dash["values"]
        self.assertEqual(len([i for i in reg["indicators"] if not i.get("hidden")]), 31)
        # not applicable: MPI for a high-income country, value for Kenya
        self.assertEqual(v["mpi"]["DEU"]["status"], "not_applicable")
        self.assertEqual(v["mpi"]["KEN"]["latest"]["value"], 37.0)
        self.assertIn("substitute", v["mpi"]["KEN"]["tags"])
        # WHO down -> fallback to OWID mirror for HALE (not a proxy)
        self.assertEqual(v["hale"]["DEU"]["src"], 1)
        self.assertNotIn("substitute", v["hale"]["DEU"]["tags"])
        # outdated auto-tag (2018 data)
        self.assertIn("outdated", v["ipv"]["DEU"]["tags"])
        # gender pay ratio 18/22
        self.assertAlmostEqual(v["gender_pay"]["DEU"]["latest"]["value"], 81.818181, places=3)
        # UCDP disabled without token -> falls through to World Bank battle deaths
        ucdp_status = [s for s in status["sources"] if s["key"].startswith("ucdp")][0]
        self.assertEqual(ucdp_status["status"], "disabled")
        # GHG total is divided into Mt
        self.assertAlmostEqual(v["ghg_total"]["DEU"]["latest"]["value"], 8.1 / 1e6)
        # countries without SDG data -> no_data
        self.assertEqual(v["discrimination"]["USA"]["status"], "no_data")
        # loneliness: WHR page missing -> source error with the explanation kept
        self.assertEqual(v["loneliness"]["DEU"]["status"], "source_error")

    def test_stale_reuse_and_alert(self):
        self.run_build()
        # PIP goes down: previous values are kept and flagged stale; alert after 3 runs
        self.srv.on(r"pip/v1/pip", http.FetchError("HTTP 500 from PIP"))
        for _ in range(3):
            dash, status, _ = self.run_build()
        entry = dash["values"]["poverty_spl"]["KEN"]
        self.assertEqual(entry["status"], "ok")
        self.assertIn("stale", entry)
        alerts = json.loads((self.tmp / "state" / "alerts.json").read_text())
        self.assertTrue(any(a["key"].startswith("pip_spl") for a in alerts))
        # last change time does not move when nothing new arrives
        first = dash["lastChanged"]
        dash2, _, _ = self.run_build()
        self.assertEqual(dash2["lastChanged"], first)


if __name__ == "__main__":
    unittest.main()
