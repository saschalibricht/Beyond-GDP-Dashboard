// Formatting helpers shared by tiles and dialogs.
export const THIS_YEAR = new Date().getFullYear();

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const nfCache = new Map();
export function fmt(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  let d = decimals;
  // avoid showing "0.00" for tiny but non-zero values
  if (value !== 0 && Math.abs(value) < Math.pow(10, -d)) d = Math.min(4, d + 2);
  const key = d;
  if (!nfCache.has(key)) nfCache.set(key, new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
  return nfCache.get(key).format(value);
}

export function fmtDate(iso) {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function directionText(dir) {
  return dir === "higher" ? "Higher is better" : dir === "lower" ? "Lower is better" : "Neither higher nor lower is simply better";
}
