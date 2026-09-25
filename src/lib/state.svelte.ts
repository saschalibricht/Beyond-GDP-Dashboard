// App state: loaded data plus the reader's choices (countries, pins, view, theme, language).
// Choices are mirrored to the URL so any view can be shared as a link.
import { SvelteMap } from "svelte/reactivity";
import { fmt, fmtAxis, fmtDate } from "./format";
import { detectLang, isLang, LOCALE, localizeRegistry, MESSAGES, translateNote, type Lang } from "./i18n";
import type { Texts } from "./logic";
import type { CountryValues, Entry, Indicator, Manifest, Pillar, Registry, Status, Tag } from "./types";

export type Theme = "light" | "dark" | "system";
export type Sheet = "help" | "health" | null;
/** what tiles show: the latest values, or the values over time */
export type Show = "latest" | "trend";
const SHOW_DEFAULT = { single: "trend", compare: "latest" } as const;

const PIN_KEY = "bgdp-pins";
const THEME_KEY = "bgdp-theme";
const LANG_KEY = "bgdp-lang";

/** URL first (shared links), then the reader's last choice, then the browser's languages. */
function initialLang(): Lang {
  const q = new URLSearchParams(location.search).get("lang");
  if (isLang(q)) return q;
  const stored = readStore(LANG_KEY);
  if (isLang(stored)) return stored;
  return detectLang(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private mode or blocked storage
  }
}

function writeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

async function load<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

class AppState {
  /** the registry as published (English), and localized for the chosen language */
  raw = $state<Registry | null>(null);
  lang = $state<Lang>("en");
  reg = $derived(this.raw ? localizeRegistry(this.raw, this.lang) : null);
  t = $derived(MESSAGES[this.lang]);
  locale = $derived(LOCALE[this.lang]);
  rawInd = $derived(new Map<string, Indicator>((this.raw?.indicators ?? []).map((i) => [i.id, i])));
  manifest = $state<Manifest | null>(null);
  /** per-country values, fetched when a country is first shown */
  values = new SvelteMap<string, CountryValues | "failed">();
  status = $state<Status | null>(null);
  phase = $state<"loading" | "ready" | "failed">("loading");

  /** the reader's selection */
  a = $state("");
  b = $state<string | null>(null);
  /** what the tiles show: follows a/b once their values have loaded, so tiles never flash empty */
  viewA = $state("");
  viewB = $state<string | null>(null);
  view = $state<"all" | "pinned">("all");
  /** per view, so one country and a comparison each keep their own choice */
  show = $state<{ single: Show; compare: Show }>({ ...SHOW_DEFAULT });
  /** the choice for what is on screen */
  mode: Show = $derived(this.viewB ? this.show.compare : this.show.single);
  pins = $state<string[]>([]);
  detail = $state<string | null>(null);
  sheet = $state<Sheet>(null);
  theme = $state<Theme>("system");

  readonly thisYear = new Date().getFullYear();

  ind = $derived(new Map<string, Indicator>((this.reg?.indicators ?? []).map((i) => [i.id, i])));
  pillar = $derived(new Map<string, Pillar>((this.reg?.framework.pillars ?? []).map((p) => [p.id, p])));
  tag = $derived(new Map<string, Tag>((this.reg?.tags ?? []).map((t) => [t.id, t])));
  country = $derived(new Map((this.reg?.countries ?? []).map((c) => [c.iso3, c])));
  /** countries with data, A–Z by name */
  countries = $derived(
    (this.reg?.countries ?? [])
      .filter((c) => !this.manifest || this.manifest.countries.includes(c.iso3))
      .sort((x, y) => x.name.localeCompare(y.name)),
  );
  hasData = $derived((this.manifest?.countries.length ?? 0) > 0);
  /** true while a shown country's values are still loading */
  pending = $derived([this.a, this.b].some((c) => !!c && !this.values.has(c)));

  /** numbers and dates in the chosen language */
  fmt = (v: number | null | undefined, d = 1) => fmt(v, d, this.locale);
  fmtAxis = (v: number, d = 1) => fmtAxis(v, d, this.locale);
  fmtDate = (iso: string | null | undefined) => fmtDate(iso, this.lang === "en" ? "en-GB" : this.locale, this.t.footer.never);

  /** a pipeline note in the chosen language */
  note(indId: string, text: string): string {
    return this.raw ? translateNote(text, this.lang, this.raw, this.rawInd.get(indId), this.t, this.fmt) : text;
  }

  /** texts the pure rules in logic.ts need, for one indicator */
  texts(indId: string): Texts {
    return { m: this.t, date: (iso) => this.fmtDate(iso), note: (s) => this.note(indId, s) };
  }

  setLang(l: Lang): void {
    this.lang = l;
    writeStore(LANG_KEY, l);
  }

  async init(): Promise<void> {
    this.lang = initialLang();
    const t = readStore(THEME_KEY);
    this.theme = t === "light" || t === "dark" ? t : "system";
    try {
      this.raw = await load<Registry>("data/registry.json");
    } catch {
      this.phase = "failed";
      return;
    }
    const [manifest, status] = await Promise.all([
      load<Manifest>("data/dashboard.json").catch(() => null),
      load<Status>("data/status.json").catch(() => null),
    ]);
    this.manifest = manifest && Array.isArray(manifest.countries) ? manifest : { countries: [] };
    this.status = status;
    this.readUrl();
    this.phase = "ready";
  }

  /** Fetch a country's values once; called from an effect whenever a or b changes. */
  async ensureValues(iso3: string | null): Promise<void> {
    if (!iso3 || this.values.has(iso3) || this.loading.has(iso3)) return;
    this.loading.add(iso3);
    try {
      this.values.set(iso3, await load<CountryValues>(`data/values/${iso3}.json`));
    } catch {
      this.values.set(iso3, "failed");
    } finally {
      this.loading.delete(iso3);
    }
  }

  private loading = new Set<string>();

  private readUrl(): void {
    const reg = this.raw!;
    const q = new URLSearchParams(location.search);
    const shown = new Set(this.countries.map((c) => c.iso3));
    const valid = (c: string | null | undefined) => {
      const iso = c?.toUpperCase();
      return iso && shown.has(iso) ? iso : null;
    };
    this.a = valid(q.get("c")) ?? valid(reg.defaultCountry) ?? this.countries[0]?.iso3 ?? "";
    const vs = q.get("vs");
    this.b = vs === "none" ? null : (valid(vs) ?? (q.has("c") ? null : valid(reg.defaultCompare)));
    if (this.b === this.a) this.b = null;
    this.view = q.get("view") === "pinned" ? "pinned" : "all";
    const s = q.get("show");
    if (s === "latest" || s === "trend") this.show[this.b ? "compare" : "single"] = s;
    const pins = q.get("pins") ?? readStore(PIN_KEY) ?? "";
    this.pins = pins.split(",").filter((id) => this.ind.has(id));
    const d = q.get("i");
    this.detail = d && this.ind.has(d) ? d : null;
  }

  /** Mirror choices to the URL and local storage; called from an effect. */
  persist(): void {
    if (this.phase !== "ready") return;
    const q = new URLSearchParams();
    q.set("lang", this.lang); // shared links open in the same language
    q.set("c", this.a);
    q.set("vs", this.b ?? "none");
    if (this.pins.length) q.set("pins", this.pins.join(","));
    if (this.view === "pinned") q.set("view", "pinned");
    const which = this.b ? "compare" : "single";
    if (this.show[which] !== SHOW_DEFAULT[which]) q.set("show", this.show[which]);
    if (this.detail) q.set("i", this.detail);
    history.replaceState(history.state, "", `${location.pathname}?${q}`); // keep the sheet marker
    writeStore(PIN_KEY, this.pins.join(","));
  }

  setTheme(t: Theme): void {
    this.theme = t;
    writeStore(THEME_KEY, t);
  }

  setA(iso: string): void {
    this.a = iso;
    if (this.b === iso) this.b = null;
  }

  setB(iso: string | null): void {
    this.b = iso && iso !== this.a ? iso : null;
  }

  swap(): void {
    if (!this.b) return;
    [this.a, this.b] = [this.b, this.a];
  }

  setShow(s: Show): void {
    this.show[this.b ? "compare" : "single"] = s;
  }

  togglePin(id: string): void {
    this.pins = this.pins.includes(id) ? this.pins.filter((p) => p !== id) : [...this.pins, id];
  }

  entry(id: string, iso3: string | null): Entry | null {
    if (!iso3) return null;
    const v = this.values.get(iso3);
    if (v === "failed") return { status: "source_error" };
    return v?.[id] ?? null;
  }

  cname(iso3: string): string {
    return this.country.get(iso3)?.name ?? iso3;
  }
}

export const app = new AppState();
