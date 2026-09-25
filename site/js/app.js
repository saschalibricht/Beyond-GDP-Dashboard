import { icon } from "./icons.js";
import { esc, fmt, fmtDate, directionText, THIS_YEAR } from "./format.js";
import { sparkline, lineChart } from "./charts.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const S = {
  reg: null, dash: null, status: null,
  a: null, b: null, view: "all", pins: new Set(),
  ind: new Map(), pillar: new Map(), tag: new Map(), country: new Map(),
};

// ------------------------------------------------------------------ loading
async function load(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

async function init() {
  initTheme();
  try {
    S.reg = await load("data/registry.json");
  } catch (e) {
    renderFatal();
    return;
  }
  S.dash = await load("data/dashboard.json").catch(() => null);
  S.status = await load("data/status.json").catch(() => null);
  for (const i of S.reg.indicators) S.ind.set(i.id, i);
  for (const p of S.reg.framework.pillars) S.pillar.set(p.id, p);
  for (const t of S.reg.tags) S.tag.set(t.id, t);
  for (const c of S.reg.countries) S.country.set(c.iso3, c);
  readState();
  setupControls();
  render();
  renderLegend();
  renderAbout();
  renderHealth();
  renderFooter();
}

// -------------------------------------------------------------------- state
function readState() {
  const q = new URLSearchParams(location.search);
  const valid = (c) => (c && S.country.has(c.toUpperCase()) ? c.toUpperCase() : null);
  S.a = valid(q.get("c")) || valid(S.reg.defaultCountry) || S.reg.countries[0]?.iso3;
  const vs = q.get("vs");
  S.b = vs === "none" ? null : valid(vs) || (q.has("c") ? null : valid(S.reg.defaultCompare));
  if (S.b === S.a) S.b = null;
  S.view = q.get("view") === "pinned" ? "pinned" : "all";
  let pins = q.get("pins");
  if (pins === null) { try { pins = localStorage.getItem("bgdp-pins"); } catch (e) { pins = null; } }
  S.pins = new Set((pins || "").split(",").filter((id) => S.ind.has(id)));
}

function writeState() {
  const q = new URLSearchParams();
  q.set("c", S.a);
  q.set("vs", S.b || "none");
  if (S.pins.size) q.set("pins", [...S.pins].join(","));
  if (S.view === "pinned") q.set("view", "pinned");
  history.replaceState(null, "", `${location.pathname}?${q}`);
  try { localStorage.setItem("bgdp-pins", [...S.pins].join(",")); } catch (e) { /* private mode */ }
}

// ------------------------------------------------------------------ theming
function initTheme() {
  let saved = "system";
  try { saved = localStorage.getItem("bgdp-theme") || "system"; } catch (e) { /* ignore */ }
  applyTheme(saved);
  for (const b of $$("[data-theme-choice]")) b.addEventListener("click", () => applyTheme(b.dataset.themeChoice, true));
}

function applyTheme(choice, save = false) {
  if (choice === "light" || choice === "dark") document.documentElement.dataset.theme = choice;
  else delete document.documentElement.dataset.theme;
  for (const b of $$("[data-theme-choice]")) b.setAttribute("aria-checked", String(b.dataset.themeChoice === choice));
  if (save) { try { localStorage.setItem("bgdp-theme", choice); } catch (e) { /* ignore */ } }
  // pillar ink colours differ in dark mode; re-render if already drawn
  if (S.reg) render();
}

function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => S.reg && render());

function pillarStyle(p) {
  return `--pillar:${p.color};--pillar-ink:${isDark() ? p.inkDark : p.ink}`;
}

// ----------------------------------------------------------------- controls
function setupControls() {
  const opts = S.reg.countries.map((c) => `<option value="${c.iso3}">${esc(c.name)}</option>`).join("");
  const selA = $("#country-a"), selB = $("#country-b");
  selA.innerHTML = opts;
  selB.innerHTML = `<option value="">No comparison</option>` + opts;
  selA.value = S.a;
  selB.value = S.b || "";
  selA.addEventListener("change", () => {
    S.a = selA.value;
    if (S.b === S.a) { S.b = null; selB.value = ""; }
    update();
  });
  selB.addEventListener("change", () => {
    S.b = selB.value && selB.value !== S.a ? selB.value : null;
    selB.value = S.b || "";
    update();
  });
  for (const b of $$("[data-view]")) b.addEventListener("click", () => { S.view = b.dataset.view; update(); });
  for (const b of $$("[data-open]")) b.addEventListener("click", () => openDialog(b.dataset.open));
  for (const d of $$("dialog")) {
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
  }
  $("#dashboard").addEventListener("click", (e) => {
    const pin = e.target.closest("[data-pin]");
    if (pin) { togglePin(pin.dataset.pin); return; }
    const open = e.target.closest("[data-detail]");
    if (open) openDetail(open.dataset.detail);
  });
}

function update() {
  writeState();
  render();
  renderFooter();
}

function togglePin(id) {
  if (S.pins.has(id)) S.pins.delete(id); else S.pins.add(id);
  update();
}

function openDialog(id) {
  const d = document.getElementById(id);
  if (!d.open) d.showModal();
  d.querySelector(".sheet-body").scrollTop = 0;
}

// ------------------------------------------------------------------ helpers
const entryFor = (id, iso3) => S.dash?.values?.[id]?.[iso3] || null;
const cname = (iso3) => S.country.get(iso3)?.name || iso3;

function tagPill(id, suffix = "") {
  const t = S.tag.get(id);
  if (!t) return "";
  return `<span class="tag tag-${id}" title="${esc(t.short)}">${icon(t.icon)}${esc(t.label)}${suffix ? ` <span class="num">${esc(suffix)}</span>` : ""}</span>`;
}

function stalePill(e, iso3) {
  if (!e?.stale) return "";
  const who = S.b ? ` ${iso3}` : "";
  return `<span class="tag tag-stale" title="${esc("Source could not be reached; showing the last value retrieved. " + (e.stale.reason || ""))}">${icon("stale")}Not updated since ${esc(fmtDate(e.stale.since))}${esc(who)}</span>`;
}

function tagsFor(ind, entries) {
  // entries: [[iso3, entry]]; tags that apply to only one of two countries get its code
  const order = S.reg.tags.map((t) => t.id);
  const sets = entries.map(([, e]) => new Set(e?.tags || ind.tags || []));
  const all = [...new Set(sets.flatMap((s) => [...s]))].sort((x, y) => order.indexOf(x) - order.indexOf(y));
  const pills = all.map((t) => {
    if (entries.length < 2) return tagPill(t);
    const has = entries.filter((_, i) => sets[i].has(t)).map(([iso]) => iso);
    return tagPill(t, has.length === entries.length ? "" : has.join(" "));
  });
  for (const [iso, e] of entries) pills.push(stalePill(e, iso));
  pills.push(`<span class="tag tier" title="Tier in the report's annex: I = established and widely produced, II = established method but not yet regularly produced">${icon("tier")}Tier ${esc(ind.tier)}</span>`);
  return pills.join("");
}

function missingBlock(e, iso3, compact = false) {
  const status = e?.status || "pending";
  const map = {
    no_data: ["No data", (e?.notes || [])[0] || `The source has no value for ${cname(iso3)}.`, ""],
    not_applicable: ["Not applicable", (e?.notes || [])[0] || "Not computed for this country.", "na"],
    source_error: ["Source unavailable", "The data source could not be reached and no earlier value is stored. It is retried daily.", "err"],
    pending: ["Not fetched yet", "This country was added recently; values appear after the next data update.", ""],
  };
  const [title, text, cls] = map[status] || map.pending;
  if (compact) return `<span class="cmp-missing" title="${esc(text)}">${esc(title)}</span>`;
  return `<div class="missing ${cls}"><strong>${esc(title)}</strong><span>${esc(text)}</span></div>`;
}

function isOk(e) { return e && e.status === "ok" && e.latest; }

function yearChip(year) {
  const old = THIS_YEAR - year > (S.reg.outdatedAfterYears || 3);
  return `<span class="year${old ? " old" : ""}" title="${old ? "More than " + (S.reg.outdatedAfterYears || 3) + " years old" : "Year of latest value"}">${year}</span>`;
}

function barScale(ind, vals) {
  if (ind.scale) return ind.scale;
  const max = Math.max(...vals.map(Math.abs), 0);
  return [Math.min(0, ...vals), max * 1.15 || 1];
}

function compareWarnings(ind, ea, eb) {
  if (!isOk(ea) || !isOk(eb)) return [];
  const w = [];
  if (Math.abs(ea.latest.year - eb.latest.year) >= 2) w.push(`Different years: ${ea.latest.year} vs ${eb.latest.year}`);
  if (ea.src !== eb.src || ea.proxy !== eb.proxy) w.push("Different sources, compare with care");
  const wa = ea.meta?.welfare, wb = eb.meta?.welfare;
  if (wa && wb && wa !== wb) w.push(`${S.a} measures ${wa}, ${S.b} ${wb}`);
  return w;
}

// -------------------------------------------------------------------- tiles
function tile(ind) {
  const p = S.pillar.get(ind.pillar);
  const ea = entryFor(ind.id, S.a);
  const pinned = S.pins.has(ind.id);
  let body;
  if (S.b) body = compareBody(ind, ea, entryFor(ind.id, S.b));
  else body = singleBody(ind, ea);
  const entries = S.b ? [[S.a, ea], [S.b, entryFor(ind.id, S.b)]] : [[S.a, ea]];
  return `<article class="tile" style="${pillarStyle(p)}">
    <p class="tile-domain">${esc(p.domains.find((d) => d.id === ind.domain)?.name || "")}</p>
    <div class="tile-top">
      <h4><button type="button" data-detail="${ind.id}" aria-haspopup="dialog">${esc(ind.label)}</button></h4>
      <button type="button" class="pin" data-pin="${ind.id}" aria-pressed="${pinned}" title="${pinned ? "Unpin" : "Pin to compare"}">
        ${icon(pinned ? "pinFilled" : "pin")}<span class="visually-hidden">${pinned ? "Unpin" : "Pin"} ${esc(ind.label)}</span>
      </button>
    </div>
    <p class="tile-expl">${esc(ind.explanation)}</p>
    ${body}
    <div class="tags">${tagsFor(ind, entries)}</div>
  </article>`;
}

function singleBody(ind, e) {
  if (!isOk(e)) return missingBlock(e, S.a);
  const l = e.latest;
  const range = typeof l.lo === "number" && typeof l.hi === "number" ? `<span class="unit num" title="Uncertainty range">${fmt(l.lo, ind.decimals)}–${fmt(l.hi, ind.decimals)}</span>` : "";
  return `<div>
      <div class="value-row"><span class="value">${fmt(l.value, ind.decimals)}</span><span class="unit">${esc(ind.unitShort || ind.unit)}</span>${yearChip(l.year)}</div>
      ${range}
    </div>
    <div class="value-meta"><span class="direction">${esc(directionText(ind.direction))}</span>${sparkline(e.series)}</div>`;
}

function compareBody(ind, ea, eb) {
  const vals = [ea, eb].filter(isOk).map((e) => e.latest.value);
  const [lo, hi] = barScale(ind, vals);
  const pct = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo || 1)) * 100));
  const warn = compareWarnings(ind, ea, eb);
  let better = null;
  if (vals.length === 2 && ind.direction !== "neutral" && !warn.some((w) => w.startsWith("Different sources")) && ea.latest.value !== eb.latest.value) {
    const aBetter = ind.direction === "higher" ? ea.latest.value > eb.latest.value : ea.latest.value < eb.latest.value;
    better = aBetter ? S.a : S.b;
  }
  const row = (iso3, e, c) => {
    const val = isOk(e)
      ? `${better === iso3 ? `<span class="better" title="${esc(directionText(ind.direction))}">better</span>` : ""}${fmt(e.latest.value, ind.decimals)}<small>${e.latest.year}</small>`
      : missingBlock(e, iso3, true);
    return `<div class="cmp-row" style="--c:var(--${c})" title="${esc(cname(iso3))}">
        <span class="cmp-iso">${iso3}</span><span class="unit">${isOk(e) ? esc(ind.unitShort || "") : ""}</span><span class="cmp-val">${val}</span>
        <span class="bar">${isOk(e) ? `<span style="width:${pct(e.latest.value).toFixed(1)}%"></span>` : ""}</span>
      </div>`;
  };
  return `<div class="cmp">${row(S.a, ea, "a")}${row(S.b, eb, "b")}</div>
    ${warn.map((w) => `<div class="cmp-warn">${icon("warn")}${esc(w)}</div>`).join("")}
    <div class="direction">${esc(directionText(ind.direction))}</div>`;
}

// --------------------------------------------------------------- dashboard
function render() {
  const root = $("#dashboard");
  $("#pin-count").textContent = S.pins.size;
  for (const b of $$("[data-view]")) b.setAttribute("aria-checked", String(b.dataset.view === S.view));
  document.body.classList.toggle("comparing", !!S.b);
  renderBanner();
  if (!S.dash || !S.dash.values || !Object.keys(S.dash.values).length) {
    root.innerHTML = "";
    return;
  }
  const visible = (i) => !i.hidden && (S.view === "all" || S.pins.has(i.id));
  let html = "";
  for (const p of S.reg.framework.pillars) {
    const inds = S.reg.indicators.filter((i) => i.pillar === p.id && visible(i));
    if (!inds.length) continue;
    html += `<section class="pillar" style="${pillarStyle(p)}" aria-labelledby="p-${p.id}">
      <header class="pillar-head"><div class="pillar-band"></div><div class="pillar-text">
        <h2 id="p-${p.id}">${esc(p.name)}</h2>
        <p>${esc(p.justification)}</p>
        <p class="pillar-ref">${p.domains.length} domains: ${p.domains.map((d) => esc(d.name)).join(", ")}. Report: ${esc(p.ref)}</p>
      </div></header>`;
    const ordered = p.domains.flatMap((d) => inds.filter((i) => i.domain === d.id));
    html += `<div class="grid">${ordered.map(tile).join("")}</div>`;
    html += `</section>`;
  }
  if (!html) {
    html = `<div class="banner banner-empty"><h2>No pinned indicators yet</h2><p>Use the pin button on any tile to collect the indicators you want to compare, then switch back here.</p></div>`;
  }
  root.innerHTML = html;
}

function renderBanner() {
  const el = $("#banner");
  if (!S.dash || !S.dash.values || !Object.keys(S.dash.values).length) {
    el.innerHTML = `<div class="banner banner-empty"><h2>No data yet</h2>
      <p>The data update runs automatically every day. To fetch data now, open the repository on GitHub, go to <strong>Actions → Update data</strong> and choose <strong>Run workflow</strong>. The site refreshes by itself once the run has finished.</p></div>`;
    return;
  }
  el.innerHTML = S.dash.demo
    ? `<div class="banner banner-demo">${icon("warn")}<span><strong>Demo data.</strong> These values are random placeholders for previewing the layout. Run the data update to replace them with real figures.</span></div>`
    : "";
}

function renderFatal() {
  $("#dashboard").innerHTML = `<div class="banner banner-empty"><h2>The dashboard could not load its configuration</h2>
    <p>The file <code>data/registry.json</code> is missing. Run the data update once (GitHub → Actions → Update data → Run workflow) or <code>python -m etl.build</code> locally.</p></div>`;
}

// ------------------------------------------------------------------ detail
function openDetail(id) {
  const ind = S.ind.get(id);
  const p = S.pillar.get(ind.pillar);
  const d = p.domains.find((x) => x.id === ind.domain);
  const countries = S.b ? [[S.a, "a"], [S.b, "b"]] : [[S.a, "a"]];
  const lines = countries.map(([iso, cls]) => ({ series: entryFor(id, iso)?.series || [], cls, label: cname(iso) }));
  const secondary = ind.secondary ? S.ind.get(ind.secondary) : null;

  const facts = countries.map(([iso, cls]) => {
    const e = entryFor(id, iso);
    const src = isOk(e) ? ind.sources[e.src] : null;
    let inner;
    if (isOk(e)) {
      const sec = secondary && isOk(entryFor(secondary.id, iso))
        ? `<div class="unit">${esc(secondary.label)}: <span class="num">${fmt(entryFor(secondary.id, iso).latest.value, secondary.decimals)}</span> ${esc(secondary.unitShort)} (${entryFor(secondary.id, iso).latest.year})</div>` : "";
      inner = `<div class="big">${fmt(e.latest.value, ind.decimals)} <span class="unit">${esc(ind.unit)}</span></div>
        <div class="unit">Latest year: ${e.latest.year}${e.latest.nature ? `, source flag “${esc(e.latest.nature)}”${/^(E|M)$/i.test(e.latest.nature) ? " (estimate)" : ""}` : ""}</div>${sec}
        <div class="unit">Source: ${src?.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.label)}</a>` : esc(src?.label || "")}</div>
        ${e.stale ? `<div class="cmp-warn" style="margin-top:6px">${icon("stale")}Not updated since ${esc(fmtDate(e.stale.since))}: source unreachable</div>` : ""}`;
    } else {
      inner = missingBlock(e, iso);
    }
    const notes = (e?.notes || []).filter((n, i) => isOk(e) || i > 0);
    return `<div class="fact" style="--c:var(--${cls})"><div class="fact-head">${esc(cname(iso))}</div>${inner}
      ${notes.length ? `<ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</div>`;
  }).join("");

  const usedTags = new Set(countries.flatMap(([iso]) => entryFor(id, iso)?.tags || ind.tags || []));
  const tagInfo = S.reg.tags.filter((t) => usedTags.has(t.id))
    .map((t) => `<li>${tagPill(t.id)}<p>${esc(t.long)}</p></li>`).join("");

  $("#detail-body").innerHTML = `
    <div class="sheet-head" style="${pillarStyle(p)}">
      <div style="flex:1"><div class="eyebrow">${esc(p.name)}, ${esc(d?.name || "")}</div><h2 id="detail-title">${esc(ind.label)}</h2></div>
      <button type="button" class="close" data-close aria-label="Close">${icon("close")}</button>
    </div>
    <div style="${pillarStyle(p)}">
      <p>${esc(ind.explanation)}</p>
      <p class="report-wording">Report indicator: ${esc(ind.name)}</p>
      ${lineChart(lines, ind)}
      <div class="legend-row">${countries.map(([iso, cls]) => `<span style="--c:var(--${cls})">${esc(cname(iso))}</span>`).join("")}
        <em class="legend-note">Faded points are estimates. ${esc(directionText(ind.direction))}.</em></div>
      <div class="facts">${facts}</div>
      <h3>Limitations</h3>
      <p>${esc(ind.limitations)}</p>
      ${tagInfo ? `<ul class="taglist">${tagInfo}</ul>` : ""}
      <h3>Why ${esc(d?.name || "this domain")} matters</h3>
      <p>${esc(d?.why || "")} ${esc(ind.why || "")}</p>
      <dl class="kv">
        <dt>Unit</dt><dd>${esc(ind.unit)}</dd>
        <dt>Report tier</dt><dd>Tier ${esc(ind.tier)} ${ind.tier === "I" ? "(established, regularly produced)" : "(established method, not yet regularly produced)"}</dd>
        ${ind.sdg ? `<dt>SDG indicator</dt><dd>${esc(ind.sdg)}</dd>` : ""}
        <dt>Report reference</dt><dd>Table 1, Annex; ${esc(p.ref)}</dd>
        <dt>Sources, in order of use</dt><dd>${ind.sources.map((s) => `${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}${s.proxy ? " (substitute)" : ""}`).join("<br>")}</dd>
      </dl>
    </div>`;
  openDialog("detail-dialog");
}

// -------------------------------------------------------- legend / about
function renderLegend() {
  const tags = S.reg.tags.map((t) => `<li>${tagPill(t.id)}<p>${esc(t.long)}</p></li>`).join("");
  $("#legend-body").innerHTML = `
    <div class="sheet-head"><h2 id="legend-title">How to read this dashboard</h2><button type="button" class="close" data-close aria-label="Close">${icon("close")}</button></div>
    <p>Each tile is one indicator from the report's proposed dashboard, grouped and coloured by the four components of its framework. Select a tile's title for the full explanation, a time series and all source details. Pin tiles to build your own comparison set.</p>
    <h3>Limitation tags</h3>
    <p>The same tags appear on every affected tile. They describe the data, not the country.</p>
    <ul class="taglist">${tags}
      <li><span class="tag tag-stale">${icon("stale")}Not updated since…</span><p>The source could not be reached in the latest daily check. The last value retrieved is shown until the source works again.</p></li>
      <li><span class="tag tier">${icon("tier")}Tier I / II</span><p>The report's own classification. Tier I: established methods and regular data for at least half of countries. Tier II: established methods, but not yet regularly produced.</p></li>
    </ul>
    <h3>Missing values</h3>
    <p>Nothing is hidden or filled in. A hatched tile says why a value is missing: <strong>No data</strong> (the source does not cover this country), <strong>Not applicable</strong> (e.g. the global multidimensional poverty index is not computed for high-income countries), or <strong>Source unavailable</strong> (the source could not be reached and no earlier value exists).</p>
    <h3>Comparing countries</h3>
    <p>Choose a second country to see both values side by side. Bars share one scale per tile. A “better” label follows the indicator's direction and is left out when the two values come from different sources. Warnings appear when the latest years differ by two or more years, when the sources differ, or when one survey measures income and the other consumption.</p>
    <p>The year shown is the year the data refer to, not when they were published. Years more than ${S.reg.outdatedAfterYears} years old are highlighted.</p>`;
}

function renderAbout() {
  const f = S.reg.framework;
  $("#about-body").innerHTML = `
    <div class="sheet-head"><h2 id="about-title">About</h2><button type="button" class="close" data-close aria-label="Close">${icon("close")}</button></div>
    <p>This dashboard implements the indicator set proposed in <a href="${esc(f.report.url)}" target="_blank" rel="noopener"><em>${esc(f.report.title)}</em></a>, the ${f.report.year} report of the ${esc(f.report.publisher)}. The report asks countries to measure progress as equitable, inclusive and sustainable well-being, complementing rather than replacing GDP.</p>
    <p>It is an independent prototype built only from openly available data. It is not produced or endorsed by the United Nations.</p>
    <h3>Structure</h3>
    <p>${f.pillars.map((p) => `<strong style="color:${isDark() ? p.inkDark : p.ink}">${esc(p.name)}</strong>`).join(", ")}: the four components of the report's dashboard (Figure 3, Table 1), with the report's 31 indicators. Where the report's exact indicator is not openly available, a clearly tagged substitute is shown.</p>
    <h3>Deliberately not shown</h3>
    ${f.notIncluded.map((n) => `<p><strong>${esc(n.name)}.</strong> ${esc(n.text)} <span class="unit">(${esc(n.ref)})</span></p>`).join("")}
    <h3>How the data are updated</h3>
    <p>An automated job checks every source once a day and publishes any new values. Most sources release new figures only once a year or less, so values change rarely. If a source fails, the last good value stays visible and is marked. See <button type="button" class="link-btn" data-open-health>source health</button> for the status of each source.</p>`;
  $("#about-body [data-open-health]").addEventListener("click", () => { $("#about-dialog").close(); openDialog("health-dialog"); });
}

function sourceSummary() {
  const src = S.status?.sources || [];
  const required = src.filter((s) => !s.optional && s.status !== "disabled");
  const failing = required.filter((s) => s.status === "error").length;
  return { total: required.length, failing };
}

function renderHealth() {
  const src = (S.status?.sources || []).slice().sort((x, y) => (x.status === "error" ? -1 : 0) - (y.status === "error" ? -1 : 0) || x.provider.localeCompare(y.provider));
  const label = { ok: "Working", error: "Failing", disabled: "Not configured" };
  const rows = src.map((s) => `<tr>
      <td><span class="status-dot ${s.status === "error" ? "err" : s.status === "disabled" ? "warn" : ""}"></span>${label[s.status] || s.status}${s.consecutiveFailures ? ` <span class="unit">(${s.consecutiveFailures}×)</span>` : ""}</td>
      <td>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}${s.optional ? ' <span class="unit">optional</span>' : ""}${s.error ? `<br><code>${esc(s.error)}</code>` : ""}</td>
      <td>${s.indicators.map((i) => esc(S.ind.get(i)?.label || i)).join(", ")}</td>
      <td class="num">${esc(fmtDate(s.lastSuccess))}</td></tr>`).join("");
  $("#health-body").innerHTML = `
    <div class="sheet-head"><h2 id="health-title">Source health</h2><button type="button" class="close" data-close aria-label="Close">${icon("close")}</button></div>
    <p>Last check: ${esc(fmtDate(S.status?.lastChecked))}. Data last changed: ${esc(fmtDate(S.status?.lastChanged))}. A failing source keeps its last good values on the dashboard; after three failed days an alert is raised automatically.</p>
    <div class="table-wrap"><table class="health"><thead><tr><th>Status</th><th>Source</th><th>Used for</th><th>Last success</th></tr></thead><tbody>${rows || `<tr><td colspan="4">No status available yet.</td></tr>`}</tbody></table></div>`;
}

function renderFooter() {
  const { total, failing } = sourceSummary();
  const dot = failing ? (failing > total / 3 ? "err" : "warn") : "";
  $("#footer").innerHTML = `
    <p><span class="status-dot ${dot}"></span>Checked daily. Last check ${esc(fmtDate(S.status?.lastChecked))}, data last changed ${esc(fmtDate(S.status?.lastChanged))}.
      <button type="button" class="link-btn" id="health-link">${total ? `${total - failing} of ${total} sources working` : "Source health"}</button></p>
    <p>Independent prototype based on the UN High-Level Expert Group on Beyond GDP report (2026). Not affiliated with the United Nations. Data belong to their respective publishers.</p>`;
  $("#health-link").addEventListener("click", () => openDialog("health-dialog"));
}

init();
