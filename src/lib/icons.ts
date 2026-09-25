// Inline stroke icons on a 16×16 grid: no icon font, no network request.
// Tag icons are referenced by name from config/tags.json.
export const ICONS: Record<string, string> = {
  clock: '<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.6"/>',
  model: '<path d="M2 12.5c2-5 4-7 6-7s4 2 6 7"/><circle cx="8" cy="5.5" r="1.2"/><path d="M2 14h12"/>',
  survey: '<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/><path d="M5 6.2h6M5 8.2h4"/>',
  repeat:
    '<path d="M3 6.5a5 5 0 0 1 8.6-2.4L13 5.5"/><path d="M13 2.5v3h-3"/><path d="M13 9.5a5 5 0 0 1-8.6 2.4L3 10.5"/><path d="M3 13.5v-3h3"/>',
  globe: '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.8 2 2.6 4 2.6 6S9.8 12 8 14M8 2C6.2 4 5.4 6 5.4 8S6.2 12 8 14"/>',
  swap: '<path d="M3 5.5h9.5L10 3M13 10.5H3.5L6 13"/>',
  scale: '<path d="M8 2.5v11M4 13.5h8M3 5h10"/><path d="M3 5l-1.8 4.2a1.9 1.9 0 0 0 3.6 0zM13 5l-1.8 4.2a1.9 1.9 0 0 0 3.6 0z"/>',
  pin: '<path d="M6 2.5h4l-.6 4 2.6 2.2v1.3H4v-1.3l2.6-2.2z"/><path d="M8 10v3.5"/>',
  pinFilled: '<path d="M6 2.5h4l-.6 4 2.6 2.2v1.3H4v-1.3l2.6-2.2z" fill="currentColor"/><path d="M8 10v3.5"/>',
  warn: '<path d="M8 2.2l6.2 11H1.8z"/><path d="M8 6.5v3M8 11.3v.2"/>',
  stale: '<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9"/><path d="M2.5 2.5v2.5H5"/><path d="M8 5.5V8l1.8 1.2"/>',
  close: '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>',
  link: '<path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M11.5 9.5v4h-9v-9h4"/>',
  sun: '<circle cx="8" cy="8" r="2.8"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>',
  moon: '<path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z"/>',
  auto: '<circle cx="8" cy="8" r="5.8"/><path d="M8 2.2v11.6A5.8 5.8 0 0 0 8 2.2z" fill="currentColor"/>',
  check: '<path d="M3.5 8.3l2.9 2.9 6.1-6.4"/>',
  chevron: '<path d="M4.5 6.5 8 10l3.5-3.5"/>',
  exchange: '<path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  help: '<circle cx="8" cy="8" r="6.2"/><path d="M6.3 6.3a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.8.6-.8 1.1v.3M8 11.4v.2"/>',
  info: '<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.8v.2"/>',
  table: '<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.5h12M2 9.8h12M6.5 6.5V13"/>',
};
