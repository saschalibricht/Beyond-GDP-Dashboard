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


def _fetch(indicator: str, iso3s: list[str], source: int | None = None) -> dict[str, dict[int, tuple[float, str]]]:
    url = f"{BASE}/country/{';'.join(iso3s)}/indicator/{indicator}"
    params = {"format": "json", "per_page": 20000}
    if source:
        params["source"] = source
    data = http.get_json(url, params)
    if not isinstance(data, list) or not data:
        raise AdapterError(f"Unexpected World Bank response for {indicator}")
    if isinstance(data[0], dict) and "message" in data[0]:
        msg = data[0]["message"]
        raise AdapterError(f"World Bank API error for {indicator}: {msg}")
    if len(data) < 2 or data[1] is None:
        return {}
    out: dict[str, dict[int, tuple[float, str]]] = {}
    for row in data[1]:
        iso3 = row.get("countryiso3code") or ""
        year = to_year(row.get("date"))
        val = to_float(row.get("value"))
        if not iso3 or year is None or val is None:
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


def country_metadata(iso3s: list[str]) -> dict[str, dict]:
    """Name, income level and region for each country (used to auto-fill new countries)."""
    data = http.get_json(f"{BASE}/country/{';'.join(iso3s)}", {"format": "json", "per_page": 400})
    out = {}
    if isinstance(data, list) and len(data) > 1 and data[1]:
        for row in data[1]:
            out[row["id"]] = {
                "name": row.get("name"),
                "income": (row.get("incomeLevel") or {}).get("id"),
                "incomeLabel": (row.get("incomeLevel") or {}).get("value"),
                "region": (row.get("region") or {}).get("value"),
            }
    return out
