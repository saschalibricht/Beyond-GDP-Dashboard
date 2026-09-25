<script lang="ts">
  import { app } from "../lib/state.svelte";
  import Sheet from "./Sheet.svelte";

  const RANK = { error: 0, disabled: 1, ok: 2 } as const;

  const sources = $derived(
    [...(app.status?.sources ?? [])].sort(
      (x, y) => RANK[x.status] - RANK[y.status] || x.provider.localeCompare(y.provider),
    ),
  );
</script>

<Sheet open={app.sheet === "health"} onclose={() => (app.sheet = null)} title={app.t.health.title}>
  <p>
    {app.t.health.intro(app.fmtDate(app.status?.lastChecked), app.fmtDate(app.status?.lastChanged))}
  </p>
  {#if sources.length}
    <ul class="list">
      {#each sources as s (s.key)}
        <li class="st-{s.status}">
          <div class="row">
            <span class="state"><span class="dot"></span>{app.t.health[s.status]}{s.consecutiveFailures ? ` (${s.consecutiveFailures}×)` : ""}</span>
            <span class="when">{s.status === "ok" ? "" : app.t.health.lastSuccess(app.fmtDate(s.lastSuccess))}</span>
          </div>
          <div class="name">
            {#if s.url}<a href={s.url} target="_blank" rel="noopener">{s.label}</a>{:else}{s.label}{/if}
            {#if s.optional}<span class="muted"> · {app.t.health.optional}</span>{/if}
          </div>
          <div class="muted">{s.indicators.map((i) => app.ind.get(i)?.label ?? i).join(", ")}</div>
          {#if s.error}<code>{s.error}</code>{/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">{app.t.health.none}</p>
  {/if}
</Sheet>

<style>
  .list {
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }

  li {
    padding: 12px 14px;
    border-radius: 16px;
    background: var(--raised);
    box-shadow: var(--lift-sm);
    font-size: 0.8125rem;
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 2px;
  }

  .state {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--good);
  }

  .st-error .dot {
    background: var(--err);
  }

  .st-error .state {
    color: var(--err);
  }

  .st-disabled .dot {
    background: var(--warn);
  }

  .name {
    font-size: 0.875rem;
  }

  .muted,
  .when {
    color: var(--muted);
  }

  code {
    display: block;
    margin-top: 6px;
    color: var(--err);
    font-size: 0.75rem;
    word-break: break-word;
  }
</style>
