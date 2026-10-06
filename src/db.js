/* ============================================================
   db.js — couche infrastructure : IndexedDB + migrations
   Pattern : repository + versioned migrations (comme en backend).
   ============================================================ */

import { CONFIG, log } from './kernel.js';

/* ---------- migrations (versionnées, testables) ---------- */
export const MIGRATIONS = [
  {
    version: 1,
    up(db) {
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('checkins')) db.createObjectStore('checkins', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('log')) db.createObjectStore('log', { keyPath: 'id' });
    },
  },
  {
    version: 2,
    up(db) {
      if (!db.objectStoreNames.contains('incomes')) db.createObjectStore('incomes', { keyPath: 'id' });
    },
  },
];

export const DB_VERSION = MIGRATIONS.length;
let _db = null;

export function openDB() {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      if (_db) return resolve(_db);
      const req = indexedDB.open(CONFIG.dbName, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const from = e.oldVersion;
        for (const m of MIGRATIONS) {
          if (m.version > from) { m.up(db); log.info('migration appliquée', m.version); }
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => { log.error('openDB', req.error); resolve(null); };
    } catch (e) { log.error('openDB', e); resolve(null); }
  });
}

function tx(store, mode, fn) {
  return new Promise((resolve, reject) => {
    if (!_db) return resolve(null);
    try {
      const t = _db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req ? req.result : null);
      t.onerror = () => reject(t.error);
    } catch (e) { reject(e); }
  });
}

/* ---------- repository générique ---------- */
export async function dbSet(key, value) { await openDB(); return tx('kv', 'readwrite', s => s.put(value, key)); }
export async function dbGet(key) { await openDB(); return tx('kv', 'readonly', s => s.get(key)); }
export async function dbAppend(store, value) { await openDB(); return tx(store, 'readwrite', s => s.put(value)); }
export async function dbAll(store) { await openDB(); return (await tx(store, 'readonly', s => s.getAll())) ?? []; }
export async function dbDelete(store, id) { await openDB(); return tx(store, 'readwrite', s => s.delete(id)); }
export async function dbWipe() {
  await openDB();
  for (const s of ['kv', 'checkins', 'log', 'incomes']) {
    try { await tx(s, 'readwrite', st => st.clear()); } catch { /* store absent */ }
  }
}

/* ---------- santé (comme un vrai service) ---------- */
export async function healthCheck() {
  await openDB();
  return {
    db: _db ? 'ok' : 'unavailable',
    version: DB_VERSION,
    app: CONFIG.appName + ' ' + CONFIG.version,
  };
}
