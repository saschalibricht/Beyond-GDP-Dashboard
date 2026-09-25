# Beyond GDP dashboard

A web dashboard of the 31 indicators proposed in *Counting What Counts: A Compass of Progress for People and Planet* (UN High-Level Expert Group on Beyond GDP, 2026), filled with openly available data. It shows every indicator's limitations and never hides missing values.

- Structure follows the report: four components (foundational principles, current well-being, equity and inclusion, sustainability and resilience), coloured as in the report.
- Each tile shows an explanation, the latest value and year, and recurring limitation tags. Selecting a tile's title opens a time series, the full limitations and the source chain.
- A two-country comparison uses shared-scale bars, and warns when years, sources or survey types differ.
- You can pin indicators to build a custom comparison set. The view is shareable via the URL.
- Light, dark or system theme; responsive for phone and desktop.

## How it works

```
GitHub Actions (daily, free)                 Render (free static site)
┌──────────────────────────────┐   commit   ┌──────────────────────┐
│ python -m etl.build          │ ─────────► │ serves ./site        │
│  fetch ~11 open data sources │  site/data │ auto-redeploys on    │
│  choose fallbacks, tag, check│            │ every commit         │
│  keep last good values       │            └──────────────────────┘
│ python -m etl.alert          │ ─► GitHub issue (+ email) if a source
└──────────────────────────────┘    fails 3 days in a row
```

- **No server, no database, no build step.** The site is plain HTML/CSS/JS with zero dependencies, and the browser only reads three JSON files.
- **Users never wait for slow APIs.** All fetching happens in the daily job.
- **Failures are contained.** If a source fails, its last good values stay online and are marked "Not updated since…". An issue opens automatically after three failed days and closes itself when the source recovers.
- **Commits are idempotent.** The data files only change when something actually changed, apart from the "last checked" timestamp.

## Deploy (about 10 minutes, all free)

1. **Create a GitHub repository** and push this folder to it.
2. **Allow the workflow to commit.** Go to *Settings → Actions → General → Workflow permissions* and select **Read and write permissions**.
3. **Optional: conflict data from UCDP.** Request a free API token by emailing the UCDP API maintainer (see https://ucdp.uu.se/apidocs/). Then add it under *Settings → Secrets and variables → Actions → New repository secret* with the name `UCDP_TOKEN`. Without it, the dashboard uses the SDG series and World Bank battle-death data instead.
4. **Run the first data update.** Go to *Actions → Update data → Run workflow*. This also runs automatically on the first push. It takes 2–5 minutes.
5. **Create the site on Render.**
   - Go to *New → Blueprint*, pick the repository, and Render reads `render.yaml`.
   - Alternatively: *New → Static Site*, with an empty build command and publish directory `site`.
   - The free static plan has no sleep and no time limits.

After that nothing needs doing. The job runs daily at 04:17 UTC and Render redeploys when data change.

**Registration summary:** only the optional UCDP token. Every other source works without a key.

## Local development

```bash
pip install -r requirements.txt
python -m unittest discover -s tests      # offline tests, fake APIs
python -m etl.demo                        # random DEMO data to preview the layout
python -m etl.build                       # real data (needs internet)
python -m etl.build --only gini hale      # refresh selected indicators
python -m http.server -d site 8000        # open http://localhost:8000
```

Do not commit demo output. The real run overwrites it anyway.

## Adding a country

Add one line to `config/countries.json`:

```json
{ "iso3": "FRA" }
```

The next run looks up the name, income group and UN M49 code automatically. Optional fields:
- `gw`: Gleditsch-Ward code, needed only for UCDP.
- `aliases`: other spellings used by name-matched sources (World Happiness Report, NHM).

The push triggers a data run on its own.

## Adding or changing an indicator

Each entry in `config/indicators.json` holds the texts shown on the site and an ordered `sources` list. For each country, the first source with valid data wins.

| field | meaning |
|---|---|
| `pillar`, `domain` | placement; ids from `framework.json` |
| `label`, `explanation`, `name` | tile title, plain-language text, the report's exact wording |
| `unit`, `unitShort`, `decimals`, `direction` (`higher`/`lower`/`neutral`), `scale` | display settings; `scale` fixes the comparison bar range |
| `tier`, `sdg` | report annex tier, SDG code |
| `tags` | static limitation tags (see below) |
| `limitations` | indicator-specific caveats |
| `range` | plausibility check; values outside are dropped and noted |
| `naIncome` + `naNote` | income groups where the indicator is "not applicable" |
| `unavailableNote` | shown when no source has data |
| `divide`, `secondary`, `hidden` | unit scaling, a linked second value, and a helper-only indicator |

A source entry looks like `{ "adapter": "...", "params": {...}, "label", "url", "proxy": true/false, "proxyNote", "optional": true/false }`.

- `proxy: true` adds the *Substitute* tag automatically.
- `optional: true` sources never raise alerts.

| adapter | params |
|---|---|
| `worldbank` | `indicator` (WDI code), `source` (database id, e.g. 59), `transform: "per100k"` |
| `sdg` | `series`, `indicator` (fallback), `dims` {dimension: [preferred values]}, `combine` {dim, values, op: `mean`/`ratio_pct`} |
| `pip_mean`, `pip_spl` | `baseline` (year for the fixed societal poverty line) |
| `ilostat` | `indicator`, `filters` {column: value(s)} |
| `owid_grapher` | `slug`, `altSlugs`, `column` |
| `owid_indicator` | `id`, or `shortName` + `searchAround` + `window` (self-healing id lookup) |
| `who_gho` | `code`, `sex` |
| `ucdp` | none (token from env) |
| `nhm_bii` | `package`, `maxYear` |
| `whr` | `column` (list of names), `multiply` |

For SDG data, dimension values are matched exactly first and then as whole tokens, so `READ` matches `SKILL_READ` but `MALE` never matches `FEMALE`. Any breakdown that is not a total is written into the notes, so the site states what it shows.

New source type? Add a module in `etl/adapters/` returning a `Result`, register it in `etl/adapters/__init__.py`, and add a test with a fake payload.

## Limitation tags

Defined in `config/tags.json` and shown identically on every tile:

- **Outdated**: set automatically when the latest value is more than 3 years old.
- **Modelled**: set statically, and also automatically when the source flags a value as estimated or modelled.
- **Survey-based**
- **Infrequent**
- **Low coverage**
- **Substitute**: set automatically when a proxy source is used.
- **Limited comparability**

In comparison mode, a tag that applies to only one country carries its code (e.g. "Outdated KEN").

The site also shows two status markers:
- **Not updated since…**: the source failed and the last good value is shown.
- **Tier I/II**: the report's own classification.

## Substitutes currently used

| Report indicator | Shown instead | Why |
|---|---|---|
| Loneliness (Gallup) | Social support, World Happiness Report | Gallup loneliness data are proprietary |
| Household disposable income (national accounts) | PIP survey mean, annualised | national accounts series exist for only ~70–80 countries; one basis keeps countries comparable |
| PYLL (OECD) | NCD mortality 30–70 (SDG 3.4.1) | PYLL exists only for ~40–50 countries |
| MPI value | MPI headcount ratio | openly mirrored series |
| GHG (UNFCCC inventories) | harmonised OWID/PRIMAP dataset | inventories are complete only for Annex I countries |
| Natural capital (SEEA) | World Bank wealth accounts | SEEA accounts published by ~44% of countries |
| PM2.5 in cities (fallback only) | national mean PM2.5 | used if the urban series is missing |
| Confidence in civil service (fallback only) | trust in national government | used if the IVS series cannot be found |
| Conflict deaths (fallback only) | UCDP / World Bank battle deaths | used where SDG 16.1.2 has no value |

## When a source breaks

The issue created by the workflow names the source, the affected indicators and the error. Typical fixes, all in `config/indicators.json` unless noted:

- **OWID chart renamed:** add the new slug to `altSlugs`.
- **SDG series code changed:** the adapter already falls back to the indicator code. If needed, update `series` or `dims`.
- **WHO API moved:** add the new URL to `ENDPOINTS` in `etl/adapters/who.py`. Until then, the OWID mirror is used automatically.
- **World Happiness Report file renamed:** usually handled automatically. Otherwise adjust `PAGES`/`PREFERENCE` in `etl/adapters/whr.py`.
- **UCDP new yearly version:** discovered automatically. A token error means the secret expired.

Then run *Actions → Update data → Run workflow*. The *source health* panel on the site shows the result.

## To verify after the first run

The build environment had no internet access, so parsers were tested against payloads shaped like each API's documented format, but not against live responses. After the first run, open **Source health** (footer link) and check these for errors or suspicious values:

- **UN SDG series codes and dimension names:** discrimination, unpaid care, proficiency, ICT skills, safety after dark, pay ratio, rural roads.
- **ILOSTAT bulk file URL and `classif1` codes** for LU4.
- **World Bank wealth accounts** (`NW.PCA.PC`, `NW.NCA.PC`, source 59).
- **NHM Biodiversity Intactness file columns.**
- **World Happiness Report data page and file naming.**
- **The OWID indicator lookup for "confidence in the civil services".**
- **UCDP field names** (once a token is set).

Each is a one-line config change if it needs adjusting.

## Maintenance notes

- **Scheduled workflows** are paused by GitHub after 60 days without repository activity. The daily status commit counts as activity. If the job is ever paused, re-enable it in the Actions tab.
- **Fonts and privacy:** Roboto (the report's typeface) is self-hosted in `site/fonts/` (SIL Open Font License, Latin and Latin Extended subsets, weights 400/500/700) and declared in `site/css/fonts.css`. The page makes no requests to Google or any other third party, so no visitor IP addresses are passed on. It sets no cookies and uses `localStorage` only to remember the light/dark choice and pinned indicators.
- **One comparable basis for all countries:** income and premature mortality use the same global series for every country, including Germany and the US, rather than the OECD's measures where they exist. This is deliberate so the six countries can be compared directly.
- **Adapters:** most sources publish yearly, so on most days nothing changes.

## Licence and attribution

Code: choose a licence (e.g. MIT). Data remain the property of their publishers (World Bank, UN DESA/UNSD, ILO, WHO, UCDP, Our World in Data (CC BY), World Happiness Report, Natural History Museum London). This is an independent prototype, not affiliated with the United Nations.
