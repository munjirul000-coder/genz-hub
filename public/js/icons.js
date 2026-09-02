/* Bloom — premium monochrome icon set (inline SVG, inherits currentColor) */
(function () {
  'use strict';
  const G = window.GZ;

  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5"/>',
    explore: '<circle cx="12" cy="12" r="9"/><path d="m15.2 8.8-2 4.4-4.4 2 2-4.4z"/>',
    network: '<path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="9.5" cy="7" r="3.2"/><path d="M17 11.2A3.2 3.2 0 1 0 15.6 5"/><path d="M21 19v-1a4 4 0 0 0-3-3.8"/>',
    messages: '<path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5z"/>',
    bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>',
    groups: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5v-1a4.2 4.2 0 0 1 4.2-4.2h2.6a4.2 4.2 0 0 1 4.2 4.2v1"/><path d="M16.5 6.2a3.2 3.2 0 0 1 0 6"/><path d="M20.5 19.5v-1a4 4 0 0 0-2.6-3.7"/>',
    communities: '<circle cx="12" cy="12" r="9"/><path d="M3.2 9.5h17.6M3.2 14.5h17.6"/><path d="M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3"/>',
    business: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path d="M8.8 7.5V6a2 2 0 0 1 2-2h2.4a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/><path d="M10.5 12.5h3"/>',
    gaming: '<path d="M7.5 8h9a5 5 0 0 1 4.9 4.1l.5 3A3.4 3.4 0 0 1 18.6 19c-1 0-1.9-.5-2.5-1.3L15 16H9l-1.1 1.7c-.6.8-1.5 1.3-2.5 1.3a3.4 3.4 0 0 1-3.3-3.9l.5-3A5 5 0 0 1 7.5 8"/><path d="M7 11.5v2.2M5.9 12.6h2.2"/><circle cx="15.6" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="17.6" cy="14" r=".9" fill="currentColor" stroke="none"/>',
    events: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.4"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/><path d="M8 14h3"/>',
    saved: '<path d="M6.5 3.8h11a1.2 1.2 0 0 1 1.2 1.2v15l-6.7-4-6.7 4V5a1.2 1.2 0 0 1 1.2-1.2"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.6 14.2a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a1.9 1.9 0 1 1-3.8 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a1.9 1.9 0 1 1 0-3.8h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1A1.9 1.9 0 1 1 7.8 3.9l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.2a1.9 1.9 0 1 1 3.8 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a1.9 1.9 0 1 1 0 3.8h-.2a1.6 1.6 0 0 0-1.3.8"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.2a7.5 7.5 0 0 1 15 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    logout: '<path d="M10 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/><path d="m15 16 4-4-4-4M19 12H10"/>',
    theme: '<circle cx="12" cy="12" r="8.2"/><path d="M12 3.8v16.4" /><path d="M12 20.2a8.2 8.2 0 0 0 0-16.4" fill="currentColor" stroke="none" opacity=".85"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m14.5 5.5 4 4"/>',
    camera: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="12" cy="13.5" r="3.6"/><path d="M8.5 7 10 4.5h4L15.5 7"/>',
    send: '<path d="M4.5 12 20 4.5 15.5 20l-4-6.2z"/><path d="m11.5 13.8 8.5-9.3"/>',
    heart: '<path d="M12 20s-7.5-4.4-7.5-9.4A4.1 4.1 0 0 1 12 8.2a4.1 4.1 0 0 1 7.5 2.4C19.5 15.6 12 20 12 20"/>',
    comment: '<path d="M20 13.5a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5V6.5A2.5 2.5 0 0 1 7.5 4h10A2.5 2.5 0 0 1 20 6.5z"/>',
    repost: '<path d="M4 9V7.5A2.5 2.5 0 0 1 6.5 5H17l-2.5-2.5M20 15v1.5a2.5 2.5 0 0 1-2.5 2.5H7l2.5 2.5"/>',
    bookmark: '<path d="M6.5 3.8h11a1.2 1.2 0 0 1 1.2 1.2v15l-6.7-4-6.7 4V5a1.2 1.2 0 0 1 1.2-1.2"/>',
    fire: '<path d="M12 21c3.6 0 6-2.4 6-5.6 0-4-3.4-5.6-3.4-9.4-2 .9-3 2.6-3 4.6 0 .9-.6 1.4-1.2 1.4-.8 0-1.4-.7-1.4-2.2C7 11 6 12.7 6 15.4 6 18.6 8.4 21 12 21"/>',
    shield: '<path d="M12 3.5 19.5 6v6c0 4.3-3 7.4-7.5 8.8C7.5 19.4 4.5 16.3 4.5 12V6z"/><path d="m9.2 12.2 2 2 3.6-3.8"/>',
    more: '<circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    trash: '<path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"/><path d="M6.5 7.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-11.5"/>',
    flag: '<path d="M5.5 21V4.5s2-1 5-1 5 2 8 1v9c-3 1-5-1-8-1s-5 1-5 1"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2.4"/><circle cx="8.8" cy="10" r="1.6"/><path d="m4.5 17 4.8-4.4 3.4 3 2.6-2.2 4.2 3.6"/>',
    sparkle: '<path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z"/><path d="M18.5 4v3M20 5.5h-3"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.2 2.5 3.3 5.4 3.3 8.5S14.2 18 12 20.5C9.8 18 8.7 15.1 8.7 12S9.8 6 12 3.5"/>',
    target: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    briefcaseSm: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path d="M8.8 7.5V6a2 2 0 0 1 2-2h2.4a2 2 0 0 1 2 2v1.5"/>',
  };

  G.icon = function (name, size, extra) {
    const d = P[name];
    if (!d) return '';
    const s = size || 20;
    return `<svg class="ic ${extra || ''}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true" focusable="false">${d}</svg>`;
  };
  G.hasIcon = (n) => !!P[n];
})();
