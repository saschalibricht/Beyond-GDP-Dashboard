"""Uppsala Conflict Data Program API. https://ucdp.uu.se/apidocs/

Since February 2026 the API requires a free access token (request it by email from
UCDP). Put it in the GitHub secret UCDP_TOKEN. Without a token this source is
reported as 'not configured' and the next source in the chain is used.

Deaths from all three types of organised violence (state-based, non-state, one-sided)
are summed by country and year using Gleditsch-Ward codes ('gw' in countries.json),
then converted to a rate per 100,000 people. Events spanning several countries are
split equally between them.
"""
from __future__ import annotations

import datetime as dt
import os
from collections import defaultdict

from .. import http
from .base import AdapterDisabled, AdapterError, Point, Result, to_float, to_year
from .worldbank import _fetch as wb_fetch

BASE = "https://ucdpapi.pcr.uu.se/api/{resource}/{version}"
RESOURCES = {
    "battledeaths": (["gwno_loc", "gwno_location"], ["bd_best", "best"]),
    "nonstate":     (["gwno_location", "gwno_loc"], ["best_fatality_estimate", "best"]),
    "onesided":     (["gwno_location", "gwno_loc"], ["best_fatality_estimate", "best"]),
}


def _versions() -> list[str]:
    y = dt.date.today().year - 2000
    return [f"{v}.1" for v in (y, y - 1, y - 2)]


def _pick(row: dict, keys: list[str]):
    for k in keys:
        if k in row and row[k] not in (None, ""):
            return row[k]
    return None


def _download(resource: str, token: str) -> tuple[list[dict], str]:
    last = None
    for version in _versions():
        rows, page = [], 0
        try:
            while True:
                data = http.get_json(BASE.format(resource=resource, version=version),
                                     {"pagesize": 1000, "page": page}, {"x-ucdp-access-token": token})
                rows.extend(data.get("Result") or [])
                if page + 1 >= int(data.get("TotalPages") or 1) or page > 50:
                    break
                page += 1
            if rows:
                return rows, version
        except Exception as e:
            last = e
    raise AdapterError(f"UCDP {resource}: no version available ({last})")


def fetch(params: dict, countries: list[dict], ctx: dict) -> Result:
    token = os.environ.get("UCDP_TOKEN", "").strip()
    if not token:
        raise AdapterDisabled("UCDP_TOKEN not configured")
    gw_to_iso = {str(c["gw"]): c["iso3"] for c in countries if c.get("gw") is not None}
    if not gw_to_iso:
        raise AdapterDisabled("No Gleditsch-Ward codes configured")
    deaths: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    years: set[int] = set()
    version = None
    for resource, (loc_keys, val_keys) in RESOURCES.items():
        rows, version = _download(resource, token)
        for r in rows:
            y, v = to_year(r.get("year")), to_float(_pick(r, val_keys))
            loc = _pick(r, loc_keys)
            if y is None or v is None or loc is None:
                continue
            years.add(y)
            locs = [s.strip() for s in str(loc).split(",") if s.strip()]
            for g in locs:
                iso3 = gw_to_iso.get(g)
                if iso3:
                    deaths[iso3][y] += v / len(locs)
    if not years:
        raise AdapterError("UCDP returned no usable rows")
    pop = wb_fetch("SP.POP.TOTL", list(gw_to_iso.values()))
    res = Result()
    for iso3 in gw_to_iso.values():
        for y in range(min(years), max(years) + 1):
            p = pop.get(iso3, {}).get(y)
            if not p or p[0] <= 0:
                continue
            res.add(iso3, Point(y, deaths[iso3].get(y, 0.0) / p[0] * 100_000))
        if not deaths.get(iso3):
            res.note(iso3, "No UCDP-recorded organised violence in this country; shown as zero.")
        res.note(iso3, f"UCDP dataset version {version}.")
    return res.finalize()
