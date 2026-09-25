<script lang="ts">
  import { fmt } from "../lib/format";
  import { barScale, compare, flagsFor, isOk, missingInfo, type Side } from "../lib/logic";
  import { app } from "../lib/state.svelte";
  import type { Indicator } from "../lib/types";
  import Icon from "./Icon.svelte";
  import Sparkline from "./Sparkline.svelte";

  let { ind }: { ind: Indicator } = $props();

  const ea = $derived(app.entry(ind.id, app.a));
  const eb = $derived(app.entry(ind.id, app.b));
  const pinned = $derived(app.pins.includes(ind.id));
  const unit = $derived(ind.unitShort || ind.unit);

  const countries = $derived(
    app.b
      ? [
          { iso3: app.a, entry: ea },
          { iso3: app.b, entry: eb },
        ]
      : [{ iso3: app.a, entry: ea }],
  );
  const flags = $derived(app.reg ? flagsFor(app.reg, ind, countries, app.thisYear) : []);

  const rows = $derived.by(() => {
    if (!app.b) return [];
    const cmp = compare(ind, ea, eb);
    const [lo, hi] = barScale(
      ind,
      [ea, eb].filter(isOk).map((e) => e.latest.value),
    );
    // a lone bar only means something against the indicator's natural range
    const showBar = !!ind.scale || (isOk(ea) && isOk(eb));
    const pct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo || 1)) * 100));
    return (
      [
        ["a", app.a, ea],
        ["b", app.b, eb],
      ] as const
    ).map(([side, iso3, e]) => ({
      side: side as Side,
      iso3,
      e,
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
    `${f.label}${f.only && app.b ? ` (${f.only.join(", ")})` : ""}: ${f.short}`;
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

  {#if !app.b}
    {#if isOk(ea)}
      <div class="value">
        <span class="v">{fmt(ea.latest.value, ind.decimals)}</span>
        <span class="unit">{unit}</span>
      </div>
      <div class="foot">
        <span class="year num">{ea.latest.year}</span>
        <Sparkline series={ea.series ?? []} />
      </div>
    {:else}
      {@const m = missingInfo(ea, app.cname(app.a))}
      <div class="missing {m.kind}">{m.title}</div>
    {/if}
  {:else}
    <p class="unit cmp-unit">{unit}</p>
    <div class="rows">
      {#each rows as r (r.side)}
        <div class="row side-{r.side}" title={app.cname(r.iso3)}>
          <span class="iso">{r.iso3}</span>
          {#if r.ok}
            <span class="val">
              <span class="v">{r.value}</span>
              {#if r.better}
                <span class="better" title="Better: {ind.direction === 'higher' ? 'higher' : 'lower'} is better">
                  <Icon name="check" /><span class="better-text">Better</span>
                </span>
              {/if}
            </span>
            <span class="year num" class:older={r.older} title={r.older ? "Older data than the other country" : undefined}
              >{r.year}</span
            >
            {#if r.width !== null}
              <span class="bar"><span style="width:{r.width.toFixed(1)}%"></span></span>
            {/if}
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
    min-height: 156px;
    padding: 14px 14px 12px;
    border-radius: var(--r-tile);
    background: var(--tile);
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
    font-weight: 500;
    line-height: 1.3;
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
    background: var(--tile2);
  }

  .pin[aria-pressed="true"] {
    color: var(--ink);
    background: var(--tile2);
    box-shadow: inset 1px 1px 3px var(--lo);
  }

  .unit {
    color: var(--muted);
    font-size: 0.75rem;
  }

  /* single country */
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

  .foot {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: end;
    gap: 10px;
    margin-top: auto;
  }

  .year {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .year.older {
    color: var(--older);
    font-weight: 900;
    font-size: 0.8125rem;
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
    background: repeating-linear-gradient(135deg, var(--tile2) 0 6px, transparent 6px 12px);
    box-shadow: inset 1px 1px 3px var(--lo);
  }

  .missing.na {
    background: var(--tile2);
  }

  .missing.err {
    color: var(--err);
  }

  /* comparison */
  .cmp-unit {
    margin-top: -6px;
  }

  .rows {
    display: grid;
    gap: 9px;
  }

  .row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 6px;
    row-gap: 4px;
  }

  .side-a {
    --c: var(--a);
  }

  .side-b {
    --c: var(--b);
  }

  .iso {
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

  .val {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }

  .val .v {
    font-size: clamp(0.9375rem, 10.5cqi, 1.25rem);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .better {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: none;
    padding: 2px;
    border-radius: var(--r-pill);
    background: var(--good);
    color: var(--good-ink);
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 1;
  }

  .better :global(.ic) {
    width: 12px;
    height: 12px;
    stroke-width: 2.2;
  }

  .better-text {
    display: none;
    padding-right: 5px;
  }

  @container (min-width: 230px) {
    .better-text {
      display: inline;
    }
  }

  .bar {
    grid-column: 1 / -1;
    height: 7px;
    border-radius: 4px;
    background: var(--tile2);
    box-shadow: inset 1px 1px 2px var(--lo);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: 4px;
    background: var(--c);
  }

  .gap {
    grid-column: 2 / -1;
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

  .flags li {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--tile2);
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

  .foot + .flags {
    margin-top: 0;
  }
</style>
