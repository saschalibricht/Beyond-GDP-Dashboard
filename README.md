# Beyond GDP dashboard

A web dashboard of the 31 indicators proposed in *Counting What Counts: A Compass of Progress for People and Planet* (UN High-Level Expert Group on Beyond GDP, 2026), filled with openly available data. It shows every indicator's limitations and never hides missing values.

- Structure follows the report: four components (foundational principles, current well-being, equity and inclusion, sustainability and resilience), each with its own title colour.
- Every country with enough open data (currently those with at least 5 indicators) can be picked, listed A–Z.
- Each tile shows one indicator for one country: its latest value and year, its trend over time, and its caveats as icons. Selecting a tile opens the explanation, the caveats in words, a time series with a data table, the limitations and the source chain.
- Comparing two countries puts both values on shared-scale bars in each tile. A green pill marks the country that does better, following the indicator's direction (left out when sources differ); the older of two years is shown in yellow. The × on the comparison removes it.
- You can pin indicators to build a custom set. Every view, including an open detail, is shareable via the URL.
- Two tile columns on phones, as many as fit on desktop. Light, dark or system theme.
- Built with Svelte 5 and TypeScript; the data pipeline is Python.

## How it works

```
GitHub Actions (daily, free)                 Render (free static site)
┌──────────────────────────────┐   commit   ┌──────────────────────┐
│ python -m etl.build          │ ─────────► │ npm run build        │
│  fetch ~11 open data sources │ public/data│ serves ./dist        │
│  choose fallbacks, tag, check│            │ auto-redeploys on    │
│  keep last good values       │            │ every commit to main │
│                              │            └──────────────────────┘
│ python -m etl.alert          │ ─► GitHub issue (+ email) if a source
└──────────────────────────────┘    fails 3 days in a row
```

- **No server, no database.** The site is a static Svelte app (about 32 KB of JavaScript, gzipped). The pipeline writes JSON to `public/data/`: `registry.json` (texts, countries), `dashboard.json` (which countries have data), `status.json` (source health) and one `values/XXX.json` per country (~20 KB). The browser fetches only the countries on screen.
- **Users never wait for slow APIs.** All fetching happens in the daily job.
- **Failures are contained.** If a source fails, its last good values stay online and are marked "Not updated since…". An issue opens automatically after three failed days and closes itself when the source recovers.
- **Commits are idempotent.** The data files only change when something actually changed, apart from the "last checked" timestamp.

## Deploy (about 10 minutes, all free)

1. **Create a GitHub repository** and push this folder to it.
2. **Allow the workflow to commit.** Go to *Settings → Actions → General → Workflow permissions* and select **Read and write permissions**.
3. **Optional: conflict data from UCDP.** Request a free API token by emailing the UCDP API maintainer (see https://ucdp.uu.se/apidocs/). Then add it under *Settings → Secrets and variables → Actions → New repository secret* with the name `UCDP_TOKEN`. Without it, the dashboard uses the SDG series and World Bank battle-death data instead.
4. **Run the first data update.** Go to *Actions → Update data → Run workflow*. It takes a few minutes. The job runs only on its daily schedule and when started by hand like this, never on a push, so after changing `config/` or `etl/` start it by hand.
5. **Create the site on Render.**
   - Go to *New → Blueprint*, pick the repository, and Render reads `render.yaml`.
   - Alternatively: *New → Static Site*, with build command `npm ci && npm run build`, publish directory `dist` and environment variable `NODE_VERSION=22`.
   - The free static plan has no sleep and no time limits.

After that nothing needs doing. The job runs daily at 04:17 UTC and Render rebuilds (about a minute) when data change.

**Registration summary:** only the optional UCDP token. Every other source works without a key.

## Local development

```bash
# web app (Node 20.19+)
npm install
npm run dev                               # http://localhost:5173, uses public/data/
npm run check                             # TypeScript + Svelte checks
npm test                                  # unit tests for the comparison and caveat rules
npm run build                             # production build into dist/

# data pipeline (Python 3.11+)
pip install -r requirements.txt
python -m unittest discover -s tests      # offline tests, fake APIs
python -m etl.demo                        # random DEMO data to preview the layout
python -m etl.build                       # real data (needs internet)
python -m etl.build --only gini hale      # refresh selected indicators
```

Layout: `src/lib/` holds types, formatting and the pure dashboard rules (`logic.ts`, unit-tested); `src/components/` the Svelte components; `src/app.css` the design tokens (pastel pillar colours, neumorphic shadows, both themes).

Do not commit demo output. The real run overwrites it anyway.

## Languages

The site is available in English and German. The language follows the browser on the first visit, can be switched with EN / DE in the header, is remembered, and goes into shared links (`?lang=de`).

- **Interface text** lives in `src/lib/i18n/en.ts` (the source) and `de.ts`. Both share one TypeScript type, so a missing German string fails `npm run check`.
- **Content** (indicators, sections, caveat tags) is written in English in `config/*.json`; German lives in `config/i18n/de.json`, keyed by the same ids. The pipeline copies it into `registry.json`. Anything missing falls back to English, and `python -m unittest` lists any gap.
- **Country names, numbers and dates** come from the browser (`Intl.DisplayNames`, `Intl.NumberFormat`), so all countries get correct German names without a list to maintain.
- **Notes written by the pipeline** ("Breakdown shown: …", "Survey measures …") are recognised by their template and shown in German (`translateNote` in `src/lib/i18n/index.ts`). A new template needs a pattern there; until then it is shown in English. Source names and technical error messages stay in English.

To add a language: add its catalog next to `de.ts`, its content file next to `config/i18n/de.json`, and the code to `LANGS`.

## Countries

With `"all": true` in `config/countries.json`, every economy the World Bank lists is included (regional and income aggregates are excluded). A country is shown once it has data for at least `minIndicators` indicators. Names, income groups and regions come from the World Bank; UN M49 codes and alternative spellings from `config/country_codes.json` (generated from ISO 3166, whose numeric codes equal M49 for countries). Its `short` field replaces the World Bank's inverted names, e.g. "Korea, Rep." becomes "South Korea".

Entries under `countries` are always shown and can add manual values:
- `gw`: Gleditsch-Ward code, needed only for the optional UCDP source (currently set for the six original countries only).
- `aliases`: other spellings used by name-matched sources (World Happiness Report, NHM).
- `m49`: overrides the code table.

With a long country list, the World Bank, UN SDG and PIP adapters request all countries at once and filter locally. Only PIP's societal poverty line still needs one request per country.

## Adding or changing an indicator

Each entry in `config/indicators.json` holds the texts shown on the site and an ordered `sources` list. For each country, the first source with valid data wins.

| field | meaning |
|---|---|
| `pillar`, `domain` | placement; ids from `framework.json` |
| `label`, `explanation`, `name` | tile title, plain-language text, the report's exact wording |
| `unit`, `unitShort`, `decimals`, `direction` (`higher`/`lower`/`neutral`), `scale` | display settings; `scale` fixes the comparison bar range |
| `tier`, `sdg` | report annex tier (kept for reference, not displayed), SDG code |
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

Defined in `config/tags.json`. Tiles show them as icons only; the detail view spells them out.

- **Outdated**: set automatically when the latest value is more than 5 years old.
- **Modelled**: set statically, and also automatically when the source flags a value as estimated or modelled.
- **Survey-based**
- **Infrequent**
- **Low coverage**
- **Substitute**: set automatically when a proxy source is used.
- **Limited comparability**

In comparison mode, the detail view names the country a tag applies to when it applies to only one.

The site also shows:
- **Not updated since…** (red icon): the source failed and the last good value is shown.
- **Comparison caveats** (orange warning icon): the two values come from different sources, or one survey measures income and the other consumption.

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

## Known source issues

The first live run (25 Sep 2026) succeeded for all sources except these, which **Source health** lists with their errors:

- **NHM Biodiversity Intactness:** the file contained none of the configured countries (column or name matching).
- **World Happiness Report data file** (two entries): no data file link found on the page. Life satisfaction still comes from the OWID mirror.
- **World Bank natural capital** (`NW.NCA.PC`): the API rejects the request parameters.
- **UCDP:** disabled until the `UCDP_TOKEN` secret is set.

Each is likely a one-line config or adapter change.

## Maintenance notes

- **Scheduled workflows** are paused by GitHub after 60 days without repository activity. The daily status commit counts as activity. If the job is ever paused, re-enable it in the Actions tab.
- **Fonts and privacy:** Roboto (the report's typeface) comes from the `@fontsource/roboto` package (SIL Open Font License) and is bundled into the site at build time. The page makes no requests to Google or any other third party, so no visitor IP addresses are passed on. It sets no cookies and uses `localStorage` only to remember the theme and pinned indicators.
- **Colours:** the four components colour tile titles pink, orange, purple and teal. The two country colours (blue, indigo) are kept apart from those and were validated for colour-blind separation in both themes. Yellow, green and red are reserved for "older year", "better" and "source failing". All text meets 4.5:1 contrast on the tiles in both themes.
- **One comparable basis for all countries:** income and premature mortality use the same global series for every country, including Germany and the US, rather than the OECD's measures where they exist. This is deliberate so the six countries can be compared directly.
- **Run time:** sources are fetched 8 at a time (at most 6 parallel requests per host). Each source has an 8-minute budget and the whole fetch 22 minutes; a source that runs over counts as failed for that day and keeps its last good values, so the job always saves. The log lists every source with its duration.
- **Adapters:** most sources publish yearly, so on most days nothing changes.

## Licence and attribution

Code: choose a licence (e.g. MIT). Data remain the property of their publishers (World Bank, UN DESA/UNSD, ILO, WHO, UCDP, Our World in Data (CC BY), World Happiness Report, Natural History Museum London). This is an independent prototype, not affiliated with the United Nations.
