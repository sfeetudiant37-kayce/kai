/* ============================================================
   kernel.js — noyau applicatif
   config · logger · bus d'événements
   ============================================================ */

export const CONFIG = Object.freeze({
  appName: 'Kai',
  version: '2.0.0',
  storageKey: 'kai.state.v2',
  legacyStorageKey: 'kai.state.v1',
  dbName: 'kai-db',
  locale: 'fr-FR',
  currency: 'FCFA',
  // Endpoint de synchronisation (compte optionnel). null = désactivé.
  syncEndpoint: null,
});

/* ---------- logger structuré ---------- */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
let threshold = LEVELS.info;

export const log = {
  setLevel(name) { threshold = LEVELS[name] ?? LEVELS.info; },
  debug(...a) { if (threshold <= LEVELS.debug) console.debug('[kai:debug]', ...a); },
  info(...a) { if (threshold <= LEVELS.info) console.info('%c[kai]', 'color:#5E6AD2', ...a); },
  warn(...a) { if (threshold <= LEVELS.warn) console.warn('[kai]', ...a); },
  error(...a) { if (threshold <= LEVELS.error) console.error('[kai]', ...a); },
};

/* ---------- bus d'événements (découplage des modules) ---------- */
const listeners = new Map();

export const bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => bus.off(event, fn);
  },
  off(event, fn) { listeners.get(event)?.delete(fn); },
  emit(event, payload) {
    for (const fn of (listeners.get(event) ?? [])) {
      try { fn(payload); } catch (e) { log.error('bus listener', event, e); }
    }
  },
};
