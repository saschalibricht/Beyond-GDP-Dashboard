<script lang="ts">
  import { fmt } from "../lib/format";
  import { compare, flagsFor, isEstimate, isOk, missingInfo, type Side } from "../lib/logic";
  import { app } from "../lib/state.svelte";
  import Icon from "./Icon.svelte";
  import LineChart from "./LineChart.svelte";
  import Sheet from "./Sheet.svelte";

  const ind = $derived(app.detail ? app.ind.get(app.detail) : undefined);
  const pillar = $derived(ind ? app.pillar.get(ind.pillar) : undefined);
  const domain = $derived(pillar?.domains.find((d) => d.id === ind?.domain));
  const secondary = $derived(ind?.secondary ? app.ind.get(ind.secondary) : undefined);

  const sides = $derived(
    (app.viewB
      ? [
          ["a", app.viewA],
          ["b", app.viewB],
        ]
      : [["a", app.viewA]]) as [Side, string][],
  );

  const cards = $derived.by(() => {
    if (!ind) return [];
    const cmp = app.viewB ? compare(ind, app.entry(ind.id, app.viewA), app.entry(ind.id, app.viewB)) : null;
    return sides.map(([side, iso3]) => {
      const e = app.entry(ind.id, iso3);
      const sec = secondary ? app.entry(secondary.id, iso3) : null;
      return {
        side,
        iso3,
        name: app.cname(iso3),
        e,
        source: isOk(e) ? ind.sources[e.src] : undefined,
        better: cmp?.better === side,
        older: cmp?.older === side,
        missing: missingInfo(e, app.cname(iso3)),
        sec: isOk(sec) ? sec : null,
        notes: (e?.notes ?? []).filter((_, i) => isOk(e) || i > 0),
      };
    });
  });

  // one "Source" line when both countries' values come from the same source
  const sharedSource = $derived(
    cards.length === 2 && !!cards[0]?.source && cards[0]?.source?.label === cards[1]?.source?.label ? cards[0]?.source : null,
  );

  const flags = $derived(
    ind && app.reg
      ? flagsFor(
          app.reg,
          ind,
          sides.map(([, iso3]) => ({ iso3, entry: app.entry(ind.id, iso3) })),
          app.thisYear,
        )
      : [],
  );

  const lines = $derived(
    ind
      ? sides.map(([side, iso3]) => ({ side, label: app.cname(iso3), series: app.entry(ind.id, iso3)?.series ?? [] }))
      : [],
  );
</script>

<Sheet
  open={!!ind}
  onclose={() => (app.detail = null)}
  title={ind?.label ?? ""}
  eyebrow={pillar && domain ? `${pillar.name} · ${domain.name}` : ""}
  tone={pillar ? `p-${pillar.id}` : ""}
>
  {#if ind && pillar}
    <p class="lead">{ind.explanation}</p>
    <p class="report">Report indicator{ind.sdg ? ` (SDG ${ind.sdg})` : ""}: <q>{ind.name}</q></p>

    <!-- one top tile: latest values, the full time series, then sources -->
    <div class="top">
      <div class="values" class:two={cards.length === 2}>
        {#each cards as c (c.side)}
          <div class="val side-{c.side}">
            <div class="who"><span class="dot"></span>{c.name}</div>
            {#if isOk(c.e)}
              <div class="big">
                <span class="v">{fmt(c.e.latest.value, ind.decimals)}</span>
                <span class="unit">{ind.unit}</span>
              </div>
              <div class="line">
                <span class="year num" class:older={c.older}>{c.e.latest.year}</span>
                {#if c.older}<span class="older-note">older data</span>{/if}
                {#if c.better}<span class="better">Does better</span>{/if}
                {#if isEstimate(c.e.latest.nature)}<span class="muted">estimate</span>{/if}
              </div>
              {#if typeof c.e.latest.lo === "number" && typeof c.e.latest.hi === "number"}
                <p class="muted">
                  Range <span class="num">{fmt(c.e.latest.lo, ind.decimals)}–{fmt(c.e.latest.hi, ind.decimals)}</span>
                </p>
              {/if}
              {#if secondary && c.sec}
                <p class="muted">
                  {secondary.label}: <span class="num">{fmt(c.sec.latest.value, secondary.decimals)}</span>
                  {secondary.unitShort ?? secondary.unit} ({c.sec.latest.year})
                </p>
              {/if}
            {:else}
              <p class="missing {c.missing.kind}"><strong>{c.missing.title}.</strong> {c.missing.text}</p>
            {/if}
          </div>
        {/each}
      </div>

      <LineChart {ind} {lines} />

      <div class="sources">
        {#if sharedSource}
          <p class="muted">
            Source:
            {#if sharedSource.url}<a href={sharedSource.url} target="_blank" rel="noopener">{sharedSource.label}</a>{:else}{sharedSource.label}{/if}
          </p>
        {/if}
        {#each cards as c (c.side)}
          {#if (c.source && !sharedSource) || c.notes.length}
            <div class="side-{c.side}">
              {#if c.source && !sharedSource}
                <p class="muted">
                  {#if cards.length > 1}<span class="dot"></span>{/if}Source:
                  {#if c.source.url}<a href={c.source.url} target="_blank" rel="noopener">{c.source.label}</a>{:else}{c.source.label}{/if}
                </p>
              {/if}
              {#if c.notes.length}
                <ul class="notes">
                  {#each c.notes as n, i (i)}<li>{n}</li>{/each}
                </ul>
              {/if}
            </div>
          {/if}
        {/each}
        {#if ind.sources.length > 1}
          <p class="muted chain">
            Sources checked in order, the first with data is used:
            {#each ind.sources as s, i (i)}
              {#if i > 0}<span aria-hidden="true"> → </span>{/if}{#if s.url}<a href={s.url} target="_blank" rel="noopener"
                  >{s.label}</a
                >{:else}{s.label}{/if}{s.proxy ? " (substitute)" : ""}
            {/each}
          </p>
        {/if}
      </div>
    </div>
    {#if app.viewB}
      <p class="hint">
        The green marker is left out when the two values come from different sources; a yellow year is the older of the
        two.
      </p>
    {/if}

    {#if flags.length}
      <h3>Caveats</h3>
      <ul class="flags">
        {#each flags as f (f.id)}
          <li class="tone-{f.tone}">
            <span class="badge"><Icon name={f.icon} /></span>
            <div>
              <strong>{f.label}</strong>{#if f.only && app.viewB}<span class="only"> · {f.only.join(", ")}</span>{/if}
              <p>{f.long}</p>
            </div>
          </li>
        {/each}
      </ul>
    {/if}


    <h3>Limitations</h3>
    <p>{ind.limitations}</p>

    <h3>Context</h3>
    <div class="context">
      <p>
        <strong>{pillar.name}.</strong>
        {pillar.summary ?? pillar.justification}
        <span class="muted">(Report: Table 1 and Annex; {pillar.ref})</span>
      </p>
      {#if domain}<p><strong>{domain.name}.</strong> {domain.why} {ind.why ?? ""}</p>{/if}
    </div>

  {/if}
</Sheet>

<style>
  .report {
    margin-top: 10px;
    padding-left: 10px;
    border-left: 3px solid var(--accent, var(--line));
    color: var(--muted);
    font-size: 0.8125rem;
  }

  .chain {
    font-size: 0.8125rem;
  }

  .lead {
    font-size: 1rem;
  }

  .top {
    margin-top: 16px;
    padding: 16px 16px 14px;
    border-radius: 20px;
    background: var(--tile);
    border: 1px solid var(--edge);
    box-shadow: var(--lift-sm);
    font-size: 0.875rem;
  }

  .values {
    display: grid;
    gap: 14px;
    margin-bottom: 6px;
  }

  .values.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .val {
    min-width: 0;
  }

  .sources {
    display: grid;
    gap: 6px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }

  .sources .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 6px;
  }

  .side-a {
    --c: var(--a);
  }

  .side-b {
    --c: var(--b);
  }

  .who {
    display: flex;
    align-items: center;
    gap: 7px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
  }

  .big {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 6px;
  }

  .big .v {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .unit,
  .muted {
    color: var(--muted);
    font-size: 0.8125rem;
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 4px 0 6px;
  }

  .year {
    color: var(--muted);
  }

  .year.older {
    color: var(--older);
    font-weight: 700;
  }

  .older-note {
    color: var(--older);
    font-size: 0.75rem;
  }

  .better {
    padding: 2px 9px;
    border-radius: var(--r-pill);
    background: var(--good-bg);
    color: var(--good);
    font-size: 0.75rem;
    font-weight: 700;
  }

  .missing {
    color: var(--muted);
  }

  .missing.err strong {
    color: var(--err);
  }

  .notes {
    margin: 8px 0 0;
    padding-left: 16px;
    color: var(--muted);
    font-size: 0.8125rem;
  }

  .hint {
    margin-top: 10px;
    color: var(--muted);
    font-size: 0.8125rem;
  }

  .flags {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }

  .flags li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: start;
    font-size: 0.875rem;
  }

  .flags p {
    color: var(--muted);
    margin-top: 2px;
  }

  .badge {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--track);
    color: var(--muted);
  }

  .tone-warn .badge,
  .tone-warn strong {
    color: var(--warn);
  }

  .tone-error .badge,
  .tone-error strong {
    color: var(--err);
  }

  .only {
    color: var(--muted);
    font-size: 0.8125rem;
  }

  .context p {
    color: var(--ink);
  }




  @media (max-width: 520px) {
    .values.two {
      gap: 10px;
    }

    .top {
      padding: 14px 12px 12px;
    }

    .two .big .v {
      font-size: 1.375rem;
    }
  }
</style>
