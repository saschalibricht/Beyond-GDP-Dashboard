import { describe, expect, it } from "vitest";
import { fmt } from "./format";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { barScale, compare, entryTags, flagsFor, isOutdated, missingInfo, niceTicks, type Texts } from "./logic";

const L: Texts = { m: en, date: (iso) => iso, note: (s) => s };
import type { Entry, Indicator, Registry } from "./types";

const ind = (over: Partial<Indicator> = {}): Indicator => ({
  id: "x",
  pillar: "current",
  domain: "health",
  name: "X",
  label: "X",
  explanation: "",
  unit: "%",
  decimals: 1,
  direction: "higher",
  tier: "I",
  limitations: "",
  sources: [{ label: "S0" }, { label: "S1", proxy: true }],
  tags: ["survey"],
  ...over,
});

const ok = (year: number, value: number, over: Partial<Entry> = {}): Entry => ({
  status: "ok",
  src: 0,
  proxy: false,
  latest: { year, value },
  series: [[year, value]],
  ...over,
});

const reg = {
  outdatedAfterYears: 5,
  tags: [
    { id: "outdated", label: "Outdated", icon: "clock", short: "", long: "" },
    { id: "survey", label: "Survey-based", icon: "survey", short: "", long: "" },
    { id: "substitute", label: "Substitute", icon: "swap", short: "", long: "" },
  ],
} as unknown as Registry;

describe("outdated", () => {
  it("flags values more than five years old only", () => {
    expect(isOutdated(2020, 2026, 5)).toBe(true);
    expect(isOutdated(2021, 2026, 5)).toBe(false);
  });

  it("recomputes the pipeline's outdated tag from the year", () => {
    const e = ok(2022, 1, { tags: ["outdated", "survey"] });
    expect(entryTags(ind(), e, 2026, 5)).toEqual(["survey"]);
    expect(entryTags(ind(), ok(2019, 1, { tags: ["survey"] }), 2026, 5)).toEqual(["outdated", "survey"]);
  });
});

describe("compare", () => {
  it("marks the better country by direction", () => {
    expect(compare(ind(), ok(2022, 5), ok(2022, 3)).better).toBe("a");
    expect(compare(ind({ direction: "lower" }), ok(2022, 5), ok(2022, 3)).better).toBe("b");
  });

  it("never ranks neutral indicators, ties or different sources", () => {
    expect(compare(ind({ direction: "neutral" }), ok(2022, 5), ok(2022, 3)).better).toBeNull();
    expect(compare(ind(), ok(2022, 3), ok(2022, 3)).better).toBeNull();
    const c = compare(ind(), ok(2022, 5), ok(2022, 3, { src: 1, proxy: true }));
    expect(c.better).toBeNull();
    expect(c.sameSource).toBe(false);
  });

  it("names the older year", () => {
    expect(compare(ind(), ok(2018, 1), ok(2022, 1)).older).toBe("a");
    expect(compare(ind(), ok(2022, 1), ok(2021, 1)).older).toBe("b");
    expect(compare(ind(), ok(2022, 1), ok(2022, 2)).older).toBeNull();
  });

  it("ignores missing values", () => {
    expect(compare(ind(), ok(2022, 1), { status: "no_data" })).toMatchObject({ better: null, older: null });
  });
});

describe("flags", () => {
  it("unions tags in registry order and notes which country they apply to", () => {
    const f = flagsFor(
      reg,
      ind(),
      [
        { iso3: "DEU", entry: ok(2018, 1, { tags: ["survey"] }) },
        { iso3: "BRA", entry: ok(2023, 1, { tags: ["survey"] }) },
      ],
      2026,
      L,
    );
    expect(f.map((x) => x.id)).toEqual(["outdated", "survey"]);
    expect(f[0]).toMatchObject({ only: ["DEU"], tone: "warn" });
    expect(f[1]?.only).toBeUndefined();
  });

  it("adds stale, different-source and income/consumption warnings", () => {
    const f = flagsFor(
      reg,
      ind({ tags: [] }),
      [
        { iso3: "DEU", entry: ok(2023, 1, { tags: [], stale: { since: "2026-09-01" }, meta: { welfare: "income" } }) },
        { iso3: "IND", entry: ok(2023, 1, { tags: [], src: 1, proxy: true, meta: { welfare: "consumption" } }) },
      ],
      2026,
      L,
    );
    expect(f.map((x) => x.id)).toEqual(["stale-DEU", "diff-source", "diff-welfare"]);
    expect(f[0]?.label).toBe("Not updated since 2026-09-01");
    const g = flagsFor(reg, ind({ tags: [] }), [{ iso3: "DEU", entry: ok(2023, 1, { tags: [], stale: { since: "x" } }) }], 2026, { ...L, m: de });
    expect(g[0]?.label).toBe("Nicht aktualisiert seit x");
    expect(f[0]?.tone).toBe("error");
  });
});

describe("helpers", () => {
  it("explains missing values", () => {
    expect(missingInfo({ status: "not_applicable", notes: ["Only for developing countries."] }, "Germany", L)).toEqual({
      title: "Not applicable",
      text: "Only for developing countries.",
      kind: "na",
    });
    expect(missingInfo(undefined, "Germany", L).title).toBe("Not fetched yet");
    expect(missingInfo({ status: "no_data" }, "Deutschland", { ...L, m: de }).text).toBe("Die Quelle hat keinen Wert für Deutschland.");
  });

  it("uses the natural scale for bars when there is one", () => {
    expect(barScale(ind({ scale: [0, 100] }), [3, 4])).toEqual([0, 100]);
    expect(barScale(ind(), [10, 20])).toEqual([0, 23]);
  });

  it("makes round ticks", () => {
    expect(niceTicks(0, 97)).toEqual([0, 25, 50, 75, 100]);
  });

  it("keeps tiny values readable", () => {
    expect(fmt(0.0012, 2)).toBe("0.0012");
    expect(fmt(1234.5, 1)).toBe("1,234.5");
    expect(fmt(null)).toBe("–");
  });
});
