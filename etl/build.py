"""Build the dashboard data.

    python -m etl.build                 # full run (used by the daily GitHub Action)
    python -m etl.build --only gini     # re-run selected indicators, keep the rest

Outputs (all committed to the repo and served as static files):
    site/data/registry.json   framework, tags, indicator descriptions, countries
    site/data/dashboard.json  values per indicator and country
    site/data/status.json     health of every data source, last check / last change
    data/etl_state.json       failure counters (drives the GitHub issue alert)
    data/alerts.json          sources that failed 3+ runs in a row
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
import traceback
from pathlib import Path

from . import http
from .adapters import ADAPTERS, PROVIDERS
from .adapters.base import AdapterDisabled, Point, Result

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config"
SITE_DATA = ROOT / "site" / "data"
STATE_DIR = ROOT / "data"

OUTDATED_AFTER_YEARS = 3
ALERT_AFTER_FAILURES = 3
MODELLED_NATURE = {"E", "M", "EST", "MODELLED", "ESTIMATED"}
DYNAMIC_TAGS = {"outdated", "substitute"}


# ----------------------------------------------------------------------------- io
def load_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path: Path, data, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(data, ensure_ascii=False, indent=2)
    path.write_text(text + "\n", encoding="utf-8")


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def source_key(src: dict) -> str:
    return src["adapter"] + ":" + json.dumps(src.get("params", {}), sort_keys=True, separators=(",", ":"))


# ------------------------------------------------------------------- countries
def resolve_countries(cfg: dict, log) -> list[dict]:
    """Fill in name, income group and M49 code for configured countries.

    Manual values in countries.json always win. Lookups are cached so a failing
    API never removes information that was known before.
    """
    from .adapters import sdg, worldbank

    cache_path = STATE_DIR / "countries_resolved.json"
    cache = load_json(cache_path, {}) or {}
    countries = [dict(c) for c in cfg["countries"]]
    iso3s = [c["iso3"].upper() for c in countries]
    try:
        wb = worldbank.country_metadata(iso3s)
    except Exception as e:
        log(f"  ! country metadata lookup failed: {e}")
        wb = {}
    need_m49 = [c for c in countries if not c.get("m49") and not cache.get(c["iso3"], {}).get("m49")]
    geo = {}
    if need_m49:
        try:
            geo = sdg.geo_areas()
        except Exception as e:
            log(f"  ! M49 lookup failed: {e}")
    for c in countries:
        c["iso3"] = c["iso3"].upper()
        known = cache.get(c["iso3"], {})
        info = wb.get(c["iso3"], {})
        c.setdefault("name", info.get("name") or known.get("name") or c["iso3"])
        c["income"] = info.get("income") or known.get("income")
        c["incomeLabel"] = info.get("incomeLabel") or known.get("incomeLabel")
        c["region"] = info.get("region") or known.get("region")
        if not c.get("m49"):
            c["m49"] = known.get("m49")
            for n in [c["name"]] + c.get("aliases", []):
                if not c["m49"] and n and n.lower() in geo:
                    c["m49"] = geo[n.lower()]
        c.setdefault("aliases", [])
        if c["name"] not in c["aliases"]:
            c["aliases"].append(c["name"])
        cache[c["iso3"]] = {k: c.get(k) for k in ("name", "income", "incomeLabel", "region", "m49")}
    write_json(cache_path, cache)
    return countries


# -------------------------------------------------------------------- selection
def validate(points: list[Point], ind: dict) -> tuple[list[Point], int]:
    lo, hi = (ind.get("range") or [float("-inf"), float("inf")])
    div = float(ind.get("divide", 1) or 1)
    kept, dropped = [], 0
    for p in points:
        if not (lo <= p.value <= hi):
            dropped += 1
            continue
        if div != 1:
            p = Point(p.year, p.value / div, p.nature,
                      p.lo / div if p.lo is not None else None,
                      p.hi / div if p.hi is not None else None)
        kept.append(p)
    return kept, dropped


def auto_tags(ind: dict, latest: dict, proxy: bool, this_year: int) -> list[str]:
    tags = [t for t in ind.get("tags", []) if t not in DYNAMIC_TAGS]
    if latest and this_year - latest["year"] > OUTDATED_AFTER_YEARS:
        tags.insert(0, "outdated")
    if latest and str(latest.get("nature") or "").upper() in MODELLED_NATURE and "modelled" not in tags:
        tags.append("modelled")
    if proxy:
        tags.append("substitute")
    return tags


def choose(ind: dict, country: dict, runs: dict, prev_entry: dict | None, this_year: int, today: str) -> dict:
    iso3 = country["iso3"]
    if ind.get("naIncome") and country.get("income") in ind["naIncome"]:
        return {"status": "not_applicable", "notes": [ind.get("naNote", "Not computed for this country group.")],
                "tags": [t for t in ind.get("tags", []) if t not in DYNAMIC_TAGS]}
    errors, notes = [], []
    for i, src in enumerate(ind["sources"]):
        run = runs[source_key(src)]
        if run["status"] == "disabled":
            continue
        if run["status"] == "error":
            errors.append(f"{src['label']}: {run['error']}")
            continue
        result: Result = run["result"]
        pts = list(result.series.get(iso3, []))
        pts, dropped = validate(pts, ind)
        if not pts:
            continue
        last = pts[-1]
        latest = {"year": last.year, "value": last.value}
        if last.nature:
            latest["nature"] = last.nature
        if last.lo is not None:
            latest["lo"] = last.lo
        if last.hi is not None:
            latest["hi"] = last.hi
        entry_notes = list(result.notes.get(iso3, []))
        if dropped:
            entry_notes.append(f"{dropped} value(s) outside the plausible range were excluded.")
        if i > 0 and not src.get("proxy"):
            entry_notes.append("The primary source had no data; an alternative source for the same measure is used.")
        if src.get("proxy") and src.get("proxyNote"):
            entry_notes.insert(0, "Substitute: " + src["proxyNote"] + ".")
        entry = {
            "status": "ok",
            "src": i,
            "proxy": bool(src.get("proxy")),
            "latest": latest,
            "series": [p.to_list() for p in pts],
            "tags": auto_tags(ind, latest, bool(src.get("proxy")), this_year),
            "notes": entry_notes,
        }
        if result.meta.get(iso3):
            entry["meta"] = result.meta[iso3]
        return entry

    active = [s for s in ind["sources"] if runs[source_key(s)]["status"] != "disabled"]
    all_failed = bool(active) and len(errors) == len(active)
    if errors and prev_entry and prev_entry.get("status") == "ok":
        kept = dict(prev_entry)
        since = (prev_entry.get("stale") or {}).get("since", today)
        kept["stale"] = {"since": since, "reason": errors[0][:300]}
        return kept
    if all_failed:
        return {"status": "source_error", "notes": [e[:300] for e in errors],
                "tags": [t for t in ind.get("tags", []) if t not in DYNAMIC_TAGS]}
    notes = [ind["unavailableNote"]] if ind.get("unavailableNote") else []
    return {"status": "no_data", "notes": notes + [e[:300] for e in errors],
            "tags": [t for t in ind.get("tags", []) if t not in DYNAMIC_TAGS]}


# ------------------------------------------------------------------------ main
def public_registry(framework: dict, tags: dict, indicators: list[dict], countries: list[dict], ccfg: dict) -> dict:
    inds = []
    for ind in indicators:
        pub = {k: v for k, v in ind.items() if k not in ("sources", "range")}
        pub["sources"] = [{k: s.get(k) for k in ("label", "url", "proxy", "proxyNote") if s.get(k) is not None}
                          for s in ind["sources"]]
        inds.append(pub)
    return {
        "framework": framework,
        "tags": tags["tags"],
        "indicators": inds,
        "countries": [{k: c.get(k) for k in ("iso3", "name", "income", "incomeLabel", "region")} for c in countries],
        "defaultCountry": ccfg.get("default"),
        "defaultCompare": ccfg.get("defaultCompare"),
        "outdatedAfterYears": OUTDATED_AFTER_YEARS,
    }


def run(only: list[str] | None = None, log=print) -> int:
    framework = load_json(CONFIG / "framework.json")
    tags = load_json(CONFIG / "tags.json")
    ind_cfg = load_json(CONFIG / "indicators.json")
    ccfg = load_json(CONFIG / "countries.json")
    indicators = ind_cfg["indicators"]
    prev = load_json(SITE_DATA / "dashboard.json", {}) or {}
    prev_status = load_json(SITE_DATA / "status.json", {}) or {}
    state = load_json(STATE_DIR / "etl_state.json", {}) or {}
    today = dt.date.today().isoformat()
    this_year = dt.date.today().year
    started = now_iso()

    log("Resolving countries…")
    countries = resolve_countries(ccfg, log)
    log("  " + ", ".join(f"{c['iso3']} ({c.get('income') or '?'}, m49={c.get('m49')})" for c in countries))

    selected = [i for i in indicators if not only or i["id"] in only]
    runs: dict[str, dict] = {}
    ctx: dict = {}
    for ind in selected:
        for src in ind["sources"]:
            key = source_key(src)
            if key in runs:
                runs[key]["indicators"].append(ind["id"])
                continue
            log(f"Fetching {src['adapter']} for {ind['id']} …")
            entry = {"adapter": src["adapter"], "label": src["label"], "url": src.get("url"),
                     "optional": bool(src.get("optional")), "indicators": [ind["id"]]}
            try:
                res = ADAPTERS[src["adapter"]](src.get("params", {}), countries, ctx)
                entry.update(status="ok", result=res, countries=sorted(res.series))
                log(f"  ok: {len(res.series)} countries")
            except AdapterDisabled as e:
                entry.update(status="disabled", error=str(e))
                log(f"  disabled: {e}")
            except Exception as e:  # never let one source break the run
                entry.update(status="error", error=f"{type(e).__name__}: {e}"[:500])
                log(f"  ERROR: {entry['error']}")
                if "--debug" in sys.argv:
                    traceback.print_exc()
            runs[key] = entry

    values = dict(prev.get("values", {})) if only else {}
    for ind in selected:
        prev_ind = (prev.get("values") or {}).get(ind["id"], {})
        values[ind["id"]] = {c["iso3"]: choose(ind, c, runs, prev_ind.get(c["iso3"]), this_year, today) for c in countries}

    # --- source health + failure counters
    sources_out = []
    alerts = []
    prev_sources = {s["key"]: s for s in prev_status.get("sources", [])}
    for key, r in runs.items():
        st = state.get(key, {})
        if r["status"] == "ok":
            st = {"lastSuccess": started, "consecutiveFailures": 0}
        elif r["status"] == "error":
            st = {**st, "consecutiveFailures": st.get("consecutiveFailures", 0) + 1, "lastError": r["error"]}
        state[key] = st
        provider, provider_url = PROVIDERS.get(r["adapter"], (r["adapter"], None))
        out = {"key": key, "provider": provider, "providerUrl": provider_url, "label": r["label"], "url": r["url"],
               "status": r["status"], "error": r.get("error"), "optional": r["optional"],
               "indicators": r["indicators"], "countries": r.get("countries", []),
               "lastSuccess": st.get("lastSuccess"), "consecutiveFailures": st.get("consecutiveFailures", 0)}
        sources_out.append(out)
        if r["status"] == "error" and not r["optional"] and out["consecutiveFailures"] >= ALERT_AFTER_FAILURES:
            alerts.append(out)
    if only:  # keep status of sources that were not re-run
        seen = {s["key"] for s in sources_out}
        sources_out += [s for k, s in prev_sources.items() if k not in seen]

    data_hash = hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()[:16]
    changed = data_hash != prev.get("dataHash")
    last_changed = started if changed or not prev.get("lastChanged") else prev["lastChanged"]

    write_json(SITE_DATA / "registry.json", public_registry(framework, tags, indicators, countries, ccfg))
    write_json(SITE_DATA / "dashboard.json", {"dataHash": data_hash, "lastChanged": last_changed, "values": values}, compact=True)
    write_json(SITE_DATA / "status.json", {"lastChecked": started, "lastChanged": last_changed, "sources": sources_out})
    write_json(STATE_DIR / "etl_state.json", state)
    write_json(STATE_DIR / "alerts.json", alerts)

    ok = sum(1 for r in runs.values() if r["status"] == "ok")
    err = sum(1 for r in runs.values() if r["status"] == "error")
    log(f"Done. Sources ok: {ok}, failed: {err}, disabled: {len(runs) - ok - err}. Data changed: {changed}.")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="*", help="indicator ids to refresh")
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()
    http.reset_memo()
    sys.exit(run(args.only))


if __name__ == "__main__":
    main()
