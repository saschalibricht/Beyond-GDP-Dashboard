<script lang="ts">
  import Controls from "./components/Controls.svelte";
  import DetailSheet from "./components/DetailSheet.svelte";
  import Footer from "./components/Footer.svelte";
  import Header from "./components/Header.svelte";
  import HealthSheet from "./components/HealthSheet.svelte";
  import HelpSheet from "./components/HelpSheet.svelte";
  import Section from "./components/Section.svelte";
  import { app } from "./lib/state.svelte";

  app.init();

  // mirror choices to the URL and local storage
  $effect(() => {
    void [app.a, app.b, app.view, app.pins, app.detail, app.phase, app.show.single, app.show.compare, app.lang];
    app.persist();
  });

  // load the selected countries' values, then show them
  $effect(() => {
    app.ensureValues(app.a);
    app.ensureValues(app.b);
  });
  $effect(() => {
    if (app.phase === "ready" && !app.pending) {
      app.viewA = app.a;
      app.viewB = app.b;
    }
  });

  // An open sheet owns one history entry: the back button, the system back gesture and
  // our own edge swipe all close it instead of leaving the page.
  const SHEET = "bgdp-sheet";
  const sheetOpen = $derived(!!app.detail || !!app.sheet);
  $effect(() => {
    const marked = history.state?.[SHEET] === true;
    if (sheetOpen && !marked) history.pushState({ [SHEET]: true }, "", location.href);
    else if (!sheetOpen && marked) history.back();
  });
  $effect(() => {
    const onPop = () => {
      if (history.state?.[SHEET] !== true) {
        app.detail = null;
        app.sheet = null;
      }
      app.persist(); // the entry we came back to may still carry the old ?i= link
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  });

  // language: the page's lang attribute (screen readers, hyphenation), title and description
  $effect(() => {
    document.documentElement.lang = app.lang;
    document.title = app.t.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", app.t.meta.description);
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

<a class="skip" href="#main">{app.t.app.skip}</a>
<Header />

{#if app.phase === "failed"}
  <main id="main" class="wrap">
    <div class="note">
      <h2>{app.t.app.loadFailedTitle}</h2>
      <p>{app.t.app.loadFailed}</p>
    </div>
  </main>
{:else if app.phase === "ready"}
  <Controls />
  <main id="main" class="wrap" tabindex="-1" class:busy={app.pending && !!app.viewA}>
    {#if !app.hasData}
      <div class="note">
        <h2>{app.t.app.noDataTitle}</h2>
        <p>{app.t.app.noData}</p>
      </div>
    {:else}
      {#if app.manifest?.demo}
        <div class="note demo">{app.t.app.demo}</div>
      {/if}
      {#each sections as s (s.pillar.id)}
        <Section pillar={s.pillar} indicators={s.indicators} />
      {:else}
        <div class="note">
          <h2>{app.t.app.noPinsTitle}</h2>
          <p>{app.t.app.noPins}</p>
        </div>
      {/each}
    {/if}
  </main>
  <Footer />
  <DetailSheet />
  <HelpSheet />
  <HealthSheet />
{/if}

<style>
  main:focus {
    outline: none;
  }

  /* hold the previous render while a newly picked country loads */
  main.busy {
    opacity: 0.55;
    transition: opacity 0.2s 0.1s;
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
