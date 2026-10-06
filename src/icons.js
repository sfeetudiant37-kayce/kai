/* ============================================================
   icons.js — jeu d'icônes SVG inline (grille 20px, trait 1.8)
   Un seul langage visuel — aucune émoji dans l'interface.
   ============================================================ */

const svg = (paths, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  today: s => svg('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/><circle cx="12" cy="15.5" r="1.6" fill="currentColor" stroke="none"/>', s),
  calendar: s => svg('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>', s),
  chart: s => svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', s),
  wallet: s => svg('<rect x="2" y="6" width="20" height="14" rx="3"/><path d="M2 10h20M16 15h3"/><circle cx="16.5" cy="15" r="1" fill="currentColor" stroke="none"/>', s),
  settings: s => svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>', s),
  plus: s => svg('<path d="M12 5v14M5 12h14"/>', s),
  bell: s => svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7"/><path d="M10 19a2 2 0 0 0 4 0"/>', s),
  moon: s => svg('<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/>', s),
  sun: s => svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>', s),
  check: s => svg('<path d="M20 6 9 17l-5-5"/>', s),
  clock: s => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', s),
  move: s => svg('<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>', s),
  lock: s => svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', s),
  user: s => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/>', s),
  flame: s => svg('<path d="M12 22c4.4 0 8-3.6 8-8 0-3-2-6-4-8 0 2-1 3-2 3-1-3-3-5-6-7 1 4-4 6-4 12 0 4.4 3.6 8 8 8Z"/>', s),
  cloud: s => svg('<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 6 18.7"/><path d="M12 12v8M9 17l3 3 3-3"/>', s),
  download: s => svg('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', s),
  trash: s => svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>', s),
  arrowL: s => svg('<path d="M15 18l-6-6 6-6"/>', s),
  arrowR: s => svg('<path d="M9 6l6 6-6 6"/>', s),
  close: s => svg('<path d="M6 6l12 12M18 6 6 18"/>', s),
  target: s => svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>', s),
  book: s => svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>', s),
  briefcase: s => svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>', s),
};
