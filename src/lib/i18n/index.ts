// Languages: interface text comes from typed catalogs (en.ts, de.ts); content texts
// (indicators, sections, caveats) from the registry's i18n overlay written by the ETL
// from config/i18n/<lang>.json; country names, numbers and dates from the browser's Intl.
import type { Country, Indicator, Registry } from "../types";
import { de } from "./de";
import { en, type Messages } from "./en";

export type { Messages };
export type Lang = "en" | "de";
export const LANGS: readonly Lang[] = ["en", "de"];
export const MESSAGES: Record<Lang, Messages> = { en, de };
/** BCP 47 tags for Intl: numbers like 1,234.5 / 1.234,5 */
export const LOCALE: Record<Lang, string> = { en: "en-US", de: "de-DE" };

export const isLang = (v: unknown): v is Lang => v === "en" || v === "de";

/** First visit: the browser's preferred languages decide; English otherwise. */
export function detectLang(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

type Overlay = Record<string, Record<string, unknown>>;
interface ContentOverlay {
  framework?: {
    report?: Record<string, string>;
    pillars?: Overlay;
    domains?: Overlay;
    notIncluded?: { name: string; text: string }[];
  };
  tags?: Overlay;
  indicators?: Record<string, Record<string, unknown> & { proxyNotes?: Record<string, string> }>;
}

const pick = <T extends object>(base: T, over: Record<string, unknown> | undefined): T => {
  if (!over) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    if (typeof v === "string" && v && k in base) out[k] = v;
  }
  return out as T;
};

function countryNamer(lang: Lang): (c: Country) => string {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([LOCALE[lang]], { type: "region", fallback: "none" });
  } catch {
    names = null;
  }
  return (c) => {
    if (lang === "en" || !c.iso2 || !names) return c.name;
    try {
      return names.of(c.iso2) ?? c.name;
    } catch {
      return c.name;
    }
  };
}

/** The registry with every text in the chosen language; English wherever a translation is missing. */
export function localizeRegistry(raw: Registry, lang: Lang): Registry {
  const name = countryNamer(lang);
  const collator = new Intl.Collator(LOCALE[lang]);
  const countries = raw.countries.map((c) => ({ ...c, name: name(c) })).sort((x, y) => collator.compare(x.name, y.name));
  const o = raw.i18n?.[lang] as ContentOverlay | undefined;
  if (lang === "en" || !o) return { ...raw, countries };
  const fw = o.framework ?? {};
  return {
    ...raw,
    countries,
    framework: {
      ...raw.framework,
      report: pick(raw.framework.report, fw.report),
      pillars: raw.framework.pillars.map((p) => ({
        ...pick(p, fw.pillars?.[p.id]),
        domains: p.domains.map((d) => pick(d, fw.domains?.[d.id])),
      })),
      notIncluded: raw.framework.notIncluded.map((n, i) => pick(n, fw.notIncluded?.[i])),
    },
    tags: raw.tags.map((t) => pick(t, o.tags?.[t.id])),
    indicators: raw.indicators.map((ind) => {
      const tr = o.indicators?.[ind.id];
      const proxy = tr?.proxyNotes ?? {};
      return {
        ...pick(ind, tr),
        sources: ind.sources.map((s) => (s.proxyNote && proxy[s.proxyNote] ? { ...s, proxyNote: proxy[s.proxyNote] } : s)),
      };
    }),
  };
}

/**
 * The ETL writes notes as English sentences from a small set of templates. They are
 * recognised here and re-rendered in the chosen language; anything unrecognised
 * (e.g. technical error messages) is shown as written.
 */
export function translateNote(note: string, lang: Lang, raw: Registry, rawInd: Indicator | undefined, m: Messages, fmt: (v: number, d: number) => string): string {
  if (lang === "en") return note;
  const tr = (raw.i18n?.[lang] as ContentOverlay | undefined)?.indicators?.[rawInd?.id ?? ""];
  if (rawInd) {
    for (const k of ["naNote", "unavailableNote"] as const) {
      if (rawInd[k] && note === rawInd[k] && typeof tr?.[k] === "string") return tr[k] as string;
    }
  }
  let r: RegExpMatchArray | null;
  if ((r = note.match(/^Substitute: (.*)\.$/))) {
    const t = tr?.proxyNotes?.[r[1]!];
    return t ? m.notes.substitute(t) : note;
  }
  if ((r = note.match(/^Breakdown shown: (.+) = (.+)\.$/))) return m.notes.breakdown(r[1]!, r[2]!);
  if ((r = note.match(/^Survey measures (.+)\.$/))) {
    const words = r[1]!.split(" and ").map((w) => m.flags.welfare[w] ?? w);
    return m.notes.survey(words.join(` ${m.notes.and} `));
  }
  if (note === "Converted to a rate per 100,000 people using World Bank population data.") return m.notes.per100k;
  if ((r = note.match(/^Calculated as the (average of|ratio of) (.+) values \((.+)\)\.$/))) {
    const op = r[1] === "average of" ? m.notes.ops.average : m.notes.ops.ratio;
    return m.notes.calculated(op ?? r[1]!, r[2]!.replace(" and ", ` ${m.notes.and} `), r[3]!);
  }
  if ((r = note.match(/^Poverty line fixed at \$([\d.]+) per person per day \(2021 PPP\), the societal line in (\d{4})\.$/))) {
    return m.notes.povertyLine(fmt(Number(r[1]), 2), r[2]!);
  }
  if (note === "Several national sources exist; the one with the longest series is shown.") return m.notes.longest;
  if ((r = note.match(/^(\d+) value\(s\) outside the plausible range were excluded\.$/))) return m.notes.implausible(r[1]!);
  if (note === "The primary source had no data; an alternative source for the same measure is used.") return m.notes.alternative;
  return note;
}
