<script lang="ts">
  import { app, type Theme } from "../lib/state.svelte";
  import Icon from "./Icon.svelte";

  const choices = $derived<{ id: Theme; icon: string; label: string }[]>([
    { id: "light", icon: "sun", label: app.t.theme.light },
    { id: "dark", icon: "moon", label: app.t.theme.dark },
    { id: "system", icon: "auto", label: app.t.theme.system },
  ]);
</script>

<div class="switch" role="radiogroup" aria-label={app.t.theme.group}>
  {#each choices as c (c.id)}
    <button
      type="button"
      role="radio"
      aria-checked={app.theme === c.id}
      aria-label={c.label}
      title={c.label}
      onclick={() => app.setTheme(c.id)}
    >
      <Icon name={c.icon} />
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
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
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
