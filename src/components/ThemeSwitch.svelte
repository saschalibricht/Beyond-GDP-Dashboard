<script lang="ts">
  import { app, type Theme } from "../lib/state.svelte";
  import Icon from "./Icon.svelte";

  const choices: { id: Theme; icon: string; label: string }[] = [
    { id: "light", icon: "sun", label: "Light theme" },
    { id: "dark", icon: "moon", label: "Dark theme" },
    { id: "system", icon: "auto", label: "Follow system theme" },
  ];
</script>

<div class="switch" role="radiogroup" aria-label="Colour theme">
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
