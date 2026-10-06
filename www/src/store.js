/* ============================================================
   store.js — persistance de l'état
   miroir localStorage (boot instantané) + IndexedDB (source de vérité)
   ============================================================ */

import { CONFIG, log } from './kernel.js';
import { defaultState } from './model.js';
import { dbSet, dbGet, dbAppend, dbWipe } from './db.js';

const KEY = CONFIG.storageKey;
const LEGACY = CONFIG.legacyStorageKey;

const mem = {};
const ls = globalThis.localStorage ?? {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; },
};

function mergeDefaults(st) {
  const base = defaultState();
  return {
    ...base, ...st,
    profile: { ...base.profile, ...st.profile },
    settings: { ...base.settings, ...st.settings, account: { ...base.settings.account, ...(st.settings?.account || {}) } },
    finances: { ...base.finances, ...st.finances, goals: { ...base.finances.goals, ...(st.finances?.goals || {}) } },
  };
}

export function load() {
  try {
    // migration silencieuse v1 → v2
    const rawV1 = ls.getItem(LEGACY);
    const raw = ls.getItem(KEY) || rawV1;
    if (!raw) return defaultState();
    const st = mergeDefaults(JSON.parse(raw));
    if (!ls.getItem(KEY)) { ls.setItem(KEY, JSON.stringify(st)); ls.removeItem(LEGACY); }
    return st;
  } catch (e) { log.error('load', e); return defaultState(); }
}

export async function restoreFromDB() {
  try {
    const saved = await dbGet('state');
    if (!saved?.profile) return null;
    const mirrored = ls.getItem(KEY);
    const mirrorTime = mirrored ? (JSON.parse(mirrored).savedAt || '') : '';
    return (saved.savedAt || '') >= mirrorTime ? mergeDefaults(saved) : null;
  } catch { return null; }
}

export function save(st) {
  st.savedAt = new Date().toISOString();
  ls.setItem(KEY, JSON.stringify(st));
  try {
    dbSet('state', st);
    for (const c of (st.checkins || []).slice(-50)) dbAppend('checkins', c);
    for (const l of (st.rerouteLog || []).slice(-50)) dbAppend('log', l);
    for (const i of (st.finances?.incomes || [])) dbAppend('incomes', i);
  } catch (e) { log.debug('save/db', e); }
  return st;
}

export function exportBackup(st) {
  return JSON.stringify({ app: 'kai', schema: st.version, exportedAt: new Date().toISOString(), state: st }, null, 2);
}

export function importBackup(json) {
  const parsed = JSON.parse(json);
  const st = parsed.state ?? parsed;
  if (!st.tasks || !st.profile) throw new Error('Fichier invalide');
  return save(mergeDefaults(st));
}

export function resetAll() {
  ls.removeItem(KEY);
  ls.removeItem(LEGACY);
  try { dbWipe(); } catch { }
  return defaultState();
}
