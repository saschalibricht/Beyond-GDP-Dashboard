// Number and date formatting shared by tiles, charts and sheets.
import type { Direction } from "./types";

const nf = new Map<number, Intl.NumberFormat>();

export function fmt(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  let d = decimals;
  // avoid "0.00" for tiny non-zero values
  if (value !== 0 && Math.abs(value) < 10 ** -d) d = Math.min(4, d + 2);
  let f = nf.get(d);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
    nf.set(d, f);
  }
  return f.format(value);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function directionText(dir: Direction): string {
  if (dir === "higher") return "Higher is better";
  if (dir === "lower") return "Lower is better";
  return "Neither higher nor lower is simply better";
}
