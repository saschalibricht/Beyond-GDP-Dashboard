"""World Bank Indicators API v2 (no key). https://datahelpdesk.worldbank.org/knowledgebase/articles/889392

Params:
  indicator  WDI code, e.g. "SI.POV.GINI"
  source     optional database id (e.g. 59 = Wealth Accounts)
  transform  optional: "per100k" divides by SP.POP.TOTL and multiplies by 100,000
"""
from __future__ import annotations

from .. import http
from .base import AdapterError, Point, Result, to_float, to_year

BASE = "https://api.worldbank.org/v2"
# above this many countries, ask for "all" and filter locally (keeps URLs short)
MANY = 40


def _area(iso3s: list[str]) -> str:
    return ";".join(iso3s) if len(iso3s) <= MANY else "all"


def _pages(url: str, params: dict, what: str) -> list[dict]:
    rows: list[dict] = []
    page = 1
    while True:
        data = http.get_json(url, {**params, "page": page})
        if not isinstance(data, list) or not data:
            raise AdapterError(f"Unexpected World Bank response for {what}")
        if isinstance(data[0], dict) and "message" in data[0]:
            raise AdapterError(f"World Bank API error for {what}: {data[0]['message']}")
        if len(data) < 2 or data[1] is None:
            return rows
        rows.extend(data[1])
        pages = int((data[0] or {}).get("pages") or 1) if isinstance(data[0], dict) else 1
        if page >= pages or page >= 20:
            return rows
        page += 1


def _fetch(indicator: str, iso3s: list[str], source: int | None = None) -> dict[str, dict[int, tuple[float, str]]]:
    url = f"{BASE}/country/{_area(iso3s)}/indicator/{indicator}"
    params = {"format": "json", "per_page": 20000}
    if source:
        params["source"] = source
    wanted = set(iso3s)
    out: dict[str, dict[int, tuple[float, str]]] = {}
    for row in _pages(url, params, indicator):
        iso3 = row.get("countryiso3code") or ""
        year = to_year(row.get("date"))
        val = to_float(row.get("value"))
        if iso3 not in wanted or year is None or val is None:
            continue
        out.setdefault(iso3, {})[year] = (val, row.get("obs_status") or "")
    return out


def fetch(params: dict, countries: list[dict], ctx: dict) -> Result:
    iso3s = [c["iso3"] for c in countries]
    ind = params["indicator"]
    raw = _fetch(ind, iso3s, params.get("source"))
    res = Result()
    pop = _fetch("SP.POP.TOTL", iso3s) if params.get("transform") == "per100k" else None
    for iso3, years in raw.items():
        for year, (val, status) in years.items():
            if pop is not None:
                p = pop.get(iso3, {}).get(year)
                if not p or p[0] <= 0:
                    continue
                val = val / p[0] * 100_000
            nature = "E" if status.upper() in ("E", "F") else None
            res.add(iso3, Point(year, val, nature))
    if params.get("transform") == "per100k":
        for iso3 in res.series:
            res.note(iso3, "Converted to a rate per 100,000 people using World Bank population data.")
    return res.finalize()


def _meta(row: dict) -> dict:
    return {
        "name": row.get("name"),
        "income": (row.get("incomeLevel") or {}).get("id"),
        "incomeLabel": (row.get("incomeLevel") or {}).get("value"),
        "region": (row.get("region") or {}).get("value"),
    }


def country_metadata(iso3s: list[str]) -> dict[str, dict]:
    """Name, income level and region for each country (used to auto-fill new countries)."""
    wanted = set(iso3s)
    rows = _pages(f"{BASE}/country/{_area(iso3s)}", {"format": "json", "per_page": 400}, "country list")
    return {r["id"]: _meta(r) for r in rows if r.get("id") in wanted}


def all_countries() -> dict[str, dict]:
    """Every economy the World Bank lists, without regional and income aggregates."""
    rows = _pages(f"{BASE}/country/all", {"format": "json", "per_page": 400}, "country list")
    return {r["id"]: _meta(r) for r in rows if (r.get("region") or {}).get("id") not in (None, "", "NA")}
