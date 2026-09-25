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

  $effect(() => {
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      if (body) body.scrollTop = 0;
    } else if (!open && dlg.open) {
      dlg.close();
    }
  });
</script>

<dialog
  bind:this={dlg}
  class="sheet {tone}"
  aria-labelledby={id}
  onclose={onclose}
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
