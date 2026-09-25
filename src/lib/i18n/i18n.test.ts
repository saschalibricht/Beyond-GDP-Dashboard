import { describe, expect, it } from "vitest";
import { fmt, fmtDate } from "../format";
import type { Indicator, Registry } from "../types";
import { de } from "./de";
import { detectLang, localizeRegistry, translateNote } from "./index";

const ind = {
  id: "mpi",
  pillar: "equity",
  domain: "overlapping",
  name: "Multidimensional poverty index",
  label: "Multidimensional poverty",
  explanation: "E",
  unit: "% of population",
  decimals: 1,
  direction: "lower",
  tier: "I",
  limitations: "L",
  naNote: "The global MPI is computed for low- and middle-income countries only.",
  sources: [{ label: "OWID", proxy: true, proxyNote: "MPI headcount ratio instead of the index value" }],
} as Indicator;

const raw = {
  framework: {
    report: { title: "Counting What Counts", publisher: "UN HLEG", year: 2026, url: "x" },
    pillars: [{ id: "equity", name: "Equity and inclusion", summary: "S", justification: "J", ref: "R", domains: [{ id: "overlapping", name: "Overlapping deprivations", why: "W" }] }],
    notIncluded: [],
  },
  tags: [{ id: "survey", label: "Survey-based", icon: "survey", short: "s", long: "l" }],
  indicators: [ind],
  countries: [
    { iso3: "DEU", iso2: "DE", name: "Germany" },
    { iso3: "USA", iso2: "US", name: "United States" },
    { iso3: "CHI", iso2: null, name: "Channel Islands" },
  ],
  outdatedAfterYears: 5,
  i18n: {
    de: {
      framework: { pillars: { equity: { name: "Gerechtigkeit und Teilhabe" } }, domains: { overlapping: { name: "Mehrfache Benachteiligung" } } },
      tags: { survey: { label: "Umfragebasiert" } },
      indicators: {
        mpi: {
          label: "Mehrdimensionale Armut",
          naNote: "Der globale MPI wird nur für Länder mit niedrigem und mittlerem Einkommen berechnet.",
          proxyNotes: { "MPI headcount ratio instead of the index value": "MPI-Quote statt des Indexwerts" },
        },
      },
    },
  },
} as unknown as Registry;

const f = (v: number, d: number) => fmt(v, d, "de-DE");

describe("language detection", () => {
  it("uses the first supported browser language", () => {
    expect(detectLang(["de-AT", "en"])).toBe("de");
    expect(detectLang(["fr-FR", "en-GB"])).toBe("en");
    expect(detectLang(["fr"])).toBe("en");
  });
});

describe("localized registry", () => {
  const reg = localizeRegistry(raw, "de");

  it("overlays German texts and keeps English where none exists", () => {
    expect(reg.framework.pillars[0]?.name).toBe("Gerechtigkeit und Teilhabe");
    expect(reg.framework.pillars[0]?.summary).toBe("S");
    expect(reg.framework.pillars[0]?.domains[0]?.name).toBe("Mehrfache Benachteiligung");
    expect(reg.tags[0]?.label).toBe("Umfragebasiert");
    expect(reg.indicators[0]?.label).toBe("Mehrdimensionale Armut");
    expect(reg.indicators[0]?.explanation).toBe("E");
    expect(reg.indicators[0]?.sources[0]?.proxyNote).toBe("MPI-Quote statt des Indexwerts");
  });

  it("names and sorts countries in German, falling back to the stored name", () => {
    expect(reg.countries.map((c) => c.name)).toEqual(["Channel Islands", "Deutschland", "Vereinigte Staaten"]);
    expect(localizeRegistry(raw, "en").countries.map((c) => c.name)).toEqual(["Channel Islands", "Germany", "United States"]);
  });

  it("leaves the English registry untouched", () => {
    expect(localizeRegistry(raw, "en").indicators[0]?.label).toBe("Multidimensional poverty");
  });
});

describe("pipeline notes", () => {
  const tn = (s: string) => translateNote(s, "de", raw, ind, de, f);

  it("translates every template the pipeline writes", () => {
    expect(tn("Substitute: MPI headcount ratio instead of the index value.")).toBe("Ersatz: MPI-Quote statt des Indexwerts.");
    expect(tn("Breakdown shown: Location = URBAN.")).toBe("Gezeigte Aufschlüsselung: Location = URBAN.");
    expect(tn("Survey measures consumption and income.")).toBe("Die Erhebung misst Konsum und Einkommen.");
    expect(tn("Converted to a rate per 100,000 people using World Bank population data.")).toBe(de.notes.per100k);
    expect(tn("Calculated as the ratio of female and male values (Sex).")).toBe("Berechnet als Verhältnis der Werte female und male (Sex).");
    expect(tn("Poverty line fixed at $8.25 per person per day (2021 PPP), the societal line in 2017.")).toBe(
      "Armutsgrenze fixiert bei 8,25 $ pro Person und Tag (KKP 2021), der gesellschaftlichen Grenze im Jahr 2017.",
    );
    expect(tn("3 value(s) outside the plausible range were excluded.")).toBe("3 Wert(e) außerhalb des plausiblen Bereichs wurden ausgeschlossen.");
    expect(tn(ind.naNote!)).toBe("Der globale MPI wird nur für Länder mit niedrigem und mittlerem Einkommen berechnet.");
  });

  it("keeps unknown notes and all English notes as written", () => {
    expect(tn("World Bank API: AdapterError: HTTP 500")).toBe("World Bank API: AdapterError: HTTP 500");
    expect(translateNote("Breakdown shown: Sex = FEMALE.", "en", raw, ind, de, f)).toBe("Breakdown shown: Sex = FEMALE.");
  });
});

describe("formats", () => {
  it("uses German number and date formats", () => {
    expect(fmt(1234.5, 1, "de-DE")).toBe("1.234,5");
    expect(fmtDate("2026-09-25T12:00:00Z", "de-DE")).toBe("25. Sept. 2026");
  });
});
