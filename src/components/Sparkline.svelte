<script lang="ts">
  import type { Point } from "../lib/types";

  let { series }: { series: Point[] } = $props();

  let w = $state(0);
  const h = 36;
  const gid = `spark-${Math.random().toString(36).slice(2, 8)}`;
  const pad = 4;

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
    const last = series[series.length - 1]!;
    const first = series[0]!;
    const points = series.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ");
    return {
      points,
      area: `${X(first[0]).toFixed(1)},${h} ${points} ${X(last[0]).toFixed(1)},${h}`,
      cx: X(last[0]),
      cy: Y(last[1]),
    };
  });
</script>

<div class="spark" bind:clientWidth={w} aria-hidden="true">
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
  {/if}
</div>

<style>
  .spark {
    width: 100%;
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
</style>
