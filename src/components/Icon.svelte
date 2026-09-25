<script lang="ts">
  import { ICONS } from "../lib/icons";

  let { name, class: cls = "" }: { name: string; class?: string } = $props();
</script>

<svg
  class="ic {cls}"
  viewBox="0 0 16 16"
  fill="none"
  stroke="currentColor"
  stroke-width="1.4"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <!-- static markup from ICONS, never user data -->
  {@html ICONS[name] ?? ""}
</svg>

<style>
  .ic {
    width: 16px;
    height: 16px;
    flex: none;
  }
</style>
