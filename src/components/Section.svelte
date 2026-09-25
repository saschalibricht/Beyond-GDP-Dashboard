<script lang="ts">
  import type { Indicator, Pillar } from "../lib/types";
  import Tile from "./Tile.svelte";

  let { pillar, indicators }: { pillar: Pillar; indicators: Indicator[] } = $props();
</script>

<section class="pillar p-{pillar.id}" aria-labelledby="p-{pillar.id}">
  <h2 id="p-{pillar.id}"><span class="dot" aria-hidden="true"></span>{pillar.name}</h2>
  <div class="grid">
    {#each indicators as ind (ind.id)}
      <Tile {ind} />
    {/each}
  </div>
</section>

<style>
  .pillar {
    margin-top: 34px;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 4px 16px;
    font-size: 1.1875rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--pillar-ink);
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  @media (min-width: 700px) {
    .grid {
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 20px;
    }
  }
</style>
