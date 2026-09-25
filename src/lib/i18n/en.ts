// English interface text: the source catalog. de.ts must provide exactly the same keys
// (enforced by the Messages type), so a missing German string fails the type check.

export const en = {
  meta: {
    title: "Beyond GDP dashboard",
    description:
      "The indicators proposed by the UN High-Level Expert Group on Beyond GDP, with open data and their limitations.",
  },
  header: {
    tagline: "The UN expert group's proposed indicators, filled with open data",
    help: "How to read · About",
    language: "Language",
  },
  theme: {
    group: "Colour theme",
    light: "Light theme",
    dark: "Dark theme",
    system: "Follow system theme",
  },
  controls: {
    country: "Country",
    compare: "Compare",
    compareWith: "Compare with",
    addCountry: "Add country",
    noComparison: "No comparison",
    removeComparison: "Remove comparison",
    swap: "Swap countries",
    vs: "vs",
    showGroup: "Show in tiles",
    latest: "Latest",
    latestTitle: "Latest values",
    trend: "Trend",
    trendTitle: "Values over time",
    pinned: "Pinned",
    showAll: "Show all indicators",
    showPinned: "Show pinned indicators only",
    pinnedOnly: (n: number) => `Pinned only, ${n} pinned`,
  },
  app: {
    skip: "Skip to indicators",
    loadFailedTitle: "The dashboard could not load its configuration",
    loadFailed:
      "The file data/registry.json is missing. Run the data update once (GitHub → Actions → Update data → Run workflow) or python -m etl.build locally.",
    noDataTitle: "No data yet",
    noData:
      "The data update runs automatically every day. To fetch data now, open the repository on GitHub, go to Actions → Update data and choose Run workflow. The site updates by itself once the run has finished.",
    demo: "Demo data. These values are random placeholders for previewing the layout. Run the data update to replace them with real figures.",
    noPinsTitle: "No pinned indicators yet",
    noPins: "Use the pin on any tile to collect the indicators you care about, then switch to this view again.",
  },
  tile: {
    pin: "Pin",
    unpin: "Unpin",
    caveats: "Caveats",
    doesBetter: "Does better",
    olderData: "Older data than the other country",
    onlyYear: (y: number) => `${y} · only year`,
  },
  direction: {
    higher: "Higher is better",
    lower: "Lower is better",
    neutral: "Neither higher nor lower is simply better",
  },
  missing: {
    noData: "No data",
    noDataText: (country: string) => `The source has no value for ${country}.`,
    na: "Not applicable",
    naText: "Not computed for this country.",
    error: "Source unavailable",
    errorText: "The data source could not be reached and no earlier value is stored. It is retried daily.",
    pending: "Not fetched yet",
    pendingText: "This country was added recently; values appear after the next data update.",
  },
  flags: {
    staleLabel: (date: string) => `Not updated since ${date}`,
    staleShort: "The source could not be reached; showing the last value retrieved.",
    staleLong: "The source could not be reached in the latest daily check, so the last value retrieved is shown. It is retried every day.",
    staleError: (reason: string) => ` Error: ${reason}`,
    diffSourceLabel: "Different sources",
    diffSourceShort: "The two values come from different sources.",
    diffSourceLong:
      "The two countries' values come from different sources or methods, so the gap between them may partly reflect how they were measured. No “better” marker is shown.",
    welfareLabel: "Income vs consumption",
    welfareShort: "One survey measures income, the other consumption.",
    welfareLong: (a: string, wa: string, b: string, wb: string) =>
      `${a} measures ${wa}, ${b} measures ${wb}. Consumption surveys usually show lower inequality and different levels than income surveys.`,
    welfare: { income: "income", consumption: "consumption" } as Record<string, string>,
  },
  detail: {
    reportIndicator: (sdg: string | undefined) => (sdg ? `Report indicator (SDG ${sdg})` : "Report indicator"),
    olderData: "older data",
    estimate: "estimate",
    range: "Range",
    source: "Source",
    chain: "Sources checked in order, the first with data is used:",
    substitute: "substitute",
    compareHint: "The green marker is left out when the two values come from different sources; a yellow year is the older of the two.",
    caveats: "Caveats",
    limitations: "Limitations",
    context: "Context",
    reportRef: (ref: string) => `(Report: Table 1 and Annex; ${ref})`,
    close: "Close",
  },
  chart: {
    label: (name: string) => `${name} over time. Use the left and right arrow keys to read values by year.`,
    empty: "No time series available.",
    estimate: "estimate",
    hollow: "Hollow points are estimates",
    table: "Data table",
    year: "Year",
    noValue: "no value",
  },
  footer: {
    checked: (last: string, changed: string) => `Checked daily. Last check ${last}, data last changed ${changed}.`,
    working: (ok: number, total: number) => `${ok} of ${total} sources working`,
    health: "Source health",
    disclaimer:
      "Independent prototype based on the UN High-Level Expert Group on Beyond GDP report (2026). Not affiliated with the United Nations. Data belong to their respective publishers.",
    never: "never",
  },
  health: {
    title: "Source health",
    intro: (last: string, changed: string) =>
      `Last check: ${last}. Data last changed: ${changed}. A failing source keeps its last good values on the dashboard; after three failed days an alert is raised automatically.`,
    ok: "Working",
    error: "Failing",
    disabled: "Not configured",
    optional: "optional",
    lastSuccess: (date: string) => `last success ${date}`,
    none: "No status available yet.",
  },
  help: {
    title: "How to read · About",
    intro: (title: string, year: number, publisher: string) =>
      [`This dashboard shows the indicators proposed in `, title, `, the ${year} report of the ${publisher}. The report asks countries to measure progress as equitable, inclusive and sustainable well-being, complementing rather than replacing GDP. This is an independent prototype built only from openly available data, not produced or endorsed by the United Nations.`] as const,
    tileTitle: "Reading a tile",
    tile: "Each tile is one indicator, titled in the colour of its component. It shows the latest value and the year it refers to. The Latest / Trend switch next to the compare selector chooses between the latest values and the values over time. Select a tile for the explanation, caveats, full time series and sources. Pin tiles to build your own set.",
    compareTitle: "Comparing two countries",
    compare1: "Pick a second country under Compare; remove it with the × button.",
    compare2: "The first country is always blue, the comparison country indigo. Bars share one scale, so their lengths compare directly.",
    compare3: "A green background marks the country that does better, following the indicator's direction. It is left out when the two values come from different sources.",
    compare4: "A bold yellow year is older than the other country's year.",
    rail: "The green bar beside a graph marks the better end: top when higher is better, bottom when lower is better.",
    caveatsTitle: "Caveat icons",
    caveats: "Tiles show caveats as icons; the detail view spells them out. They describe the data, not the country.",
    staleTitle: "Not updated",
    stale: "The source could not be reached in the latest daily check. The last value retrieved is shown until it works again.",
    cmpTitle: "Comparison caveat",
    cmp: "The two values come from different sources, or one survey measures income and the other consumption.",
    missingTitle: "Missing values and years",
    missing: (years: number) =>
      `Nothing is hidden or filled in. A hatched area says why a value is missing: No data (the source does not cover this country), Not applicable (e.g. the global poverty index is not computed for high-income countries) or Source unavailable. Years are the years the data refer to, not when they were published; values more than ${years} years old are marked as outdated.`,
    countriesTitle: "Countries and sources",
    countries:
      "Every country with data for at least five indicators is listed. Where the report's exact indicator is not openly available, the closest open alternative is shown and marked as a substitute; all countries use the same measure, so they stay comparable.",
    notShownTitle: "Deliberately not shown",
    updatesTitle: "Updates and privacy",
    updates1: "An automated job checks every source once a day. If a source fails, the last good value stays visible and is marked. See",
    updatesLink: "source health",
    updates2: "The page loads nothing from third parties (fonts are self-hosted) and sets no cookies; your theme, language and pins stay in your browser.",
    languageNote: "Country names, numbers and dates follow the selected language. Source names and technical error messages stay in English.",
  },
  notes: {
    substitute: (text: string) => `Substitute: ${text}.`,
    breakdown: (dim: string, value: string) => `Breakdown shown: ${dim} = ${value}.`,
    survey: (what: string) => `Survey measures ${what}.`,
    and: "and",
    per100k: "Converted to a rate per 100,000 people using World Bank population data.",
    calculated: (op: string, values: string, dim: string) => `Calculated as the ${op} ${values} values (${dim}).`,
    ops: { average: "average of", ratio: "ratio of" } as Record<string, string>,
    povertyLine: (line: string, base: string) =>
      `Poverty line fixed at $${line} per person per day (2021 PPP), the societal line in ${base}.`,
    longest: "Several national sources exist; the one with the longest series is shown.",
    implausible: (n: string) => `${n} value(s) outside the plausible range were excluded.`,
    alternative: "The primary source had no data; an alternative source for the same measure is used.",
  },
};

type Widen<T> = T extends string
  ? string
  : T extends (...a: infer A) => infer R
    ? (...a: A) => R extends string ? string : R extends readonly unknown[] ? readonly string[] : R
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

export type Messages = Widen<typeof en>;
