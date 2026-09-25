<script lang="ts">
  import { app } from "../lib/state.svelte";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";

  const f = $derived(app.reg?.framework);
  const h = $derived(app.t.help);
</script>

<Sheet open={app.sheet === "help"} onclose={() => (app.sheet = null)} title={h.title}>
  {#if f}
    {@const intro = h.intro(f.report.title, f.report.year, f.report.publisher)}
    <p>{intro[0]}<a href={f.report.url} target="_blank" rel="noopener"><em>{intro[1]}</em></a>{intro[2]}</p>

    <h3>{h.tileTitle}</h3>
    <p>{h.tile}</p>
    <ul class="pillars">
      {#each f.pillars as p (p.id)}
        <li class="p-{p.id}"><strong>{p.name}.</strong> {p.summary ?? p.justification}</li>
      {/each}
    </ul>
    <p class="rail-note"><span class="rail" aria-hidden="true"><Icon name="arrowUp" /></span>{h.rail}</p>

    <h3>{h.compareTitle}</h3>
    <ul class="rules">
      <li><span class="dot"></span>{h.compare1}</li>
      <li><span class="dot"></span>{h.compare2}</li>
      <li><span class="better">{app.fmt(68.9, 1)}</span>{h.compare3}</li>
      <li><span class="older">2018</span>{h.compare4}</li>
    </ul>

    <h3>{h.caveatsTitle}</h3>
    <p>{h.caveats}</p>
    <ul class="taglist">
      {#each app.reg?.tags ?? [] as t (t.id)}
        <li>
          <span class="badge" class:warn={t.id === "outdated"}><Icon name={t.icon} /></span>
          <div><strong>{t.label}</strong><p>{t.long}</p></div>
        </li>
      {/each}
      <li>
        <span class="badge err"><Icon name="stale" /></span>
        <div><strong>{h.staleTitle}</strong><p>{h.stale}</p></div>
      </li>
      <li>
        <span class="badge warn"><Icon name="warn" /></span>
        <div><strong>{h.cmpTitle}</strong><p>{h.cmp}</p></div>
      </li>
    </ul>

    <h3>{h.missingTitle}</h3>
    <p>{h.missing(app.reg?.outdatedAfterYears ?? 5)}</p>

    <h3>{h.countriesTitle}</h3>
    <p>{h.countries}</p>
    <p class="muted">{h.languageNote}</p>

    <h3>{h.notShownTitle}</h3>
    {#each f.notIncluded as n (n.name)}
      <p><strong>{n.name}.</strong> {n.text} <span class="muted">({n.ref})</span></p>
    {/each}

    <h3>{h.updatesTitle}</h3>
    <p>
      {h.updates1}
      <button type="button" class="link-btn" onclick={() => (app.sheet = "health")}>{h.updatesLink}</button>.
      {h.updates2}
    </p>
  {/if}
</Sheet>

<style>
  .pillars {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }

  .pillars li {
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--tile);
    border: 1px solid var(--edge);
    font-size: 0.875rem;
  }

  .pillars strong {
    color: var(--pillar-ink);
  }

  .rules {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 10px;
  }

  .rules li {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: linear-gradient(90deg, var(--a) 50%, var(--b) 50%);
  }

  .better {
    flex: none;
    padding: 1px 8px;
    border-radius: var(--r-pill);
    background: var(--good-bg);
    font-weight: 700;
  }

  .older {
    flex: none;
    color: var(--older);
    font-weight: 700;
  }

  .taglist {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }

  .taglist li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    font-size: 0.875rem;
  }

  .taglist p {
    color: var(--muted);
    margin-top: 2px;
  }

  .badge {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--raised);
    box-shadow: var(--lift-sm);
    color: var(--muted);
  }

  .badge.warn {
    color: var(--warn);
  }

  .badge.err {
    color: var(--err);
  }

  .muted {
    color: var(--muted);
  }

  .rail-note {
    display: flex;
    gap: 8px;
    align-items: baseline;
    margin-top: 10px;
  }

  .rail {
    flex: none;
    color: var(--good);
  }

  .rail :global(.ic) {
    width: 13px;
    height: 13px;
    stroke-width: 2;
  }
</style>
