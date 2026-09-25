"""World Happiness Report data file (no key).

The WHR publishes its country-year panel as an Excel file whose name changes every
year. This adapter finds the newest link on the WHR website, downloads it and reads
the requested column - the automated replacement for a manual yearly download.

Params:
  column    column name(s) to read, first match wins (e.g. ["Social support"])
  multiply  optional factor (e.g. 100 to turn a 0-1 share into %)
"""
from __future__ import annotations

import re
from urllib.parse import urljoin

import openpyxl

from .. import http
from .base import AdapterError, Point, Result, to_float, to_year

PAGES = [
    "https://worldhappiness.report/data-sharing/",
    "https://worldhappiness.report/data/",
    "https://worldhappiness.report/",
]
LINK_RE = re.compile(r'href=["\']([^"\']+\.xlsx?)["\']', re.I)
# prefer the panel data file (country x year); figure files contain only one year
PREFERENCE = [r"table[_ ]?2\.?1", r"dataforTable", r"panel", r"data"]


def find_file() -> str:
    links: list[str] = []
    for page in PAGES:
        try:
            html = http.get_text(page)
        except Exception:
            continue
        links += [urljoin(page, m) for m in LINK_RE.findall(html)]
    if not links:
        raise AdapterError("No WHR data file link found")

    def rank(url: str) -> tuple:
        name = url.rsplit("/", 1)[-1]
        pref = next((i for i, p in enumerate(PREFERENCE) if re.search(p, name, re.I)), 99)
        year = max([int(y) for y in re.findall(r"(20\d\d)", url)] + [int("20" + y) for y in re.findall(r"WHR(\d\d)", url, re.I)] + [0])
        return (pref, -year)

    return sorted(set(links), key=rank)[0]


def parse(raw: bytes, columns: list[str]) -> tuple[list[tuple[str, int, float]], str]:
    wb = openpyxl.load_workbook(http.as_file(raw), read_only=True, data_only=True)
    for ws in wb.worksheets:
        rows = ws.iter_rows(values_only=True)
        for header in rows:
            hdr = [str(h).strip() if h is not None else "" for h in header]
            low = [h.lower() for h in hdr]
            if not any(h.startswith("country") for h in low):
                continue
            ci = next(i for i, h in enumerate(low) if h.startswith("country"))
            yi = next((i for i, h in enumerate(low) if h == "year"), None)
            vi = next((low.index(c.lower()) for c in columns if c.lower() in low), None)
            if vi is None:
                break
            out = []
            for r in rows:
                if r is None or len(r) <= max(ci, vi):
                    continue
                y = to_year(r[yi]) if yi is not None else None
                v = to_float(r[vi])
                if r[ci] and y and v is not None:
                    out.append((str(r[ci]).strip(), y, v))
            return out, hdr[vi]
    raise AdapterError(f"Columns {columns} not found in WHR file")


def fetch(params: dict, countries: list[dict], ctx: dict) -> Result:
    url = ctx.setdefault("whr_url", None) or find_file()
    ctx["whr_url"] = url
    raw = http.get(url)
    cols = params["column"] if isinstance(params["column"], list) else [params["column"]]
    rows, used = parse(raw, cols)
    mult = float(params.get("multiply", 1))
    names = {}
    for c in countries:
        for n in [c.get("name", "")] + c.get("aliases", []):
            names[n.lower()] = c["iso3"]
    res = Result()
    for name, y, v in rows:
        iso3 = names.get(name.lower())
        if iso3:
            res.add(iso3, Point(y, v * mult))
    for iso3 in res.series:
        res.note(iso3, f"Read from '{url.rsplit('/', 1)[-1]}', column '{used}'.")
    return res.finalize()
