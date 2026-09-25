<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  let {
    open,
    onclose,
    title,
    eyebrow = "",
    tone = "",
    children,
  }: {
    open: boolean;
    onclose: () => void;
    title: string;
    eyebrow?: string;
    /** pillar class, tints the sheet header */
    tone?: string;
    children: Snippet;
  } = $props();

  let dlg: HTMLDialogElement | undefined = $state();
  let body: HTMLDivElement | undefined = $state();
  const id = `sheet-${Math.random().toString(36).slice(2, 8)}`;

  // Swipe from the left edge to close. Deliberately without a visible hint: the sheet
  // just follows the finger, like the system back gesture.
  const EDGE = 32; // px from the left screen edge where a swipe may start
  let swipe: { x: number; y: number; t: number; dx: number; horizontal: boolean | null } | null = null;

  function setOffset(dx: number, animate: boolean) {
    if (!dlg) return;
    dlg.style.transition = animate ? "transform 0.22s ease-out" : "none";
    dlg.style.transform = dx ? `translateX(${dx}px)` : "";
  }

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    swipe = t && e.touches.length === 1 && t.clientX <= EDGE ? { x: t.clientX, y: t.clientY, t: e.timeStamp, dx: 0, horizontal: null } : null;
  }

  function onTouchMove(e: TouchEvent) {
    const t = e.touches[0];
    if (!swipe || !t) return;
    const dx = t.clientX - swipe.x;
    const dy = t.clientY - swipe.y;
    if (swipe.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      swipe.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
    }
    if (!swipe.horizontal) {
      swipe = null; // a vertical scroll that happened to start at the edge
      return;
    }
    swipe.dx = Math.max(0, dx);
    setOffset(swipe.dx, false);
  }

  function onTouchEnd(e: TouchEvent) {
    if (!swipe?.horizontal) {
      swipe = null;
      return;
    }
    const { dx, t } = swipe;
    swipe = null;
    const fast = dx / Math.max(1, e.timeStamp - t) > 0.5; // px per ms
    if (dx > Math.min(120, innerWidth * 0.3) || (fast && dx > 40)) {
      setOffset(innerWidth, true);
      setTimeout(() => dlg?.close(), 200);
    } else {
      setOffset(0, true);
    }
  }

  $effect(() => {
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      if (body) body.scrollTop = 0;
    } else if (!open && dlg.open) {
      dlg.close();
    }
    if (!open) setOffset(0, false);
  });
</script>

<dialog
  bind:this={dlg}
  class="sheet {tone}"
  aria-labelledby={id}
  onclose={() => {
    setOffset(0, false);
    onclose();
  }}
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
  ontouchcancel={() => {
    swipe = null;
    setOffset(0, true);
  }}
  onclick={(e) => {
    if (e.target === dlg) dlg?.close();
  }}
>
  {#if open}
    <div class="body" bind:this={body}>
      <header class="head">
        <div class="titles">
          {#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
          <h2 {id}>{title}</h2>
        </div>
        <button type="button" class="soft-btn" aria-label="Close" onclick={() => dlg?.close()}>
          <Icon name="close" />
        </button>
      </header>
      <div class="content">
        {@render children()}
      </div>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    border: 0;
    padding: 0;
    color: var(--ink);
    background: var(--page);
    border-radius: 26px;
    width: min(780px, calc(100vw - 32px));
    max-height: min(90vh, 940px);
    box-shadow: 0 30px 80px rgb(0 0 0 / 0.28);
  }

  dialog::backdrop {
    background: rgb(15 20 26 / 0.42);
    backdrop-filter: blur(3px);
  }

  dialog[open] {
    animation: rise 0.2s ease-out;
  }

  @keyframes rise {
    from {
      transform: translateY(14px);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }

  .body {
    overflow: auto;
    max-height: inherit;
    overscroll-behavior: contain;
  }

  .head {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 20px 22px 16px;
    background: var(--tile, var(--page));
  }

  .titles {
    flex: 1;
    min-width: 0;
  }

  .eyebrow {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--pillar-ink, var(--muted));
    margin-bottom: 4px;
  }

  h2 {
    font-size: 1.375rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .content {
    padding: 18px 22px 28px;
  }

  .content :global(h3) {
    font-size: 0.9375rem;
    font-weight: 700;
    margin: 22px 0 8px;
  }

  .content :global(p + p) {
    margin-top: 8px;
  }

  @media (max-width: 640px) {
    dialog {
      width: 100vw;
      max-width: 100vw;
      height: 100dvh;
      max-height: 100dvh;
      margin: 0;
      border-radius: 0;
    }

    .body {
      height: 100%;
      max-height: 100dvh;
    }

    .head {
      padding: max(env(safe-area-inset-top, 0px), 16px) 16px 14px;
    }

    .content {
      padding: 16px 16px max(env(safe-area-inset-bottom, 0px), 28px);
    }
  }
</style>
