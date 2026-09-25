"""Generate a synthetic dataset to preview the interface locally.

    python -m etl.demo            # writes public/data/*.json with DEMO values
    python -m etl.build           # replaces them with real data

Demo values are random and clearly labelled as such in the interface.
Never commit demo output: the GitHub Action overwrites it on its first run anyway.
"""
from __future__ import annotations

import datetime as dt
import random

from .build import CONFIG, SITE_DATA, auto_tags, load_json, now_iso, public_registry, write_json


def main() -> None:
    random.seed(7)
    framework, tags = load_json(CONFIG / "framework.json"), load_json(CONFIG / "tags.json")
    inds, ccfg = load_json(CONFIG / "indicators.json")["indicators"], load_json(CONFIG / "countries.json")
    countries = [dict(c, income={"DEU": "HIC", "USA": "HIC"}.get(c["iso3"], "LMC")) for c in ccfg["countries"]]
    this_year = dt.date.today().year
    values = {}
    for n, ind in enumerate(inds):
        lo, hi = ind.get("scale") or [0, 100]
        per = {}
        for k, c in enumerate(countries):
            roll = (n * 7 + k * 3) % 11
            if ind.get("naIncome") and c["income"] in ind["naIncome"]:
                per[c["iso3"]] = {"status": "not_applicable", "notes": [ind.get("naNote", "")], "tags": ind.get("tags", [])}
                continue
            if roll == 0:
                per[c["iso3"]] = {"status": "no_data", "notes": [ind.get("unavailableNote", "The source has no data for this country.")], "tags": ind.get("tags", [])}
                continue
            if roll == 5 and n % 3 == 0:
                per[c["iso3"]] = {"status": "source_error", "notes": ["HTTPError: 503 from source (demo)"], "tags": ind.get("tags", [])}
                continue
            last_year = this_year - 1 - (roll % 6)
            step = 1 if roll % 2 else 3
            base = lo + (hi - lo) * random.uniform(0.2, 0.7)
            series = []
            for y in range(last_year - 12, last_year + 1, step):
                base *= random.uniform(0.95, 1.06)
                series.append([y, round(base, 3)])
            latest = {"year": series[-1][0], "value": series[-1][1]}
            if roll == 3:
                latest["nature"] = "M"
                series[-1].append({"n": "M"})
            proxy = any(s.get("proxy") for s in ind["sources"][:1])
            entry = {"status": "ok", "src": 0, "proxy": proxy, "latest": latest, "series": series,
                     "tags": auto_tags(ind, latest, proxy, this_year), "notes": ["Demo value."]}
            if roll == 7:
                entry["stale"] = {"since": dt.date.today().isoformat(), "reason": "Source unreachable (demo)"}
            per[c["iso3"]] = entry
        values[ind["id"]] = per
    stamp = now_iso()
    write_json(SITE_DATA / "registry.json", public_registry(framework, tags, inds, countries, ccfg))
    write_json(SITE_DATA / "dashboard.json", {"demo": True, "dataHash": "demo", "lastChanged": stamp, "values": values}, compact=True)
    sources = []
    for ind in inds:
        for s in ind["sources"]:
            sources.append({"key": s["adapter"] + ind["id"], "provider": s["label"].split(" (")[0], "label": s["label"],
                            "url": s.get("url"), "status": "ok" if hash(ind["id"]) % 5 else "error",
                            "error": None if hash(ind["id"]) % 5 else "HTTP 503 (demo)", "optional": bool(s.get("optional")),
                            "indicators": [ind["id"]], "lastSuccess": stamp, "consecutiveFailures": 0})
    write_json(SITE_DATA / "status.json", {"demo": True, "lastChecked": stamp, "lastChanged": stamp, "sources": sources})
    print("Demo data written to public/data/. Run `python -m etl.build` for real data.")


if __name__ == "__main__":
    main()
