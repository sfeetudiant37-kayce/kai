/* ============================================================
   db.js — VRAIE base de données locale (IndexedDB)
   Stockage structuré, hors-ligne, rapide. Aucun serveur.
   (Sur mobile via Capacitor, cette interface se branche sur SQLite.)
   ============================================================ */

const DB_NAME = 'kai-db';
const DB_VERSION = 1;
let _db = null;

/** Ouvre (ou crée) la base. Fonctionne aussi sous Node (no-op). */
export function openDB() {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');            // état global, réglages
        if (!db.objectStoreNames.contains('checkins')) db.createObjectStore('checkins', { keyPath: 'id' }); // historique
        if (!db.objectStoreNames.contains('log')) db.createObjectStore('log', { keyPath: 'id' });          // reroute log
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
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

export async function dbSet(key, value) {
  await openDB();
  return tx('kv', 'readwrite', s => s.put(value, key));
}
export async function dbGet(key) {
  await openDB();
  return tx('kv', 'readonly', s => s.get(key));
}
export async function dbAppend(store, value) {
  await openDB();
  return tx(store, 'readwrite', s => s.put(value));
}
export async function dbAll(store) {
  await openDB();
  return tx(store, 'readonly', s => s.getAll()) ?? [];
}
export async function dbWipe() {
  await openDB();
  await tx('kv', 'readwrite', s => s.clear());
  await tx('checkins', 'readwrite', s => s.clear());
  await tx('log', 'readwrite', s => s.clear());
}
