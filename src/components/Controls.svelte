<script lang="ts">
  import { app } from "../lib/state.svelte";
  import Icon from "./Icon.svelte";

  const countries = $derived(app.reg?.countries ?? []);
</script>

<div class="bar">
  <div class="wrap inner">
    <label class="pill side-a">
      <span class="dot" aria-hidden="true"></span>
      <span class="text">
        <span class="role">Country</span>
        <span class="name">{app.cname(app.a)}</span>
      </span>
      <Icon name="chevron" class="chev" />
      <select aria-label="Country" value={app.a} onchange={(e) => app.setA(e.currentTarget.value)}>
        {#each countries as c (c.iso3)}
          <option value={c.iso3}>{c.name}</option>
        {/each}
      </select>
    </label>

    {#if app.b}
      <button
        type="button"
        class="soft-btn swap"
        title="Swap countries"
        aria-label="Swap countries"
        onclick={() => app.swap()}
      >
        <Icon name="exchange" />
      </button>
    {:else}
      <span class="vs" aria-hidden="true">vs</span>
    {/if}

    <label class="pill side-b" class:empty={!app.b}>
      <span class="dot" aria-hidden="true"></span>
      <span class="text">
        <span class="role">Compare</span>
        <span class="name">{app.b ? app.cname(app.b) : "Add country"}</span>
      </span>
      <Icon name={app.b ? "chevron" : "plus"} class="chev" />
      <select
        aria-label="Compare with"
        value={app.b ?? ""}
        onchange={(e) => app.setB(e.currentTarget.value || null)}
      >
        <option value="">No comparison</option>
        {#each countries.filter((c) => c.iso3 !== app.a) as c (c.iso3)}
          <option value={c.iso3}>{c.name}</option>
        {/each}
      </select>
    </label>

    <button
      type="button"
      class="soft-btn pins"
      aria-pressed={app.view === "pinned"}
      title={app.view === "pinned" ? "Show all indicators" : "Show pinned indicators only"}
      onclick={() => (app.view = app.view === "pinned" ? "all" : "pinned")}
    >
      <Icon name={app.view === "pinned" ? "pinFilled" : "pin"} />
      {#if app.pins.length}<span class="count num" aria-hidden="true">{app.pins.length}</span>{/if}
      <span class="visually-hidden">Pinned only, {app.pins.length} pinned</span>
    </button>
  </div>
</div>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 20;
    padding: 10px 0 12px;
    background: color-mix(in srgb, var(--page) 94%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .inner {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pill {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    max-width: 280px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 12px 7px 14px;
    border-radius: var(--r-ctl);
    background: var(--raised);
    box-shadow: var(--lift-sm);
    cursor: pointer;
  }

  .pill:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .side-a {
    --c: var(--a);
  }

  .side-b {
    --c: var(--b);
  }

  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
  }

  .empty {
    background: transparent;
    box-shadow: var(--press);
  }

  .empty .dot {
    background: transparent;
    box-shadow: inset 0 0 0 2px var(--c);
  }

  .text {
    display: grid;
    min-width: 0;
    flex: 1;
    line-height: 1.2;
  }

  .role {
    font-size: 0.6875rem;
    color: var(--muted);
  }

  .name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty .name {
    color: var(--muted);
  }

  .pill :global(.chev) {
    color: var(--muted);
  }

  /* native select over the whole pill: OS picker on phones, full keyboard support */
  select {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
    cursor: pointer;
    font-size: 16px; /* prevents iOS zoom on focus */
  }

  .vs {
    flex: none;
    width: 36px;
    display: grid;
    place-items: center;
    font-size: 0.75rem;
    color: var(--muted);
  }

  .pins {
    margin-left: auto;
    position: relative;
    width: 44px;
    height: 44px;
  }

  @media (max-width: 560px) {
    .inner {
      gap: 8px;
    }

    .pill {
      gap: 7px;
      padding: 7px 10px;
    }

    .pill :global(.chev) {
      display: none;
    }

    .swap,
    .vs {
      width: 32px;
      height: 32px;
    }
  }

  .count {
    position: absolute;
    top: -3px;
    right: -3px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    display: grid;
    place-items: center;
    border-radius: var(--r-pill);
    background: var(--ink);
    color: var(--page);
    font-size: 0.6875rem;
    font-weight: 700;
  }
</style>
