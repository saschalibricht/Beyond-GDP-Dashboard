"""Shared types for adapters.

An adapter turns one source definition (from indicators.json) into time series
per country. It never decides what to show; the builder does that.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any


class AdapterError(Exception):
    """The source could not be read (network, format change, missing token...)."""


class AdapterDisabled(Exception):
    """The source is intentionally switched off (e.g. token not configured)."""


@dataclass
class Point:
    year: int
    value: float
    nature: str | None = None   # e.g. "C" country data, "E" estimated, "M" modelled
    lo: float | None = None
    hi: float | None = None

    def to_list(self) -> list:
        out: list[Any] = [self.year, round(self.value, 6)]
        extras = {}
        if self.nature:
            extras["n"] = self.nature
        if self.lo is not None:
            extras["lo"] = round(self.lo, 6)
        if self.hi is not None:
            extras["hi"] = round(self.hi, 6)
        if extras:
            out.append(extras)
        return out


@dataclass
class Result:
    series: dict[str, list[Point]] = field(default_factory=dict)
    notes: dict[str, list[str]] = field(default_factory=dict)
    meta: dict[str, dict] = field(default_factory=dict)   # per-country extra info (e.g. welfare type)

    def add(self, iso3: str, point: Point) -> None:
        if point.value is None or (isinstance(point.value, float) and math.isnan(point.value)):
            return
        self.series.setdefault(iso3, []).append(point)

    def note(self, iso3: str, text: str) -> None:
        lst = self.notes.setdefault(iso3, [])
        if text not in lst:
            lst.append(text)

    def finalize(self) -> "Result":
        for iso3, pts in self.series.items():
            by_year: dict[int, Point] = {}
            for p in pts:
                by_year[p.year] = p          # last write wins for duplicate years
            self.series[iso3] = [by_year[y] for y in sorted(by_year)]
        return self


def to_float(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return None if (isinstance(v, float) and math.isnan(v)) else float(v)
    s = str(v).strip().replace(",", "")
    if s in ("", "..", "NaN", "nan", "NA", "N/A", "-", "null", "None"):
        return None
    s = s.lstrip("<>~≤≥")
    try:
        return float(s)
    except ValueError:
        return None


def to_year(v: Any) -> int | None:
    f = to_float(str(v)[:4]) if v is not None else None
    return int(f) if f is not None else None


def match_pref(value: str, prefs: list[str]) -> int | None:
    """Rank of the first preference matching value: exact first, then as a whole token.

    Token matching lets "READ" match "SKILL_READ" or "TOTAL" match "ISCO08_TOTAL",
    but never lets "MALE" match "FEMALE".
    """
    if value is None:
        return None
    v = str(value).upper()
    for i, p in enumerate(prefs):
        if v == p.upper():
            return i
    for i, p in enumerate(prefs):
        if re.search(r"(^|[^A-Z0-9])" + re.escape(p.upper()) + r"([^A-Z0-9]|$)", v):
            return i
    return None


TOTAL_CODES = ["_T", "TOTAL", "ALL", "BOTHSEX", "ALLAGE", "ALLAREA", "_Z", "_X", "T", "SEX_T", "BTSX", "NOT_APPLICABLE"]
