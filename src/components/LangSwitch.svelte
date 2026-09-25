<script lang="ts">
  import { LANGS, type Lang } from "../lib/i18n";
  import { app } from "../lib/state.svelte";

  // each language is named in itself, so it can be found without reading the current one
  const NAMES: Record<Lang, string> = { en: "English", de: "Deutsch" };
</script>

<div class="switch" role="radiogroup" aria-label={app.t.header.language}>
  {#each LANGS as l (l)}
    <button
      type="button"
      role="radio"
      lang={l}
      aria-checked={app.lang === l}
      aria-label={NAMES[l]}
      title={NAMES[l]}
      onclick={() => app.setLang(l)}
    >
      {l.toUpperCase()}
    </button>
  {/each}
</div>

<style>
  .switch {
    display: inline-flex;
    gap: 2px;
    padding: 4px;
    border-radius: var(--r-pill);
    background: var(--raised);
    border: 1px solid var(--edge);
    box-shadow: var(--lift-sm);
  }

  button {
    min-width: 34px;
    height: 30px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--r-pill);
    background: transparent;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
  }

  button:hover {
    color: var(--ink);
  }

  button[aria-checked="true"] {
    color: var(--ink);
    box-shadow: var(--press);
  }
</style>
