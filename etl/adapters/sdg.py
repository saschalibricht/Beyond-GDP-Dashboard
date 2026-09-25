"""UN Statistics Division SDG API (no key). https://unstats.un.org/SDGAPI/swagger/

Params:
  series     preferred series code, e.g. "VC_VAW_MARR"
  indicator  indicator code used as fallback, e.g. "5.2.1" (all series under it)
  dims       {dimension name: [preferred values]} matched exactly, then as substrings
  combine    {"dim": "Sex", "values": ["FEMALE", "MALE"], "op": "ratio_pct" | "mean"}

The SDG database has many disaggregations. We pick, per country, one consistent
combination: configured preferences first, then 'total' codes, then the most
complete breakdown. Every non-obvious choice is written into the notes so the
dashboard can show exactly what is displayed.
"""
from __future__ import annotations

from collections import Counter, defaultdict

from .. import http
from .base import TOTAL_CODES, AdapterError, Point, Result, match_pref, to_float, to_year

BASE = "https://unstats.un.org/SDGAPI/v1/sdg"
PAGE = 5000
DEFAULT_DIMS = {"Reporting Type": ["G", "N"]}
IGNORE_DIMS = {"Units", "Nature", "Observation Status", "UnitMultiplier", "Unit multiplier"}


def _pages(endpoint: str, params: dict) -> list[dict]:
    rows: list[dict] = []
    page = 1
    while True:
        data = http.get_json(f"{BASE}/{endpoint}", {**params, "pageSize": PAGE, "page": page})
        if not isinstance(data, dict) or "data" not in data:
            raise AdapterError(f"Unexpected SDG API response from {endpoint}")
        rows.extend(data["data"] or [])
        total_pages = int(data.get("totalPages") or 1)
        if page >= total_pages or page >= 20:
            break
        page += 1
    return rows


def _load(params: dict, m49s: list[str]) -> tuple[list[dict], str]:
    series = params.get("series")
    if series:
        try:
            rows = _pages("Series/Data", {"seriesCode": series, "areaCode": m49s})
            if rows:
                return rows, f"series {series}"
        except Exception:
            if not params.get("indicator"):
                raise
    ind = params.get("indicator")
    if not ind:
        return [], ""
    rows = _pages("Indicator/Data", {"indicator": ind, "areaCode": m49s})
    return rows, f"indicator {ind}"


def _dims(row: dict) -> dict:
    d = dict(row.get("dimensions") or {})
    for k in IGNORE_DIMS:
        d.pop(k, None)
    return d


def select(rows: list[dict], params: dict) -> tuple[list[Point], list[str]]:
    """Reduce all rows of ONE country to a single yearly series. Returns points and notes."""
    notes: list[str] = []
    if not rows:
        return [], notes
    want_series = params.get("series")
    series_counts = Counter(r.get("series") for r in rows)
    if len(series_counts) > 1:
        chosen = want_series if want_series in series_counts else series_counts.most_common(1)[0][0]
        rows = [r for r in rows if r.get("series") == chosen]
        if chosen != want_series:
            desc = rows[0].get("seriesDescription") or chosen
            notes.append(f"Series used: {desc} ({chosen}).")

    combine = params.get("combine")
    comb_dim = combine["dim"] if combine else None
    prefs = {**DEFAULT_DIMS, **(params.get("dims") or {})}

    # 1. configured preferences
    for dim, plist in prefs.items():
        if dim == comb_dim:
            continue
        ranks = [match_pref(_dims(r).get(dim), plist) for r in rows if dim in _dims(r)]
        ranks = [x for x in ranks if x is not None]
        if not ranks:
            continue
        best = min(ranks)
        rows = [r for r in rows if dim not in _dims(r) or match_pref(_dims(r).get(dim), plist) == best]

    # 2. remaining dimensions with several values: totals first, else most complete
    all_dims = sorted({k for r in rows for k in _dims(r)} - {comb_dim})
    for dim in all_dims:
        values = Counter(_dims(r).get(dim) for r in rows if dim in _dims(r))
        if len(values) <= 1:
            continue
        total = next((v for v in values if str(v).upper() in TOTAL_CODES), None)
        if total is None:
            chosen = sorted(values.items(), key=lambda kv: (-kv[1], str(kv[0])))[0][0]
            notes.append(f"Breakdown shown: {dim} = {chosen}.")
        else:
            chosen = total
        rows = [r for r in rows if _dims(r).get(dim, chosen) == chosen]

    # also report configured choices that are not totals (e.g. 'Sex = FEMALE')
    for dim, plist in prefs.items():
        if dim in DEFAULT_DIMS or dim == comb_dim:
            continue
        vals = {_dims(r).get(dim) for r in rows if dim in _dims(r)}
        if len(vals) == 1:
            v = next(iter(vals))
            if str(v).upper() not in TOTAL_CODES:
                notes.append(f"Breakdown shown: {dim} = {v}.")

    by_year: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        y = to_year(r.get("timePeriodStart"))
        if y is not None:
            by_year[y].append(r)

    points: list[Point] = []
    for y in sorted(by_year):
        yr = by_year[y]
        if combine:
            parts = []
            for want in combine["values"]:
                match = [r for r in yr if match_pref(_dims(r).get(comb_dim), [want]) is not None]
                vals = [to_float(r.get("value")) for r in match]
                vals = [v for v in vals if v is not None]
                parts.append((vals[0] if vals else None, match[0] if match else None))
            if any(p[0] is None for p in parts):
                continue
            nums = [p[0] for p in parts]
            if combine["op"] == "ratio_pct":
                if nums[1] == 0:
                    continue
                val = nums[0] / nums[1] * 100
            else:
                val = sum(nums) / len(nums)
            nature = _nature(parts[0][1])
            points.append(Point(y, val, nature))
        else:
            r = yr[0]
            val = to_float(r.get("value"))
            if val is None:
                continue
            points.append(Point(y, val, _nature(r), to_float(r.get("lowerBound")), to_float(r.get("upperBound"))))
    if combine:
        op = "ratio of" if combine["op"] == "ratio_pct" else "average of"
        notes.append(f"Calculated as the {op} {' and '.join(combine['values']).lower()} values ({comb_dim}).")
    return points, notes


def _nature(row: dict | None) -> str | None:
    if not row:
        return None
    attrs = row.get("attributes") or {}
    n = attrs.get("Nature") or attrs.get("nature")
    return str(n) if n else None


def fetch(params: dict, countries: list[dict], ctx: dict) -> Result:
    by_m49 = {str(c["m49"]): c["iso3"] for c in countries if c.get("m49")}
    if not by_m49:
        raise AdapterError("No UN M49 codes available for the configured countries")
    rows, used = _load(params, list(by_m49))
    res = Result()
    grouped: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        iso3 = by_m49.get(str(r.get("geoAreaCode")))
        if iso3:
            grouped[iso3].append(r)
    for iso3, crow in grouped.items():
        pts, notes = select(crow, params)
        for p in pts:
            res.add(iso3, p)
        for n in notes:
            res.note(iso3, n)
    return res.finalize()


def geo_areas() -> dict[str, int]:
    """Map of lower-case country name -> M49 code, for auto-filling new countries."""
    data = http.get_json(f"{BASE}/GeoArea/List")
    out = {}
    for row in data or []:
        try:
            out[str(row["geoAreaName"]).lower()] = int(row["geoAreaCode"])
        except (KeyError, ValueError):
            continue
    return out
