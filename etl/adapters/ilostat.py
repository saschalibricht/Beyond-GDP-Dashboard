"""ILOSTAT bulk download (no key). https://ilostat.ilo.org/data/bulk/

Params:
  indicator  ILOSTAT indicator id, e.g. "LUU_XLU4_SEX_AGE_RT_A"
  filters    {column: value or [preferred values]} applied to the bulk CSV

The whole indicator file (a few MB, gzipped CSV) is downloaded and filtered locally,
which is more stable than query APIs whose parameters change.
"""
from __future__ import annotations

import csv
import io
from collections import Counter, defaultdict

from .. import http
from .base import AdapterError, Point, Result, match_pref, to_float, to_year

URLS = [
    "https://rplumber.ilo.org/data/indicator/?id={ind}&format=.csv.gz",
    "https://www.ilo.org/ilostat-files/WEB_bulk_download/indicator/{ind}.csv.gz",
]


def _download(ind: str) -> list[dict]:
    last = None
    for tpl in URLS:
        try:
            text = http.get_text(tpl.format(ind=ind))
            rows = list(csv.DictReader(io.StringIO(text)))
            if rows and "ref_area" in rows[0]:
                return rows
            last = AdapterError(f"Unexpected ILOSTAT file format at {tpl}")
        except Exception as e:  # try the next mirror
            last = e
    raise AdapterError(f"ILOSTAT download failed for {ind}: {last}")


def fetch(params: dict, countries: list[dict], ctx: dict) -> Result:
    ind = params["indicator"]
    rows = _download(ind)
    iso3s = {c["iso3"] for c in countries}
    filters = params.get("filters") or {}
    per_country: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        if r.get("ref_area") in iso3s:
            per_country[r["ref_area"]].append(r)
    res = Result()
    for iso3, crow in per_country.items():
        for col, want in filters.items():
            prefs = want if isinstance(want, list) else [want]
            ranks = [match_pref(r.get(col), prefs) for r in crow]
            ranks = [x for x in ranks if x is not None]
            if ranks:
                best = min(ranks)
                crow = [r for r in crow if match_pref(r.get(col), prefs) == best]
        # several survey sources may cover the same years: keep the most complete one
        sources = Counter(r.get("source") for r in crow)
        if len(sources) > 1:
            main = sources.most_common(1)[0][0]
            crow = [r for r in crow if r.get("source") == main]
            res.note(iso3, "Several national sources exist; the one with the longest series is shown.")
        for r in crow:
            y, v = to_year(r.get("time")), to_float(r.get("obs_value"))
            if y is None or v is None:
                continue
            status = (r.get("obs_status") or "").upper()
            res.add(iso3, Point(y, v, "E" if status in ("E", "F") else None))
    return res.finalize()
