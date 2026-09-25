<script lang="ts" module>
  import type { Side } from "../lib/logic";
  import type { Point } from "../lib/types";

  export interface Line {
    side: Side;
    label: string;
    series: Point[];
  }
</script>

<script lang="ts">
  import { directionText, fmt } from "../lib/format";
  import BetterRail from "./BetterRail.svelte";
  import { isEstimate, niceTicks } from "../lib/logic";
  import type { Indicator } from "../lib/types";
  import Icon from "./Icon.svelte";

  let { ind, lines }: { ind: Indicator; lines: Line[] } = $props();

  let w = $state(0);
  let active = $state<number | null>(null);
  const h = 230;
  // room on the right for the "better" rail
  const m = $derived({ l: 46, r: ind.direction === "neutral" ? 14 : 30, t: 14, b: 28 });

  const years = $derived([...new Set(lines.flatMap((l) => l.series.map((p) => p[0])))].sort((x, y) => x - y));
  const hasData = $derived(years.length > 0);
  const DOT_LIMIT = 12; // longer series show only the line and its end point
  const anyEstimate = $derived(
    lines.some((l) => l.series.length <= DOT_LIMIT && l.series.some((p) => isEstimate(p[2]?.n))),
  );

  const geo = $derived.by(() => {
    const all = lines.flatMap((l) => l.series);
    if (!all.length || w < 100) return null;
    let x0 = years[0]!;
    let x1 = years[years.length - 1]!;
    if (x0 === x1) {
      x0 -= 1;
      x1 += 1;
    }
    const vals = all
      .flatMap((p) => [p[1], p[2]?.lo, p[2]?.hi])
      .filter((v): v is number => typeof v === "number");
    let y0 = Math.min(...vals);
    let y1 = Math.max(...vals);
    if (ind.scale && ind.scale[1] - ind.scale[0] <= (y1 - y0) * 4) {
      y0 = Math.min(y0, ind.scale[0]);
      y1 = Math.max(y1, ind.scale[1]);
    } else {
      const pad = (y1 - y0) * 0.12 || Math.abs(y1) * 0.1 || 1;
      y0 = y0 >= 0 && y0 - pad < 0 ? 0 : y0 - pad;
      y1 += pad;
    }
    const ticks = niceTicks(y0, y1);
    y0 = ticks[0]!;
    y1 = ticks[ticks.length - 1]!;
    const X = (x: number) => m.l + ((x - x0) / (x1 - x0)) * (w - m.l - m.r);
    const Y = (y: number) => h - m.b - ((y - y0) / (y1 - y0 || 1)) * (h - m.t - m.b);
    const maxLabels = Math.max(2, Math.floor((w - m.l - m.r) / 44));
    const step = Math.max(1, Math.ceil((x1 - x0) / maxLabels));
    const xLabels: number[] = [];
    for (let yr = Math.ceil(x0); yr <= x1; yr += step) xLabels.push(yr);
    const tickDecimals = Math.abs(y1 - y0) < 5 ? (Math.abs(y1 - y0) < 0.5 ? 2 : 1) : 0;
    return {
      X,
      Y,
      ticks,
      xLabels,
      tickDecimals,
      paths: lines.map((l) => {
        const band = l.series.filter((p) => typeof p[2]?.lo === "number" && typeof p[2]?.hi === "number");
        return {
          ...l,
          line: l.series.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" "),
          band:
            band.length > 1
              ? [
                  ...band.map((p) => `${X(p[0]).toFixed(1)},${Y(p[2]!.hi!).toFixed(1)}`),
                  ...band.reverse().map((p) => `${X(p[0]).toFixed(1)},${Y(p[2]!.lo!).toFixed(1)}`),
                ].join(" ")
              : "",
          dots: l.series.length <= DOT_LIMIT ? l.series : l.series.slice(-1),
        };
      }),
    };
  });

  const valueAt = (l: Line, year: number) => l.series.find((p) => p[0] === year);

  function nearestYear(clientX: number, svg: SVGSVGElement): number | null {
    if (!geo || !years.length) return null;
    const x = clientX - svg.getBoundingClientRect().left;
    let best = years[0]!;
    for (const y of years) if (Math.abs(geo.X(y) - x) < Math.abs(geo.X(best) - x)) best = y;
    return best;
  }

  function onKey(e: KeyboardEvent) {
    if (!years.length) return;
    const i = active === null ? years.length - 1 : years.indexOf(active);
    if (e.key === "ArrowLeft") active = years[Math.max(0, i - 1)]!;
    else if (e.key === "ArrowRight") active = years[Math.min(years.length - 1, i + 1)]!;
    else if (e.key === "Escape") active = null;
    else return;
    e.preventDefault();
  }

  const valueText = $derived.by(() => {
    const yr = active ?? years[years.length - 1];
    if (yr === undefined) return "";
    const parts = lines.map((l) => {
      const pt = valueAt(l, yr);
      return `${l.label} ${pt ? fmt(pt[1], ind.decimals) : "no value"}`;
    });
    return `${yr}: ${parts.join(", ")}`;
  });

  const tipLeft = $derived(geo && active !== null ? Math.min(Math.max(geo.X(active), 80), w - 80) : 0);
</script>

{#if !hasData}
  <p class="empty">No time series available.</p>
{:else}
  <div class="chart" bind:clientWidth={w}>
    {#if geo}
      <svg
        width={w}
        height={h}
        viewBox="0 0 {w} {h}"
        role="slider"
        aria-label="{ind.label} over time. Use the left and right arrow keys to read values by year."
        aria-valuemin={years[0]}
        aria-valuemax={years[years.length - 1]}
        aria-valuenow={active ?? years[years.length - 1]}
        aria-valuetext={valueText}
        tabindex="0"
        onpointermove={(e) => (active = nearestYear(e.clientX, e.currentTarget))}
        onpointerleave={() => (active = null)}
        onfocus={() => (active ??= years[years.length - 1] ?? null)}
        onblur={() => (active = null)}
        onkeydown={onKey}
      >
        {#each geo.ticks as t (t)}
          <line class="grid" x1={m.l} x2={w - m.r} y1={geo.Y(t)} y2={geo.Y(t)} />
          <text class="tick" x={m.l - 8} y={geo.Y(t) + 4} text-anchor="end">{fmt(t, geo.tickDecimals)}</text>
        {/each}
        {#each geo.xLabels as yr (yr)}
          <text class="tick" x={geo.X(yr)} y={h - 8} text-anchor="middle">{yr}</text>
        {/each}
        {#each geo.paths as p (p.side)}
          <g class="side-{p.side}">
            {#if p.band}<polygon class="band" points={p.band} />{/if}
            {#if p.series.length > 1}<polyline class="line" points={p.line} />{/if}
            {#each p.dots as d (d[0])}
              <circle
                class="dot"
                class:est={isEstimate(d[2]?.n)}
                cx={geo.X(d[0])}
                cy={geo.Y(d[1])}
                class:end={p.series.length > DOT_LIMIT}
                r={p.series.length > DOT_LIMIT ? 4 : 3.5}
              />
            {/each}
          </g>
        {/each}
        {#if active !== null}
          <line class="cross" x1={geo.X(active)} x2={geo.X(active)} y1={m.t} y2={h - m.b} />
          {#each geo.paths as p (p.side)}
            {@const pt = valueAt(p, active)}
            {#if pt}
              <circle class="hot side-{p.side}" cx={geo.X(pt[0])} cy={geo.Y(pt[1])} r="5" />
            {/if}
          {/each}
        {/if}
      </svg>
      <div class="rail" style="top:{m.t}px;height:{h - m.t - m.b}px"><BetterRail direction={ind.direction} /></div>
      {#if active !== null}
        <div class="tip" style="left:{tipLeft}px" aria-live="polite">
          <div class="tip-year">{active}</div>
          {#each lines as l (l.side)}
            {@const pt = valueAt(l, active)}
            <div class="tip-row side-{l.side}">
              <span class="key"></span>
              <strong class="num">{pt ? fmt(pt[1], ind.decimals) : "–"}</strong>
              <span class="tip-label">{l.label}{pt && isEstimate(pt[2]?.n) ? " (estimate)" : ""}</span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <div class="legend">
    {#if lines.length > 1}
      {#each lines as l (l.side)}
        <span class="side-{l.side}"><span class="key"></span>{l.label}</span>
      {/each}
    {/if}
    {#if ind.direction !== "neutral"}
      <span class="better"><Icon name={ind.direction === "higher" ? "arrowUp" : "arrowDown"} />{directionText(ind.direction)}</span>
    {/if}
    <span class="note">{ind.unit}{anyEstimate ? ". Hollow points are estimates" : ""}.</span>
  </div>

  <details class="table">
    <summary><Icon name="table" />Data table</summary>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Year</th>
            {#each lines as l (l.side)}<th scope="col">{l.label}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each [...years].reverse() as yr (yr)}
            <tr>
              <th scope="row" class="num">{yr}</th>
              {#each lines as l (l.side)}
                {@const pt = valueAt(l, yr)}
                <td class="num">{pt ? fmt(pt[1], ind.decimals) : "–"}{pt && isEstimate(pt[2]?.n) ? " e" : ""}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>
{/if}

<style>
  .chart {
    position: relative;
    margin-top: 6px;
    min-height: 230px;
  }

  svg {
    display: block;
    overflow: visible;
    touch-action: pan-y;
  }

  svg:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 4px;
    border-radius: 8px;
  }

  .side-a {
    --c: var(--a);
  }

  .side-b {
    --c: var(--b);
  }

  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }

  .tick {
    fill: var(--muted);
    font-size: 11px;
    font-family: var(--font);
    font-variant-numeric: tabular-nums;
  }

  .line {
    fill: none;
    stroke: var(--c);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .band {
    fill: var(--c);
    opacity: 0.12;
  }

  .dot {
    fill: var(--c);
    stroke: var(--tile, var(--page));
    stroke-width: 2;
  }

  .dot.end {
    fill: var(--c);
    stroke: var(--tile, var(--page));
    stroke-width: 2;
  }

  .dot.est:not(.end) {
    fill: var(--tile, var(--page));
    stroke: var(--c);
    stroke-width: 1.6;
  }

  .cross {
    stroke: var(--muted);
    stroke-width: 1;
  }

  .hot {
    fill: var(--c);
    stroke: var(--tile, var(--page));
    stroke-width: 2.5;
  }

  .tip {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    pointer-events: none;
    min-width: 140px;
    padding: 8px 10px;
    border-radius: 12px;
    background: var(--raised);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
    font-size: 0.8125rem;
  }

  .tip-year {
    color: var(--muted);
    font-size: 0.75rem;
    margin-bottom: 2px;
  }

  .tip-row {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .tip-label {
    color: var(--muted);
  }

  .key {
    display: inline-block;
    width: 14px;
    height: 3px;
    border-radius: 2px;
    background: var(--c);
    flex: none;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin-top: 8px;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .legend > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .rail {
    position: absolute;
    right: 0;
  }

  .legend .better {
    color: var(--good);
    font-weight: 500;
    gap: 3px;
  }

  .legend .better :global(.ic) {
    width: 13px;
    height: 13px;
    stroke-width: 2;
  }

  .legend .note {
    display: inline;
  }

  .empty {
    color: var(--muted);
    font-size: 0.875rem;
  }

  .table {
    margin-top: 12px;
    font-size: 0.8125rem;
  }

  summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    color: var(--focus);
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .table-wrap {
    max-height: 280px;
    overflow: auto;
    margin-top: 8px;
    border-radius: 12px;
    background: var(--raised);
    box-shadow: var(--press);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 6px 12px;
    text-align: right;
    border-bottom: 1px solid var(--line);
  }

  th:first-child {
    text-align: left;
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--raised);
    color: var(--muted);
    font-weight: 500;
  }
</style>
