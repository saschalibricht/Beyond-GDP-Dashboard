<script lang="ts">
  import { app } from "../lib/state.svelte";
  import Icon from "./Icon.svelte";
  import LangSwitch from "./LangSwitch.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";

  const PILLARS = ["foundational", "current", "equity", "sustainability"];
</script>

<header class="top wrap">
  <div class="dots" aria-hidden="true">
    {#each PILLARS as p (p)}<span class="p-{p}"></span>{/each}
  </div>
  <h1><span class="light">Beyond</span> GDP</h1>
  <p class="sub">{app.t.header.tagline}</p>
  <div class="corner">
    <LangSwitch />
    <button
      type="button"
      class="soft-btn help"
      aria-label={app.t.header.help}
      title={app.t.header.help}
      onclick={() => (app.sheet = "help")}
    >
      <Icon name="help" />
    </button>
    <ThemeSwitch />
  </div>
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
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .help {
    width: 38px;
    height: 38px;
  }

  .help :global(.ic) {
    width: 18px;
    height: 18px;
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
    padding-right: 260px;
  }

  .light {
    font-weight: 300;
  }

  .sub {
    margin-top: 4px;
    color: var(--muted);
    font-size: 0.875rem;
  }

  /* phones: the dots and the corner controls share the first row, the title goes below */
  @media (max-width: 640px) {
    .top {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
    }

    .dots {
      grid-row: 1;
      grid-column: 1;
      margin: 0;
    }

    .corner {
      grid-row: 1;
      grid-column: 2;
      position: static;
    }

    h1,
    .sub {
      grid-column: 1 / -1;
    }

    h1 {
      padding-right: 0;
      margin-top: 16px;
    }
  }
</style>
