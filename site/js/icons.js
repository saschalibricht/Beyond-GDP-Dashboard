// Small inline icon set (stroke icons, 16x16 grid). Kept local: no icon font, no network request.
const P = {
  clock: '<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.6"/>',
  model: '<path d="M2 12.5c2-5 4-7 6-7s4 2 6 7"/><circle cx="8" cy="5.5" r="1.2"/><path d="M2 14h12"/>',
  survey: '<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/><path d="M5 6.2h6M5 8.2h4"/>',
  repeat: '<path d="M3 6.5a5 5 0 0 1 8.6-2.4L13 5.5"/><path d="M13 2.5v3h-3"/><path d="M13 9.5a5 5 0 0 1-8.6 2.4L3 10.5"/><path d="M3 13.5v-3h3"/>',
  globe: '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.8 2 2.6 4 2.6 6S9.8 12 8 14M8 2C6.2 4 5.4 6 5.4 8S6.2 12 8 14"/>',
  swap: '<path d="M3 5.5h9.5L10 3M13 10.5H3.5L6 13"/>',
  scale: '<path d="M8 2.5v11M4 13.5h8M3 5h10"/><path d="M3 5l-1.8 4.2a1.9 1.9 0 0 0 3.6 0zM13 5l-1.8 4.2a1.9 1.9 0 0 0 3.6 0z"/>',
  pin: '<path d="M6 2.5h4l-.6 4 2.6 2.2v1.3H4v-1.3l2.6-2.2z"/><path d="M8 10v3.5"/>',
  pinFilled: '<path d="M6 2.5h4l-.6 4 2.6 2.2v1.3H4v-1.3l2.6-2.2z" fill="currentColor"/><path d="M8 10v3.5"/>',
  warn: '<path d="M8 2.2l6.2 11H1.8z"/><path d="M8 6.5v3M8 11.3v.2"/>',
  close: '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>',
  stale: '<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9"/><path d="M2.5 2.5v2.5H5"/><path d="M8 5.5V8l1.8 1.2"/>',
  tier: '<path d="M2.5 8.8l5.3-5.3h5.7v5.7l-5.3 5.3z"/><circle cx="10.6" cy="6.4" r=".9"/>',
  link: '<path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M11.5 9.5v4h-9v-9h4"/>',
};

export function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ""}</svg>`;
}
