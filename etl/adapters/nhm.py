"""Natural History Museum Data Portal (CKAN, no key). https://data.nhm.ac.uk/

Finds the country-level CSV resource of a dataset via the CKAN API, downloads it
and detects the relevant columns automatically, so a re-published file with slightly
different headers still works.

Params:
  package  CKAN dataset name, e.g. "bii-bte"
  maxYear  ignore projections after this year
"""
from __future__ import annotations

import csv
import io
from collections import defaultdict

from .. import http
from .base import AdapterError, Point, Result, to_float, to_year

API = "https://data.nhm.ac.uk/api/3/action/"

ISO_COLS = ["iso3", "iso", "iso_code", "iso3_code", "area_code", "code", "country_code"]
NAME_COLS = ["country", "area", "area_name", "name", "region", "country_name"]
YEAR_COLS = ["year", "yr", "date"]
VAL_COLS = ["bii", "bii_mean", "mean_bii", "value", "mean", "bii_value"]
LO_COLS = ["lower", "bii_lower", "lower_bound", "lwr", "low"]
HI_COLS = ["upper", "bii_upper", "upper_bound", "upr", "high"]
SCEN_COLS = ["scenario", "ssp", "pathway"]


def _col(header: list[str], options: list[str]) -> str | None:
    low = {h.lower().strip(): h for h in header}
    for o in options:
        if o in low:
            return low[o]
    for o in options:
        for h_low, h in low.items():
            if o in h_low:
                return h
    return None


def _resources(package: str) -> list[dict]:
    data = http.get_json(API + "package_show", {"id": package})
    if not data.get("success"):
        raise AdapterError(f"NHM package '{package}' not found")
    return data["result"].get("resources") or []


def _rows_for(res: dict) -> list[dict]:
    if res.get("datastore_active"):
        rows, offset = [], 0
        while True:
            d = http.get_json(API + "datastore_search", {"resource_id": res["id"], "limit": 32000, "offset": offset})
            recs = d.get("result", {}).get("records") or []
            rows.extend(recs)
            if len(recs) < 32000:
                return rows
            offset += 32000
    text = http.get_text(res["url"])
    return list(csv.DictReader(io.StringIO(text)))


def fetch(params: dict, countries: list[dict], ctx: dict) -> Result:
    resources = _resources(params["package"])
    cands = [r for r in resources if "csv" in str(r.get("format", "")).lower() or str(r.get("url", "")).lower().endswith(".csv") or r.get("datastore_active")]
    cands.sort(key=lambda r: 0 if "country" in (str(r.get("name", "")) + str(r.get("description", ""))).lower() else 1)
    if not cands:
        raise AdapterError("No CSV resource found in NHM dataset")
    name_map = {}
    for c in countries:
        for n in [c.get("name", "")] + c.get("aliases", []):
            name_map[n.lower()] = c["iso3"]
    iso3s = {c["iso3"] for c in countries}
    max_year = int(params.get("maxYear", 2100))
    last = None
    for resource in cands:
        try:
            rows = _rows_for(resource)
            if not rows:
                continue
            header = list(rows[0].keys())
            iso_c, name_c = _col(header, ISO_COLS), _col(header, NAME_COLS)
            year_c, val_c = _col(header, YEAR_COLS), _col(header, VAL_COLS)
            lo_c, hi_c, scen_c = _col(header, LO_COLS), _col(header, HI_COLS), _col(header, SCEN_COLS)
            if not year_c or not val_c or not (iso_c or name_c):
                last = AdapterError(f"Could not detect columns in {resource.get('name')}: {header}")
                continue
            by: dict[str, dict[int, Point]] = defaultdict(dict)
            scen_pref = None
            if scen_c:
                scens = sorted({str(r.get(scen_c)) for r in rows})
                scen_pref = next((s for s in scens if "hist" in s.lower()), None) or next((s for s in scens if "2" in s), scens[0])
            vals = []
            for r in rows:
                if scen_c and str(r.get(scen_c)) != scen_pref:
                    continue
                key = str(r.get(iso_c) or "").upper() if iso_c else ""
                iso3 = key if key in iso3s else name_map.get(str(r.get(name_c) or "").strip().lower())
                y, v = to_year(r.get(year_c)), to_float(r.get(val_c))
                if not iso3 or y is None or v is None or y > max_year:
                    continue
                vals.append(v)
                by[iso3][y] = Point(y, v, "M", to_float(r.get(lo_c)) if lo_c else None, to_float(r.get(hi_c)) if hi_c else None)
            if not by:
                last = AdapterError("NHM file contained none of the configured countries")
                continue
            scale = 100.0 if vals and max(vals) <= 1.5 else 1.0
            res = Result()
            for iso3, pts in by.items():
                for p in pts.values():
                    res.add(iso3, Point(p.year, p.value * scale, p.nature,
                                        p.lo * scale if p.lo is not None else None,
                                        p.hi * scale if p.hi is not None else None))
                if scen_pref:
                    res.note(iso3, f"Historical values from scenario series '{scen_pref}'; projections excluded.")
            return res.finalize()
        except Exception as e:
            last = e
    raise AdapterError(f"NHM BII could not be parsed: {last}")
