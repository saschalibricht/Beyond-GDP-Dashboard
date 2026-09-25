"""Open, update or close a GitHub issue when data sources keep failing.

Runs inside GitHub Actions after the build (uses the built-in GITHUB_TOKEN, no setup).
GitHub emails the repository owner about new issues, so a broken source is noticed
without anyone checking the dashboard.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
LABEL = "data-source-alert"
TITLE = "Data source failing: dashboard is showing older values"


def main() -> None:
    token, repo = os.environ.get("GITHUB_TOKEN"), os.environ.get("GITHUB_REPOSITORY")
    if not token or not repo:
        print("No GitHub context; skipping alert step.")
        return
    alerts = json.loads((ROOT / "data" / "alerts.json").read_text() or "[]")
    api = f"https://api.github.com/repos/{repo}"
    h = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    requests.post(f"{api}/labels", headers=h, json={"name": LABEL, "color": "d73a4a"})  # ignore 'exists'
    issues = requests.get(f"{api}/issues", headers=h, params={"labels": LABEL, "state": "open"}).json()
    existing = issues[0] if isinstance(issues, list) and issues else None

    if not alerts:
        if existing:
            requests.post(f"{api}/issues/{existing['number']}/comments", headers=h,
                          json={"body": "All data sources are working again. Closing automatically."})
            requests.patch(f"{api}/issues/{existing['number']}", headers=h, json={"state": "closed"})
        print("No alerts.")
        return

    lines = ["The daily data update could not reach these sources for 3 or more runs in a row. "
             "The dashboard keeps showing the last good values, marked as stale.", ""]
    for a in alerts:
        lines.append(f"- **{a['label']}** ({a['provider']}) – {a['consecutiveFailures']} failed runs, "
                     f"last success: {a.get('lastSuccess') or 'never'}")
        lines.append(f"  - Indicators: {', '.join(a['indicators'])}")
        lines.append(f"  - Error: `{(a.get('error') or '')[:300]}`")
    lines += ["", "What to do: check whether the source moved or changed format (see README → *When a source breaks*). "
              "This issue closes itself once all sources work again."]
    body = "\n".join(lines)
    if existing:
        requests.patch(f"{api}/issues/{existing['number']}", headers=h, json={"body": body})
    else:
        requests.post(f"{api}/issues", headers=h, json={"title": TITLE, "body": body, "labels": [LABEL]})
    print(f"Alert issue updated for {len(alerts)} source(s).")


if __name__ == "__main__":
    sys.exit(main())
