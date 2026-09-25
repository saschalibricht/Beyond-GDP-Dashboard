<script lang="ts">
  import type { Side } from "../lib/logic";
  import type { Direction, Point } from "../lib/types";
  import { app } from "../lib/state.svelte";
  import BetterRail from "./BetterRail.svelte";

  /** one or two countries' series on a shared scale; each line takes its country colour */
  let { lines, direction = "neutral" }: { lines: { side: Side; series: Point[] }[]; direction?: Direction } = $props();

  let w = $state(0);
  const h = 36;
  const gid = `spark-${Math.random().toString(36).slice(2, 8)}`;
  const pad = 4;

  const shown = $derived(lines.filter((l) => l.series.length > 0));
  const years = $derived(shown.flatMap((l) => l.series.map((p) => p[0])));
  const y0 = $derived(years.length ? Math.min(...years) : 0);
  const y1 = $derived(years.length ? Math.max(...years) : 0);
  const single = $derived(y0 === y1); // every value is from the same year

  const geo = $derived.by(() => {
    if (!shown.length || w < 20) return null;
    const vals = shown.flatMap((l) => l.series.map((p) => p[1]));
    let v0 = Math.min(...vals);
    let v1 = Math.max(...vals);
    if (v0 === v1) {
      v0 -= 1;
      v1 += 1;
    }
    const X = (x: number) => (single ? w / 2 : pad + ((x - y0) / (y1 - y0)) * (w - pad * 2));
    const Y = (y: number) => h - pad - ((y - v0) / (v1 - v0)) * (h - pad * 2);
    return shown.map((l) => {
      const pts = l.series.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ");
      const first = l.series[0]!;
      const last = l.series[l.series.length - 1]!;
      return {
        side: l.side,
        line: l.series.length > 1 ? pts : "",
        area: l.series.length > 1 ? `${X(first[0]).toFixed(1)},${h} ${pts} ${X(last[0]).toFixed(1)},${h}` : "",
        cx: X(last[0]),
        cy: Y(last[1]),
      };
    });
  });
</script>

{#if shown.length}
  <div class="spark" aria-hidden="true">
    <div class="plot" bind:clientWidth={w}>
      {#if geo}
        <svg width={w} height={h} viewBox="0 0 {w} {h}">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="var(--c, var(--a))" stop-opacity="0.28" />
              <stop offset="1" stop-color="var(--c, var(--a))" stop-opacity="0" />
            </linearGradient>
          </defs>
          {#if single}
            <!-- one year only: dots on a faint guide, so the tile doesn't look broken -->
            <line class="guide" x1={pad} x2={w - pad} y1={h / 2} y2={h / 2} />
          {/if}
          {#each geo as g (g.side)}
            <g class="side-{g.side}">
              {#if g.area && geo.length === 1}<polygon points={g.area} fill="url(#{gid})" />{/if}
              {#if g.line}<polyline points={g.line} />{/if}
              <circle cx={g.cx} cy={single && geo.length === 1 ? h / 2 : g.cy} r={single ? 4.5 : 3.5} />
            </g>
          {/each}
        </svg>
      {/if}
    </div>
    <BetterRail {direction} />
    <div class="years num" class:single>
      {#if single}
        <span>{app.t.tile.onlyYear(y0)}</span>
      {:else}
        <span>{y0}</span><span>{y1}</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .spark {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 6px;
    row-gap: 2px;
    width: 100%;
    min-width: 0;
  }

  .plot {
    height: 36px;
    min-width: 0;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .side-a {
    --c: var(--a);
  }

  .side-b {
    --c: var(--b);
  }

  polyline {
    fill: none;
    stroke: var(--c);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  circle {
    fill: var(--c);
    stroke: var(--tile, var(--page));
    stroke-width: 2;
  }

  .guide {
    stroke: var(--faint);
    stroke-width: 1;
    stroke-dasharray: 2 4;
    opacity: 0.6;
  }

  .years {
    grid-column: 1;
    display: flex;
    justify-content: space-between;
    font-size: 0.6875rem;
    line-height: 1.2;
    color: var(--muted);
  }

  .years.single {
    justify-content: center;
  }
</style>
