"""WHO Global Health Observatory OData API (no key).

WHO has announced that the current endpoint (ghoapi.azureedge.net) is being replaced.
The candidate list below makes switching a one-line change; until then the dashboard
falls back to the Our World in Data mirror configured in indicators.json.

Params:
  code  GHO indicator code, e.g. "WHOSIS_000002" (healthy life expectancy at birth)
  sex   preferred Dim1 values, e.g. ["SEX_BTSX", "BTSX"]
"""
from __future__ import annotations

from .. import http
from .base import AdapterError, Point, Result, match_pref, to_float, to_year

ENDPOINTS = [
    "https://ghoapi.azureedge.net/api/{code}",
]


def fetch(params: dict, countries: list[dict], ctx: dict) -> Result:
    code = params["code"]
    rows, last = None, None
    for tpl in ENDPOINTS:
        try:
            data = http.get_json(tpl.format(code=code))
            rows = data.get("value") if isinstance(data, dict) else None
            if rows:
                break
        except Exception as e:
            last = e
    if not rows:
        raise AdapterError(f"WHO GHO returned no data for {code}: {last}")
    iso3s = {c["iso3"] for c in countries}
    prefs = params.get("sex") or ["SEX_BTSX", "BTSX"]
    res = Result()
    for r in rows:
        iso3 = r.get("SpatialDim")
        if iso3 not in iso3s:
            continue
        if r.get("Dim1") and match_pref(r.get("Dim1"), prefs) is None:
            continue
        y, v = to_year(r.get("TimeDim")), to_float(r.get("NumericValue"))
        if y is None or v is None:
            continue
        res.add(iso3, Point(y, v, "M", to_float(r.get("Low")), to_float(r.get("High"))))
    return res.finalize()
