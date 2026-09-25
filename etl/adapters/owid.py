"""Our World in Data (no key). https://docs.owid.io/projects/etl/api/

owid_grapher   chart CSV:   https://ourworldindata.org/grapher/<slug>.csv
  slug      chart slug
  altSlugs  fallbacks, either strings or {"slug":..., "query": {...}}
  column    optional value column; default = first non-key column

owid_indicator indicator API: https://api.ourworldindata.org/v1/indicators/<id>.data.json
  id           numeric indicator id, or
  shortName    + searchAround (a known sibling id) + window: scans nearby ids once and
               caches the match in data/owid_ids.json, so dataset updates that change
               ids are found again automatically.
"""
from __future__ import annotations

import csv
import io
import json
from pathlib import Path

from .. import http
from .base import AdapterError, Point, Result, to_float, to_year

GRAPHER = "https://ourworldindata.org/grapher/{slug}.csv"
API = "https://api.ourworldindata.org/v1/indicators/{id}.{kind}.json"
HEADERS = {"User-Agent": "Our World In Data data fetch/1.0 (BeyondGDP dashboard)"}
KEYS = {"entity", "code", "year", "day"}
ID_CACHE = Path(__file__).resolve().parents[2] / "data" / "owid_ids.json"


def _grapher_rows(slug: str, query: dict | None) -> list[dict]:
    params = {"v": "1", "csvType": "full", "useColumnShortNames": "false", **(query or {})}
    text = http.get_text(GRAPHER.format(slug=slug), params, HEADERS)
    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows or "Year" not in rows[0] and "Day" not in rows[0]:
        raise AdapterError(f"OWID chart '{slug}' returned no usable data")
    return rows


def fetch_grapher(params: dict, countries: list[dict], ctx: dict) -> Result:
    attempts = [{"slug": params["slug"], "query": params.get("query")}]
    for alt in params.get("altSlugs", []):
        attempts.append(alt if isinstance(alt, dict) else {"slug": alt})
    rows, errors = None, []
    for a in attempts:
        try:
            rows = _grapher_rows(a["slug"], a.get("query"))
            break
        except Exception as e:
            errors.append(f"{a['slug']}: {e}")
    if rows is None:
        raise AdapterError("; ".join(errors))
    cols = [c for c in rows[0] if c.strip().lower() not in KEYS]
    col = params.get("column") or (cols[0] if cols else None)
    if col not in rows[0]:
        raise AdapterError(f"Column '{col}' not found in OWID chart {params['slug']} (have: {cols})")
    iso3s = {c["iso3"] for c in countries}
    res = Result()
    for r in rows:
        iso3 = r.get("Code")
        if iso3 not in iso3s:
            continue
        y, v = to_year(r.get("Year") or r.get("Day")), to_float(r.get(col))
        if y is not None and v is not None:
            res.add(iso3, Point(y, v))
    return res.finalize()


def _load_cache() -> dict:
    try:
        return json.loads(ID_CACHE.read_text())
    except Exception:
        return {}


def _resolve_id(params: dict) -> int:
    if params.get("id"):
        return int(params["id"])
    short = params["shortName"]
    cache = _load_cache()
    if short in cache:
        try:
            meta = http.get_json(API.format(id=cache[short], kind="metadata"))
            if meta.get("shortName") == short:
                return int(cache[short])
        except Exception:
            pass
    anchor, window = int(params["searchAround"]), int(params.get("window", 60))
    order = sorted(range(anchor - window, anchor + window + 1), key=lambda i: abs(i - anchor))
    for i in order:
        try:
            meta = http.get_json(API.format(id=i, kind="metadata"))
        except Exception:
            continue
        if meta.get("shortName") == short:
            cache[short] = i
            ID_CACHE.parent.mkdir(parents=True, exist_ok=True)
            ID_CACHE.write_text(json.dumps(cache, indent=2))
            return i
    raise AdapterError(f"OWID indicator '{short}' not found near id {anchor}")


def fetch_indicator(params: dict, countries: list[dict], ctx: dict) -> Result:
    ind = _resolve_id(params)
    meta = http.get_json(API.format(id=ind, kind="metadata"))
    data = http.get_json(API.format(id=ind, kind="data"))
    ents = {e["id"]: e.get("code") for e in (meta.get("dimensions", {}).get("entities", {}).get("values") or [])}
    iso3s = {c["iso3"] for c in countries}
    res = Result()
    for v, y, e in zip(data.get("values", []), data.get("years", []), data.get("entities", [])):
        iso3 = ents.get(e)
        val = to_float(v)
        if iso3 in iso3s and val is not None:
            res.add(iso3, Point(int(y), val))
    return res.finalize()
