<script lang="ts">
  import { directionText } from "../lib/format";
  import { app } from "../lib/state.svelte";
  import type { Direction } from "../lib/types";
  import Icon from "./Icon.svelte";

  // A thin green rail beside a chart: the arrow and the strongest green sit at the
  // "better" end (top when higher is better, bottom when lower is better).
  let { direction }: { direction: Direction } = $props();
</script>

{#if direction !== "neutral"}
  <div class="rail {direction}" role="img" aria-label={directionText(direction, app.t)} title={directionText(direction, app.t)}>
    <Icon name={direction === "higher" ? "arrowUp" : "arrowDown"} />
    <span class="bar"></span>
  </div>
{/if}

<style>
  .rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 14px;
    height: 100%;
    color: var(--good);
  }

  .rail.lower {
    flex-direction: column-reverse;
  }

  .rail :global(.ic) {
    width: 13px;
    height: 13px;
    stroke-width: 2;
    flex: none;
  }

  .bar {
    flex: 1;
    width: 5px;
    min-height: 6px;
    border-radius: 3px;
    background: linear-gradient(var(--good), transparent);
    opacity: 0.7;
  }

  .lower .bar {
    background: linear-gradient(transparent, var(--good));
  }
</style>
