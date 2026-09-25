<script lang="ts">
  import { app } from "../lib/state.svelte";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";
</script>

<Sheet open={app.sheet === "legend"} onclose={() => (app.sheet = null)} title="How to read this dashboard">
  <p>
    Each tile is one indicator from the report's proposed dashboard. Tiles are grouped and tinted by the four components of
    its framework. Select a tile for its explanation, caveats, time series and sources. Pin tiles to build your own set.
  </p>

  <h3>Comparing countries</h3>
  <ul class="rules">
    <li><span class="dot a"></span>The first country is always blue, the comparison country pink.</li>
    <li>Bars in a tile share one scale, so their lengths can be compared directly.</li>
    <li>
      <span class="better"><Icon name="check" />Better</span>marks the country that does better, following the indicator's
      direction. It is left out when the two values come from different sources.
    </li>
    <li><strong class="older">2018</strong>An orange year is older than the other country's year.</li>
  </ul>

  <h3>Caveat icons</h3>
  <p>Tiles show caveats as icons only; the detail view spells them out. They describe the data, not the country.</p>
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
        <p>The two countries' values come from different sources, or one survey measures income and the other consumption.</p>
      </div>
    </li>
  </ul>

  <h3>Missing values</h3>
  <p>
    Nothing is hidden or filled in. A hatched area says why a value is missing: <strong>No data</strong> (the source does not
    cover this country), <strong>Not applicable</strong> (e.g. the global poverty index is not computed for high-income
    countries) or <strong>Source unavailable</strong>.
  </p>
  <p>
    Years are the years the data refer to, not when they were published. Values more than {app.reg?.outdatedAfterYears ?? 5}
    years old are marked as outdated.
  </p>
</Sheet>

<style>
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
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px 2px 5px;
    border-radius: var(--r-pill);
    background: var(--good);
    color: var(--good-ink);
    font-size: 0.75rem;
    font-weight: 700;
  }

  .older {
    flex: none;
    color: var(--older);
    font-weight: 900;
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
</style>
