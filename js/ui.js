/* ============================================================
   ui.js — helpers d'interface : toast, sheet, anneau, icônes
   ============================================================ */

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function toast(msg, ms = 3800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t.__timer);
  t.__timer = setTimeout(() => t.classList.add('hidden'), ms);
}

export function sheet(html) {
  $('#sheet').innerHTML = html;
  $('#sheet').classList.remove('hidden');
  $('#sheet-backdrop').classList.remove('hidden');
}
export function closeSheet() {
  $('#sheet').classList.add('hidden');
  $('#sheet-backdrop').classList.add('hidden');
}

/** Anneau de progression (SVG, accessibilité : rôle + label). */
export function ringSVG(pct) {
  const r = 40, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `
    <svg class="ring-svg" viewBox="0 0 100 100" role="img" aria-label="Progression ${Math.round(pct * 100)}%">
      <circle class="ring-bg" cx="50" cy="50" r="${r}" fill="none" stroke-width="10"/>
      <circle class="ring-fg" cx="50" cy="50" r="${r}" fill="none" stroke-width="10"
        stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 50 50)"/>
      <text x="50" y="56" text-anchor="middle" font-size="22" font-weight="800" fill="var(--text)">${Math.round(pct * 100)}%</text>
    </svg>`;
}

/** Jauge simple (capacité, trajectoires). */
export function meter(ratio, cls = '') {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return `<div class="meter ${cls}"><div style="width:${pct}%"></div></div>`;
}

/** Icônes inline (style Lucide, grille 24). */
export const ICON = {
  check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  move: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
};

export function domainChip(domainId, label) {
  return `<span class="chip"><span class="dot" style="background:${domainColorSafe(domainId)}"></span>${label || domainId}</span>`;
}
function domainColorSafe(id) {
  const map = {
    foi: 'var(--domain-foi)', corps: 'var(--domain-corps)', ecriture: 'var(--domain-ecriture)',
    apprentissage: 'var(--domain-apprentissage)', kaydigi: 'var(--domain-kaydigi)',
    lecture: 'var(--domain-lecture)', amis: 'var(--domain-amis)',
  };
  return map[id] || 'var(--domain-fixed)';
}

export function critChip(n) {
  if (n === 1) return `<span class="chip n1">${ICON.lock} N1 · jamais déplacée</span>`;
  if (n === 2) return `<span class="chip n2">N2 · protégée</span>`;
  return `<span class="chip n3">N3 · souple</span>`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
