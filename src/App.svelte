<script lang="ts">
  import AboutSheet from "./components/AboutSheet.svelte";
  import Controls from "./components/Controls.svelte";
  import DetailSheet from "./components/DetailSheet.svelte";
  import Footer from "./components/Footer.svelte";
  import Header from "./components/Header.svelte";
  import HealthSheet from "./components/HealthSheet.svelte";
  import LegendSheet from "./components/LegendSheet.svelte";
  import Section from "./components/Section.svelte";
  import { app } from "./lib/state.svelte";

  app.init();

  // mirror choices to the URL and local storage
  $effect(() => {
    void [app.a, app.b, app.view, app.pins, app.detail, app.phase];
    app.persist();
  });

  // theme: explicit choice wins, "system" follows the OS (see index.html for the pre-paint copy)
  $effect(() => {
    const root = document.documentElement;
    if (app.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = app.theme;
  });

  const sections = $derived.by(() => {
    const reg = app.reg;
    if (!reg || !app.hasData) return [];
    const visible = (id: string, hidden?: boolean) => !hidden && (app.view === "all" || app.pins.includes(id));
    return reg.framework.pillars
      .map((p) => ({
        pillar: p,
        indicators: p.domains.flatMap((d) =>
          reg.indicators.filter((i) => i.pillar === p.id && i.domain === d.id && visible(i.id, i.hidden)),
        ),
      }))
      .filter((s) => s.indicators.length);
  });
</script>

<a class="skip" href="#main">Skip to indicators</a>
<Header />

{#if app.phase === "failed"}
  <main id="main" class="wrap">
    <div class="note">
      <h2>The dashboard could not load its configuration</h2>
      <p>
        The file <code>data/registry.json</code> is missing. Run the data update once (GitHub → Actions → Update data → Run
        workflow) or <code>python -m etl.build</code> locally.
      </p>
    </div>
  </main>
{:else if app.phase === "ready"}
  <Controls />
  <main id="main" class="wrap" tabindex="-1">
    {#if !app.hasData}
      <div class="note">
        <h2>No data yet</h2>
        <p>
          The data update runs automatically every day. To fetch data now, open the repository on GitHub, go to
          <strong>Actions → Update data</strong> and choose <strong>Run workflow</strong>. The site updates by itself once the
          run has finished.
        </p>
      </div>
    {:else}
      {#if app.dash?.demo}
        <div class="note demo">
          <strong>Demo data.</strong> These values are random placeholders for previewing the layout. Run the data update to replace
          them with real figures.
        </div>
      {/if}
      {#each sections as s (s.pillar.id)}
        <Section pillar={s.pillar} indicators={s.indicators} />
      {:else}
        <div class="note">
          <h2>No pinned indicators yet</h2>
          <p>Use the pin on any tile to collect the indicators you care about, then switch to this view again.</p>
        </div>
      {/each}
    {/if}
  </main>
  <Footer />
  <DetailSheet />
  <LegendSheet />
  <AboutSheet />
  <HealthSheet />
{/if}

<style>
  main:focus {
    outline: none;
  }

  .note {
    margin-top: 24px;
    padding: 26px;
    border-radius: var(--r-tile);
    background: var(--raised);
    box-shadow: var(--lift);
  }

  .note h2 {
    font-size: 1.125rem;
    margin-bottom: 8px;
  }

  .note.demo {
    padding: 14px 18px;
    color: var(--warn);
    font-size: 0.875rem;
  }
</style>
