// Dependency-free SVG charts: a tile sparkline and a detail line chart.
import { esc, fmt } from "./format.js";

export function sparkline(series) {
  if (!series || series.length < 2) return "";
  const w = 120, h = 32, pad = 3;
  const xs = series.map((p) => p[0]), ys = series.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const X = (x) => pad + ((x - x0) / (x1 - x0 || 1)) * (w - pad * 2);
  const Y = (y) => h - pad - ((y - y0) / (y1 - y0)) * (h - pad * 2);
  const pts = series.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}"/><circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="2.4"/></svg>`;
}

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

/**
 * lines: [{series: [[year, value, {n, lo, hi}]...], cls: "a"|"b", label}]
 */
export function lineChart(lines, ind) {
  const all = lines.flatMap((l) => l.series || []);
  if (!all.length) return `<p class="unit">No time series available.</p>`;
  const w = 640, h = 250, m = { l: 52, r: 16, t: 12, b: 28 };
  const xs = all.map((p) => p[0]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  const vals = all.flatMap((p) => [p[1], p[2]?.lo, p[2]?.hi]).filter((v) => typeof v === "number");
  let y0 = Math.min(...vals), y1 = Math.max(...vals);
  if (ind.scale && (ind.scale[1] - ind.scale[0]) <= (y1 - y0) * 4) { y0 = Math.min(y0, ind.scale[0]); y1 = Math.max(y1, ind.scale[1]); }
  else { const pad = (y1 - y0) * 0.12 || Math.abs(y1) * 0.1 || 1; y0 = y0 >= 0 && y0 - pad < 0 ? 0 : y0 - pad; y1 += pad; }
  const ticks = niceTicks(y0, y1);
  y0 = ticks[0]; y1 = ticks[ticks.length - 1];
  const X = (x) => m.l + ((x - x0) / (x1 - x0)) * (w - m.l - m.r);
  const Y = (y) => h - m.b - ((y - y0) / (y1 - y0 || 1)) * (h - m.t - m.b);
  const yearStep = Math.max(1, Math.ceil((x1 - x0) / 8));
  let out = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(ind.label)} over time">`;
  for (const t of ticks) {
    out += `<line class="grid-line" x1="${m.l}" x2="${w - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${fmt(t, Math.abs(y1 - y0) < 5 ? 1 : 0)}</text>`;
  }
  for (let yr = Math.ceil(x0); yr <= x1; yr += yearStep) {
    out += `<text x="${X(yr)}" y="${h - 8}" text-anchor="middle">${yr}</text>`;
  }
  for (const l of lines) {
    const s = l.series || [];
    if (!s.length) continue;
    const band = s.filter((p) => p[2] && typeof p[2].lo === "number" && typeof p[2].hi === "number");
    if (band.length > 1) {
      const top = band.map((p) => `${X(p[0])},${Y(p[2].hi)}`).join(" ");
      const bot = band.slice().reverse().map((p) => `${X(p[0])},${Y(p[2].lo)}`).join(" ");
      out += `<polygon class="band-${l.cls}" points="${top} ${bot}"/>`;
    }
    if (s.length > 1) out += `<polyline class="line-${l.cls}" points="${s.map((p) => `${X(p[0])},${Y(p[1])}`).join(" ")}"/>`;
    for (const p of s) {
      const est = p[2] && /^(E|M)$/i.test(p[2].n || "");
      out += `<circle class="dot-${l.cls}" cx="${X(p[0])}" cy="${Y(p[1])}" r="${s.length > 25 ? 1.8 : 3}" ${est ? 'fill-opacity="0.45"' : ""}><title>${esc(l.label)} ${p[0]}: ${fmt(p[1], ind.decimals)} ${esc(ind.unitShort || "")}${est ? " (estimate)" : ""}</title></circle>`;
    }
  }
  return out + "</svg>";
}
