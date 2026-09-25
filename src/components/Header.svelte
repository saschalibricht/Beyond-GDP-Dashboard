<script lang="ts">
  import { app } from "../lib/state.svelte";
  import Icon from "./Icon.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";

  const PILLARS = ["foundational", "current", "equity", "sustainability"];
</script>

<header class="top wrap">
  <div class="brand">
    <div class="dots" aria-hidden="true">
      {#each PILLARS as p (p)}<span class="p-{p}"></span>{/each}
    </div>
    <h1><span class="light">Beyond</span> GDP</h1>
    <p class="sub">The UN expert group's proposed indicators, filled with open data</p>
    <div class="links">
      <button type="button" class="chip" onclick={() => (app.sheet = "legend")}>
        <Icon name="help" />How to read
      </button>
      <button type="button" class="chip" onclick={() => (app.sheet = "about")}>
        <Icon name="info" />About
      </button>
    </div>
  </div>
  <div class="corner"><ThemeSwitch /></div>
</header>

<style>
  .top {
    position: relative;
    padding-top: max(env(safe-area-inset-top, 0px), 22px);
    padding-bottom: 18px;
  }

  .corner {
    position: absolute;
    top: max(env(safe-area-inset-top, 0px), 18px);
    right: clamp(14px, 3vw, 36px);
  }

  .dots {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }

  .dots span {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    background: var(--accent);
  }

  h1 {
    font-size: clamp(1.75rem, 1.2rem + 2.2vw, 2.625rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    padding-right: 120px;
  }

  .light {
    font-weight: 300;
  }

  .sub {
    margin-top: 4px;
    color: var(--muted);
    font-size: 0.875rem;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 14px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    border-radius: var(--r-pill);
    padding: 7px 13px 7px 10px;
    background: var(--raised);
    box-shadow: var(--lift-sm);
    color: var(--muted);
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .chip:hover {
    color: var(--ink);
  }

  .chip:active {
    box-shadow: var(--press);
  }
</style>
