<script lang="ts">
  import { app } from "../lib/state.svelte";
  import Sheet from "./Sheet.svelte";

  const f = $derived(app.reg?.framework);
</script>

<Sheet open={app.sheet === "about"} onclose={() => (app.sheet = null)} title="About">
  {#if f}
    <p>
      This dashboard implements the indicator set proposed in
      <a href={f.report.url} target="_blank" rel="noopener"><em>{f.report.title}</em></a>, the {f.report.year} report of the
      {f.report.publisher}. The report asks countries to measure progress as equitable, inclusive and sustainable well-being,
      complementing rather than replacing GDP.
    </p>
    <p>It is an independent prototype built only from openly available data, not produced or endorsed by the United Nations.</p>

    <h3>Structure</h3>
    <ul class="pillars">
      {#each f.pillars as p (p.id)}
        <li class="p-{p.id}"><strong>{p.name}.</strong> {p.summary ?? p.justification}</li>
      {/each}
    </ul>
    <p>
      Where the report's exact indicator is not openly available, the closest open alternative is shown and marked as a
      substitute. All countries use the same measure, so they stay comparable.
    </p>

    <h3>Deliberately not shown</h3>
    {#each f.notIncluded as n (n.name)}
      <p><strong>{n.name}.</strong> {n.text} <span class="muted">({n.ref})</span></p>
    {/each}

    <h3>Updates and privacy</h3>
    <p>
      An automated job checks every source once a day and publishes new values. If a source fails, the last good value stays
      visible and is marked. See
      <button type="button" class="link-btn" onclick={() => (app.sheet = "health")}>source health</button>.
    </p>
    <p>
      The page loads nothing from third parties (fonts are self-hosted) and sets no cookies. Your theme and pinned indicators
      are stored only in your browser.
    </p>
  {/if}
</Sheet>

<style>
  .pillars {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: grid;
    gap: 8px;
  }

  .pillars li {
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--tile);
    font-size: 0.875rem;
  }

  .pillars strong {
    color: var(--pillar-ink);
  }

  .muted {
    color: var(--muted);
  }
</style>
