"""World Bank Poverty and Inequality Platform API (no key). https://pip.worldbank.org/api

pip_mean : survey mean income/consumption per day -> annualised (x365), national level.
pip_spl  : poverty headcount at the societal poverty line fixed at a baseline year.

The societal poverty line (SPL) is max(IPL, 1.15 + 0.5 * median) in 2021 PPP $/day
(World Bank definition since the June 2025 PPP update). We read the SPL of the survey
year closest to the baseline, then query the headcount at that fixed line for all years.
"""
from __future__ import annotations

from .. import http
from .base import AdapterError, Point, Result, to_float

BASE = "https://api.worldbank.org/pip/v1/pip"
IPL = 3.00           # international poverty line, 2021 PPP $/day
SPL_CONST = 1.15


def _rows(iso3: str, povline: float | None = None) -> list[dict]:
    params = {"country": iso3, "year": "all", "fill_gaps": "false", "format": "json"}
    if povline is not None:
        params["povline"] = round(povline, 4)
    data = http.get_json(BASE, params)
    if isinstance(data, dict):
        # some deployments wrap results; accept both shapes
        data = data.get("data") or data.get("result") or []
    if not isinstance(data, list):
        raise AdapterError(f"Unexpected PIP response for {iso3}")
    return data


MANY = 40


def _by_country(countries: list[dict]) -> dict[str, list[dict]]:
    """National rows per country: one bulk request when the list is long, else one per country."""
    wanted = [c["iso3"] for c in countries]
    out: dict[str, list[dict]] = {}
    if len(wanted) > MANY:
        rows = _national(_rows("all"))
        if not rows:
            raise AdapterError("PIP returned no rows for all countries")
        for r in rows:
            code = str(r.get("country_code") or "")
            if code in wanted:
                out.setdefault(code, []).append(r)
        return out
    errors = 0
    for iso3 in wanted:
        try:
            out[iso3] = _national(_rows(iso3))
        except Exception:
            errors += 1
    if errors == len(wanted):
        raise AdapterError("PIP API unreachable for all countries")
    return out


def _national(rows: list[dict]) -> list[dict]:
    nat = [r for r in rows if str(r.get("reporting_level", "national")).lower() == "national"]
    return nat or []


def _year(r: dict) -> int | None:
    y = to_float(r.get("reporting_year") or r.get("year"))
    return int(y) if y is not None else None


def _spl(r: dict) -> float | None:
    spl = to_float(r.get("spl"))
    if spl:
        return spl
    med = to_float(r.get("median"))
    if med is None:
        return None
    return max(IPL, SPL_CONST + 0.5 * med)


def fetch_mean(params: dict, countries: list[dict], ctx: dict) -> Result:
    res = Result()
    for iso3, rows in _by_country(countries).items():
        c = {"iso3": iso3}
        welfare = set()
        for r in rows:
            y, mean = _year(r), to_float(r.get("mean"))
            if y is None or mean is None:
                continue
            res.add(c["iso3"], Point(y, mean * 365))
            if r.get("welfare_type"):
                welfare.add(str(r["welfare_type"]).lower())
        if welfare:
            res.meta[c["iso3"]] = {"welfare": "/".join(sorted(welfare))}
            res.note(c["iso3"], "Survey measures " + " and ".join(sorted(welfare)) + ".")
    return res.finalize()


def fetch_spl(params: dict, countries: list[dict], ctx: dict) -> Result:
    baseline = int(params.get("baseline", 2017))
    res = Result()
    errors = 0
    base_rows = _by_country(countries)
    for iso3, rows in base_rows.items():
        candidates = [(abs(_year(r) - baseline), _year(r), _spl(r)) for r in rows if _year(r) and _spl(r)]
        if not candidates:
            continue
        _, base_year, line = min(candidates)
        try:
            fixed = _national(_rows(iso3, povline=line))
        except Exception:
            errors += 1
            continue
        welfare = set()
        for r in fixed:
            y, hc = _year(r), to_float(r.get("headcount"))
            if y is None or hc is None:
                continue
            res.add(iso3, Point(y, hc * 100 if hc <= 1 else hc))
            if r.get("welfare_type"):
                welfare.add(str(r["welfare_type"]).lower())
        res.meta[iso3] = {"welfare": "/".join(sorted(welfare)), "line": round(line, 2), "baseYear": base_year}
        res.note(iso3, f"Poverty line fixed at ${line:.2f} per person per day (2021 PPP), the societal line in {base_year}.")
        if welfare:
            res.note(iso3, "Survey measures " + " and ".join(sorted(welfare)) + ".")
    if errors and errors >= len(base_rows):
        raise AdapterError("PIP API unreachable for all countries")
    return res.finalize()
