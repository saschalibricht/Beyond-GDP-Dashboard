<script lang="ts">
  import type { Direction, Point } from "../lib/types";
  import BetterRail from "./BetterRail.svelte";

  let { series, direction = "neutral" }: { series: Point[]; direction?: Direction } = $props();

  let w = $state(0);
  const h = 36;
  const gid = `spark-${Math.random().toString(36).slice(2, 8)}`;
  const pad = 4;

  const first = $derived(series[0]);
  const last = $derived(series[series.length - 1]);

  const geo = $derived.by(() => {
    if (series.length < 2 || w < 20) return null;
    const xs = series.map((p) => p[0]);
    const ys = series.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    let y0 = Math.min(...ys);
    let y1 = Math.max(...ys);
    if (y0 === y1) {
      y0 -= 1;
      y1 += 1;
    }
    const X = (x: number) => pad + ((x - x0) / (x1 - x0 || 1)) * (w - pad * 2);
    const Y = (y: number) => h - pad - ((y - y0) / (y1 - y0)) * (h - pad * 2);
    const points = series.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ");
    return {
      points,
      area: `${X(series[0]![0]).toFixed(1)},${h} ${points} ${X(series[series.length - 1]![0]).toFixed(1)},${h}`,
      cx: X(series[series.length - 1]![0]),
      cy: Y(series[series.length - 1]![1]),
    };
  });
</script>

{#if series.length}
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
          <polygon points={geo.area} fill="url(#{gid})" />
          <polyline points={geo.points} />
          <circle cx={geo.cx} cy={geo.cy} r="3.5" />
        </svg>
      {:else if series.length === 1 && w > 0}
        <!-- one observation: a dot on a faint guide, so the tile doesn't look broken -->
        <svg width={w} height={h} viewBox="0 0 {w} {h}">
          <line class="guide" x1={pad} x2={w - pad} y1={h / 2} y2={h / 2} />
          <circle cx={w / 2} cy={h / 2} r="4.5" />
        </svg>
      {/if}
    </div>
    <BetterRail {direction} />
    <div class="years num" class:single={series.length === 1}>
      {#if series.length === 1}
        <span>{first?.[0]} · only year</span>
      {:else}
        <span>{first?.[0]}</span><span>{last?.[0]}</span>
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

  polyline {
    fill: none;
    stroke: var(--c, var(--a));
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  circle {
    fill: var(--c, var(--a));
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
