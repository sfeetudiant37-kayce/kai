/* ============================================================
   ui.js — primitives d'interface (DOM minimaux, zéro dépendance)
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

export function applyTheme(theme) {
  const t = theme || 'auto';
  document.documentElement.dataset.theme = t;
  const ico = $('#theme-ico');
  if (ico) ico.dataset.mode = t;
}

/** Jauge horizontale (progression). */
export function progress(pct, cls = '') {
  const p = Math.max(0, Math.min(1, pct));
  return `<div class="progress"><div class="progress-fill ${cls}" style="width:${(p * 100).toFixed(1)}%"></div></div>`;
}

/** Anneau de progression. */
export function ringSVG(pct) {
  const r = 40, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `
    <svg class="ring-svg" viewBox="0 0 100 100" role="img" aria-label="Progression ${Math.round(pct * 100)}%">
      <circle class="ring-bg" cx="50" cy="50" r="${r}" fill="none" stroke-width="9"/>
      <circle class="ring-fg" cx="50" cy="50" r="${r}" fill="none" stroke-width="9"
        stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 50 50)"/>
      <text x="50" y="55" text-anchor="middle" font-size="21" font-weight="700" fill="var(--c-text)">${Math.round(pct * 100)}%</text>
    </svg>`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function domainDot(id) {
  return `<span class="dot dom-${escapeHtml(id)}"></span>`;
}
export function critChip(n) {
  if (n === 1) return `<span class="badge badge-n1">N1</span>`;
  if (n === 2) return `<span class="badge badge-n2">N2</span>`;
  return `<span class="badge badge-n3">N3</span>`;
}
