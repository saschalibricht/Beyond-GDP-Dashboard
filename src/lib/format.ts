// Number and date formatting in the reader's language (Intl), shared by tiles, charts and sheets.
import type { Messages } from "./i18n";
import type { Direction } from "./types";

const nf = new Map<string, Intl.NumberFormat>();

export function fmt(value: number | null | undefined, decimals = 1, locale = "en-US"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  let d = decimals;
  // avoid "0.00" for tiny non-zero values
  if (value !== 0 && Math.abs(value) < 10 ** -d) d = Math.min(4, d + 2);
  const key = `${locale}|${d}`;
  let f = nf.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
    nf.set(key, f);
  }
  return f.format(value);
}

export function fmtDate(iso: string | null | undefined, locale = "en-GB", never = "never"): string {
  if (!iso) return never;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export const directionText = (dir: Direction, m: Messages): string => m.direction[dir];
