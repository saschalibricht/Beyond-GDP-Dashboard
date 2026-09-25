<script lang="ts">
  import { app } from "../lib/state.svelte";

  const summary = $derived.by(() => {
    const req = (app.status?.sources ?? []).filter((s) => !s.optional && s.status !== "disabled");
    const failing = req.filter((s) => s.status === "error").length;
    return { total: req.length, failing, level: failing === 0 ? "ok" : failing > req.length / 3 ? "err" : "warn" };
  });
</script>

<footer class="wrap foot">
  <p>
    <span class="dot {summary.level}" aria-hidden="true"></span>{app.t.footer.checked(
      app.fmtDate(app.status?.lastChecked),
      app.fmtDate(app.status?.lastChanged),
    )}
    <button type="button" class="link-btn" onclick={() => (app.sheet = "health")}>
      {summary.total ? app.t.footer.working(summary.total - summary.failing, summary.total) : app.t.footer.health}
    </button>
  </p>
  <p>
    {app.t.footer.disclaimer}
  </p>
</footer>

<style>
  .foot {
    margin-top: 48px;
    padding-top: 20px;
    padding-bottom: max(env(safe-area-inset-bottom, 0px), 36px);
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 10px 32px;
    color: var(--muted);
    font-size: 0.8125rem;
  }

  p {
    max-width: 68ch;
  }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 7px;
    border-radius: 50%;
    background: var(--good);
    vertical-align: 1px;
  }

  .dot.warn {
    background: var(--warn);
  }

  .dot.err {
    background: var(--err);
  }
</style>
