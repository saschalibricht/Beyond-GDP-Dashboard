// Pure dashboard rules: what counts as outdated, which country is "better",
// which year is older, and which warning flags a tile carries.
// Kept free of Svelte so it can be unit-tested.
import { fmtDate } from "./format";
import type { Entry, Indicator, OkEntry, Registry } from "./types";

export const isOk = (e: Entry | null | undefined): e is OkEntry =>
  !!e && e.status === "ok" && !!e.latest && typeof e.src === "number";

/** Strictly more than `after` years between the data year and now. */
export const isOutdated = (year: number, thisYear: number, after: number) => thisYear - year > after;

export const isEstimate = (nature: string | undefined) => /^(E|M)$/i.test(nature ?? "");

/**
 * Tags for one country's value. The pipeline also writes an "outdated" tag, but the
 * threshold lives in the registry, so it is recomputed here from the data year.
 */
export function entryTags(ind: Indicator, e: Entry | null | undefined, thisYear: number, after: number): string[] {
  const tags = (e?.tags ?? ind.tags ?? []).filter((t) => t !== "outdated");
  if (isOk(e) && isOutdated(e.latest.year, thisYear, after)) tags.unshift("outdated");
  return tags;
}

export type Side = "a" | "b";

export interface Comparison {
  /** which country does better, if the values can fairly be ranked */
  better: Side | null;
  /** which country's latest value is from an earlier year */
  older: Side | null;
  sameSource: boolean;
  welfareDiffers: boolean;
}

export function compare(ind: Indicator, a: Entry | null | undefined, b: Entry | null | undefined): Comparison {
  const none: Comparison = { better: null, older: null, sameSource: true, welfareDiffers: false };
  if (!isOk(a) || !isOk(b)) return none;
  const sameSource = a.src === b.src && !!a.proxy === !!b.proxy;
  const wa = a.meta?.welfare;
  const wb = b.meta?.welfare;
  const welfareDiffers = !!wa && !!wb && wa !== wb;
  const ya = a.latest.year;
  const yb = b.latest.year;
  const older: Side | null = ya === yb ? null : ya < yb ? "a" : "b";
  let better: Side | null = null;
  const va = a.latest.value;
  const vb = b.latest.value;
  // no ranking across different sources or for indicators without a "good" direction
  if (sameSource && ind.direction !== "neutral" && va !== vb) {
    const aWins = ind.direction === "higher" ? va > vb : va < vb;
    better = aWins ? "a" : "b";
  }
  return { better, older, sameSource, welfareDiffers };
}

export type Tone = "muted" | "warn" | "error";

export interface Flag {
  id: string;
  icon: string;
  label: string;
  /** one-line text for the tile's tooltip */
  short: string;
  /** full explanation for the detail view */
  long: string;
  tone: Tone;
  /** countries the flag applies to, when comparing and it applies to only some */
  only?: string[];
}

const TONE: Record<string, Tone> = { outdated: "warn" };

/**
 * Every warning a tile shows as an icon (and the detail view spells out):
 * limitation tags, stale sources and comparison caveats.
 */
export function flagsFor(
  reg: Registry,
  ind: Indicator,
  countries: { iso3: string; entry: Entry | null | undefined }[],
  thisYear: number,
): Flag[] {
  const after = reg.outdatedAfterYears;
  const sets = countries.map((c) => new Set(entryTags(ind, c.entry, thisYear, after)));
  const flags: Flag[] = [];
  for (const t of reg.tags) {
    const has = countries.filter((_, i) => sets[i]?.has(t.id)).map((c) => c.iso3);
    if (!has.length) continue;
    flags.push({
      id: t.id,
      icon: t.icon,
      label: t.label,
      short: t.short,
      long: t.long,
      tone: TONE[t.id] ?? "muted",
      only: has.length < countries.length ? has : undefined,
    });
  }
  for (const c of countries) {
    const s = c.entry?.stale;
    if (!s) continue;
    flags.push({
      id: `stale-${c.iso3}`,
      icon: "stale",
      label: `Not updated since ${fmtDate(s.since)}`,
      short: "The source could not be reached; showing the last value retrieved.",
      long: `The source could not be reached in the latest daily check, so the last value retrieved is shown. It is retried every day.${s.reason ? ` Error: ${s.reason}` : ""}`,
      tone: "error",
      only: countries.length > 1 ? [c.iso3] : undefined,
    });
  }
  if (countries.length === 2) {
    const [a, b] = countries as [(typeof countries)[0], (typeof countries)[0]];
    const cmp = compare(ind, a.entry, b.entry);
    if (!cmp.sameSource) {
      flags.push({
        id: "diff-source",
        icon: "warn",
        label: "Different sources",
        short: "The two values come from different sources.",
        long: "The two countries' values come from different sources or methods, so the gap between them may partly reflect how they were measured. No “better” label is shown.",
        tone: "warn",
      });
    }
    if (cmp.welfareDiffers) {
      flags.push({
        id: "diff-welfare",
        icon: "warn",
        label: "Income vs consumption",
        short: "One survey measures income, the other consumption.",
        long: `${a.iso3} measures ${a.entry?.meta?.welfare}, ${b.iso3} measures ${b.entry?.meta?.welfare}. Consumption surveys usually show lower inequality and different levels than income surveys.`,
        tone: "warn",
      });
    }
  }
  return flags;
}

export interface MissingInfo {
  title: string;
  text: string;
  kind: "none" | "na" | "err";
}

export function missingInfo(e: Entry | null | undefined, countryName: string): MissingInfo {
  const note = e?.notes?.[0];
  switch (e?.status) {
    case "no_data":
      return { title: "No data", text: note || `The source has no value for ${countryName}.`, kind: "none" };
    case "not_applicable":
      return { title: "Not applicable", text: note || "Not computed for this country.", kind: "na" };
    case "source_error":
      return {
        title: "Source unavailable",
        text: "The data source could not be reached and no earlier value is stored. It is retried daily.",
        kind: "err",
      };
    default:
      return {
        title: "Not fetched yet",
        text: "This country was added recently; values appear after the next data update.",
        kind: "none",
      };
  }
}

/** Shared bar scale for the compare rows: the indicator's natural range, else 0..max. */
export function barScale(ind: Indicator, values: number[]): [number, number] {
  if (ind.scale) return ind.scale;
  const max = Math.max(0, ...values.map(Math.abs));
  return [Math.min(0, ...values), max * 1.15 || 1];
}

export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const step0 = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}
