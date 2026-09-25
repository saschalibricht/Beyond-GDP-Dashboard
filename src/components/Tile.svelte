<script lang="ts">
  import { fmt } from "../lib/format";
  import { barScale, compare, flagsFor, isOk, missingInfo, type Side } from "../lib/logic";
  import { app } from "../lib/state.svelte";
  import type { Indicator } from "../lib/types";
  import Icon from "./Icon.svelte";
  import Sparkline from "./Sparkline.svelte";

  let { ind }: { ind: Indicator } = $props();

  const ea = $derived(app.entry(ind.id, app.viewA));
  const eb = $derived(app.entry(ind.id, app.viewB));
  const pinned = $derived(app.pins.includes(ind.id));
  const unit = $derived(ind.unitShort || ind.unit);

  const countries = $derived(
    app.viewB
      ? [
          { iso3: app.viewA, entry: ea },
          { iso3: app.viewB, entry: eb },
        ]
      : [{ iso3: app.viewA, entry: ea }],
  );
  const flags = $derived(app.reg ? flagsFor(app.reg, ind, countries, app.thisYear) : []);

  const rows = $derived.by(() => {
    if (!app.viewB) return [];
    const cmp = compare(ind, ea, eb);
    const [lo, hi] = barScale(
      ind,
      [ea, eb].filter(isOk).map((e) => e.latest.value),
    );
    // a lone bar only means something against the indicator's natural range
    const showBar = !!ind.scale || (isOk(ea) && isOk(eb));
    const pct = (v: number) => Math.max(2, Math.min(100, ((v - lo) / (hi - lo || 1)) * 100));
    return (
      [
        ["a", app.viewA, ea],
        ["b", app.viewB, eb],
      ] as const
    ).map(([side, iso3, e]) => ({
      side: side as Side,
      iso3,
      ok: isOk(e),
      value: isOk(e) ? fmt(e.latest.value, ind.decimals) : "",
      year: isOk(e) ? e.latest.year : null,
      width: isOk(e) && showBar ? pct(e.latest.value) : null,
      better: cmp.better === side,
      older: cmp.older === side,
      missing: missingInfo(e, app.cname(iso3)).title,
    }));
  });

  const flagTitle = (f: (typeof flags)[number]) =>
    `${f.label}${f.only && app.viewB ? ` (${f.only.join(", ")})` : ""}: ${f.short}`;
</script>

<article class="tile">
  <div class="head">
    <h3>
      <button type="button" class="title" aria-haspopup="dialog" onclick={() => (app.detail = ind.id)}>
        {ind.label}
      </button>
    </h3>
    <button
      type="button"
      class="pin"
      aria-pressed={pinned}
      title={pinned ? "Unpin" : "Pin"}
      onclick={() => app.togglePin(ind.id)}
    >
      <Icon name={pinned ? "pinFilled" : "pin"} />
      <span class="visually-hidden">{pinned ? "Unpin" : "Pin"} {ind.label}</span>
    </button>
  </div>

  {#if !app.viewB}
    {#if isOk(ea)}
      <div class="value">
        <span class="v">{fmt(ea.latest.value, ind.decimals)}</span>
        <span class="unit">{unit}</span>
      </div>
      <div class="trend">
        <Sparkline series={ea.series ?? []} />
        <span class="year num">{ea.latest.year}</span>
      </div>
    {:else}
      {@const m = missingInfo(ea, app.cname(app.viewA))}
      <div class="missing {m.kind}">{m.title}</div>
    {/if}
  {:else}
    <div class="rows">
      {#each rows as r (r.side)}
        <div
          class="row side-{r.side}"
          class:better={r.better}
          title="{app.cname(r.iso3)}{r.better ? ' – does better' : ''}"
        >
          <span class="iso">{r.iso3}</span>
          {#if r.ok}
            <span class="year num" class:older={r.older}>{r.year}</span>
            <span class="val"><span class="v">{r.value}</span> <span class="unit">{unit}</span></span>
            {#if r.width !== null}
              <span class="bar"><span style="width:{r.width.toFixed(1)}%"></span></span>
            {/if}
            {#if r.better}<span class="visually-hidden">Does better.</span>{/if}
            {#if r.older}<span class="visually-hidden">Older data.</span>{/if}
          {:else}
            <span class="gap">{r.missing}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if flags.length}
    <ul class="flags" aria-label="Caveats">
      {#each flags as f (f.id)}
        <li class="tone-{f.tone}" title={flagTitle(f)}>
          <Icon name={f.icon} /><span class="visually-hidden">{flagTitle(f)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</article>

<style>
  .tile {
    container-type: inline-size;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 168px;
    padding: 15px 15px 13px;
    border-radius: var(--r-tile);
    background: var(--tile);
    border: 1px solid var(--edge);
    box-shadow: var(--lift);
    transition: transform 0.15s ease;
  }

  .tile:hover {
    transform: translateY(-2px);
  }

  .head {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  h3 {
    flex: 1;
    min-width: 0;
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--pillar-ink);
  }

  .title {
    all: unset;
    cursor: pointer;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* the whole tile opens the detail view */
  .title::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: var(--r-tile);
  }

  .title:focus-visible::after {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .pin {
    position: relative;
    z-index: 1;
    flex: none;
    width: 28px;
    height: 28px;
    margin: -4px -4px 0 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .pin:hover {
    background: var(--track);
  }

  .pin[aria-pressed="true"] {
    color: var(--ink);
    box-shadow: var(--press);
  }

  .unit {
    color: var(--muted);
    font-weight: 400;
    font-size: 0.75rem;
    letter-spacing: 0;
  }

  .year {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .year.older {
    color: var(--older);
  }

  /* single country: value and trend */
  .value {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 5px;
  }

  .value .v {
    font-size: clamp(1.375rem, 16cqi, 2rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.05;
  }

  .value .unit {
    font-size: 0.8125rem;
  }

  .trend {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: 8px;
    margin-top: auto;
  }

  .missing {
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 58px;
    border-radius: 14px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted);
    background: repeating-linear-gradient(135deg, var(--track) 0 6px, transparent 6px 12px);
    box-shadow: var(--press);
  }

  .missing.na {
    background: var(--track);
  }

  .missing.err {
    color: var(--err);
  }

  /* two countries: value + bar per row; the better row sits in a green pill */
  .rows {
    display: grid;
    gap: 4px;
    margin: 0 -7px;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "iso year"
      "val val"
      "bar bar";
    align-items: center;
    column-gap: 6px;
    row-gap: 3px;
    padding: 6px 7px 8px;
    border-radius: 16px;
  }

  @container (min-width: 250px) {
    .row {
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas:
        "iso val year"
        "bar bar bar";
    }
  }

  .row.better {
    background: var(--good-bg);
  }

  .side-a {
    --c: var(--a);
  }

  .side-b {
    --c: var(--b);
  }

  .iso {
    grid-area: iso;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--muted);
  }

  .iso::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c);
  }

  .row .year {
    grid-area: year;
  }

  .val {
    grid-area: val;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .val .v {
    font-size: clamp(1rem, 10.5cqi, 1.25rem);
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .bar {
    grid-area: bar;
    height: 12px;
    padding: 2px;
    border-radius: 6px;
    background: var(--track);
    box-shadow: var(--press);
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: 4px;
    background: var(--c);
    box-shadow: 0 0 8px color-mix(in srgb, var(--c) 55%, transparent);
  }

  .gap {
    grid-area: val;
    font-size: 0.75rem;
    color: var(--muted);
  }

  /* caveat icons; their text is in the detail view */
  .flags {
    list-style: none;
    margin: auto 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .trend + .flags {
    margin-top: 0;
  }

  .flags li {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--track);
    color: var(--muted);
  }

  .flags li :global(.ic) {
    width: 13px;
    height: 13px;
  }

  .flags .tone-warn {
    color: var(--warn);
  }

  .flags .tone-error {
    color: var(--err);
  }
</style>
