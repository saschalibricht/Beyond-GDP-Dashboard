// App state: loaded data plus the reader's choices (countries, pins, view, theme).
// Choices are mirrored to the URL so any view can be shared as a link.
import type { Dashboard, Entry, Indicator, Pillar, Registry, Status, Tag } from "./types";

export type Theme = "light" | "dark" | "system";
export type Sheet = "legend" | "about" | "health" | null;

const PIN_KEY = "bgdp-pins";
const THEME_KEY = "bgdp-theme";

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
  reg = $state<Registry | null>(null);
  dash = $state<Dashboard | null>(null);
  status = $state<Status | null>(null);
  phase = $state<"loading" | "ready" | "failed">("loading");

  a = $state("");
  b = $state<string | null>(null);
  view = $state<"all" | "pinned">("all");
  pins = $state<string[]>([]);
  detail = $state<string | null>(null);
  sheet = $state<Sheet>(null);
  theme = $state<Theme>("system");

  readonly thisYear = new Date().getFullYear();

  ind = $derived(new Map<string, Indicator>((this.reg?.indicators ?? []).map((i) => [i.id, i])));
  pillar = $derived(new Map<string, Pillar>((this.reg?.framework.pillars ?? []).map((p) => [p.id, p])));
  tag = $derived(new Map<string, Tag>((this.reg?.tags ?? []).map((t) => [t.id, t])));
  country = $derived(new Map((this.reg?.countries ?? []).map((c) => [c.iso3, c])));
  hasData = $derived(!!this.dash?.values && Object.keys(this.dash.values).length > 0);

  async init(): Promise<void> {
    const t = readStore(THEME_KEY);
    this.theme = t === "light" || t === "dark" ? t : "system";
    try {
      this.reg = await load<Registry>("data/registry.json");
    } catch {
      this.phase = "failed";
      return;
    }
    const [dash, status] = await Promise.all([
      load<Dashboard>("data/dashboard.json").catch(() => null),
      load<Status>("data/status.json").catch(() => null),
    ]);
    this.dash = dash;
    this.status = status;
    this.readUrl();
    this.phase = "ready";
  }

  private readUrl(): void {
    const reg = this.reg!;
    const q = new URLSearchParams(location.search);
    const valid = (c: string | null | undefined) => {
      const iso = c?.toUpperCase();
      return iso && this.country.has(iso) ? iso : null;
    };
    this.a = valid(q.get("c")) ?? valid(reg.defaultCountry) ?? reg.countries[0]?.iso3 ?? "";
    const vs = q.get("vs");
    this.b = vs === "none" ? null : (valid(vs) ?? (q.has("c") ? null : valid(reg.defaultCompare)));
    if (this.b === this.a) this.b = null;
    this.view = q.get("view") === "pinned" ? "pinned" : "all";
    const pins = q.get("pins") ?? readStore(PIN_KEY) ?? "";
    this.pins = pins.split(",").filter((id) => this.ind.has(id));
    const d = q.get("i");
    this.detail = d && this.ind.has(d) ? d : null;
  }

  /** Mirror choices to the URL and local storage; called from an effect. */
  persist(): void {
    if (this.phase !== "ready") return;
    const q = new URLSearchParams();
    q.set("c", this.a);
    q.set("vs", this.b ?? "none");
    if (this.pins.length) q.set("pins", this.pins.join(","));
    if (this.view === "pinned") q.set("view", "pinned");
    if (this.detail) q.set("i", this.detail);
    history.replaceState(null, "", `${location.pathname}?${q}`);
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

  togglePin(id: string): void {
    this.pins = this.pins.includes(id) ? this.pins.filter((p) => p !== id) : [...this.pins, id];
  }

  entry(id: string, iso3: string | null): Entry | null {
    if (!iso3) return null;
    return this.dash?.values?.[id]?.[iso3] ?? null;
  }

  cname(iso3: string): string {
    return this.country.get(iso3)?.name ?? iso3;
  }
}

export const app = new AppState();
