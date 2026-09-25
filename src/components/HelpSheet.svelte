<script lang="ts">
  import { app } from "../lib/state.svelte";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";

  const f = $derived(app.reg?.framework);
</script>

<Sheet open={app.sheet === "help"} onclose={() => (app.sheet = null)} title="How to read · About">
  {#if f}
    <p>
      This dashboard shows the indicators proposed in
      <a href={f.report.url} target="_blank" rel="noopener"><em>{f.report.title}</em></a>, the {f.report.year} report of the
      {f.report.publisher}. The report asks countries to measure progress as equitable, inclusive and sustainable well-being,
      complementing rather than replacing GDP. This is an independent prototype built only from openly available data, not
      produced or endorsed by the United Nations.
    </p>

    <h3>Reading a tile</h3>
    <p>
      Each tile is one indicator, titled in the colour of its component. It shows the latest value, the year it refers to and
      the trend over time. <em>Latest</em> / <em>Trend</em> next to the compare selector switches between the latest values
      and the values over time. Select a tile for the explanation, caveats, full time series and sources. Pin tiles to build
      your own set.
    </p>
    <ul class="pillars">
      {#each f.pillars as p (p.id)}
        <li class="p-{p.id}"><strong>{p.name}.</strong> {p.summary ?? p.justification}</li>
      {/each}
    </ul>

    <h3>Comparing two countries</h3>
    <ul class="rules">
      <li><span class="dot"></span>Pick a second country under <em>Compare</em>; remove it with the × button.</li>
      <li>The first country is always blue, the comparison country indigo. Bars share one scale, so their lengths compare directly.</li>
      <li>
        <span class="better">68.9</span>A green background marks the country that does better, following the indicator's
        direction. It is left out when the two values come from different sources.
      </li>
      <li><span class="older">2018</span>A yellow year is older than the other country's year.</li>
    </ul>

    <h3>Caveat icons</h3>
    <p>Tiles show caveats as icons; the detail view spells them out. They describe the data, not the country.</p>
    <ul class="taglist">
      {#each app.reg?.tags ?? [] as t (t.id)}
        <li>
          <span class="badge" class:warn={t.id === "outdated"}><Icon name={t.icon} /></span>
          <div><strong>{t.label}</strong><p>{t.long}</p></div>
        </li>
      {/each}
      <li>
        <span class="badge err"><Icon name="stale" /></span>
        <div>
          <strong>Not updated</strong>
          <p>The source could not be reached in the latest daily check. The last value retrieved is shown until it works again.</p>
        </div>
      </li>
      <li>
        <span class="badge warn"><Icon name="warn" /></span>
        <div>
          <strong>Comparison caveat</strong>
          <p>The two values come from different sources, or one survey measures income and the other consumption.</p>
        </div>
      </li>
    </ul>

    <h3>Missing values and years</h3>
    <p>
      Nothing is hidden or filled in. A hatched area says why a value is missing: <strong>No data</strong> (the source does not
      cover this country), <strong>Not applicable</strong> (e.g. the global poverty index is not computed for high-income
      countries) or <strong>Source unavailable</strong>. Years are the years the data refer to, not when they were published;
      values more than {app.reg?.outdatedAfterYears ?? 5} years old are marked as outdated.
    </p>

    <h3>Countries and sources</h3>
    <p>
      Every country with data for at least five indicators is listed. Where the report's exact indicator is not openly
      available, the closest open alternative is shown and marked as a substitute; all countries use the same measure, so they
      stay comparable.
    </p>

    <h3>Deliberately not shown</h3>
    {#each f.notIncluded as n (n.name)}
      <p><strong>{n.name}.</strong> {n.text} <span class="muted">({n.ref})</span></p>
    {/each}

    <h3>Updates and privacy</h3>
    <p>
      An automated job checks every source once a day. If a source fails, the last good value stays visible and is marked. See
      <button type="button" class="link-btn" onclick={() => (app.sheet = "health")}>source health</button>. The page loads
      nothing from third parties (fonts are self-hosted) and sets no cookies; your theme and pins stay in your browser.
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
</style>
