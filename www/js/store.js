/* ============================================================
   store.js — couche de données offline-first (localStorage)
   Pur module : testable sous Node, aucun DOM.
   ============================================================ */

const KEY = 'kai.state.v1';

/* ---------- petits utilitaires date/heure (purs) ---------- */
export function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
export function toHM(min) {
  min = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60), m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
export function isoOf(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}
export function todayISO(now = new Date()) { return isoOf(now); }
export function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); }
export function dayOfWeek(iso) { return parseISO(iso).getDay(); } // 0=dimanche
export function weekDates(iso) { // lundi → dimanche contenant 'iso'
  const dow = dayOfWeek(iso);
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(iso, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export function weekKey(iso) { return weekDates(iso)[0]; } // la semaine est identifiée par son lundi
export function frDay(iso) {
  return ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dayOfWeek(iso)];
}
export function frShort(iso) {
  const d = parseISO(iso);
  return frDay(iso).slice(0, 3) + '. ' + d.getDate() + ' ' +
    ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][d.getMonth()];
}
export function fmtDur(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return (h ? h + 'h' : '') + (m ? String(m).padStart(h ? 2 : 1, '0') : h ? '' : '0');
}

export function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- domaines de vie (la couleur porte le sens) ---------- */
export const DOMAINS = [
  { id: 'foi', label: 'Foi', color: 'var(--domain-foi)' },
  { id: 'corps', label: 'Corps', color: 'var(--domain-corps)' },
  { id: 'ecriture', label: 'Écriture', color: 'var(--domain-ecriture)' },
  { id: 'apprentissage', label: 'Apprentissage', color: 'var(--domain-apprentissage)' },
  { id: 'kaydigi', label: 'Kaydigi', color: 'var(--domain-kaydigi)' },
  { id: 'lecture', label: 'Lecture', color: 'var(--domain-lecture)' },
  { id: 'amis', label: 'Amis', color: 'var(--domain-amis)' },
];
export function domainColor(id) {
  return (DOMAINS.find(d => d.id === id) || { color: 'var(--domain-fixed)' }).color;
}

/* ---------- état par défaut : MA VIE RÉELLE (maison intelligente) ---------- */
export function defaultState() {
  return {
    version: 1,
    profile: {
      name: 'Kayliah',
      // travail
      workWeek: { start: '08:30', end: '18:00' },   // lundi → vendredi
      workSat: { start: '09:00', end: '14:00' },    // samedi
      homeBy: '19:00',                              // rentrée 19h max
      // foi
      church: { start: '08:00', end: '13:00' },     // dimanche
      // sommeil
      sleep: { bedtime: '22:30', wakePlan: '05:00' },
      // routine du soir (critical times) — 19h → coucher
      eveningRoutine: [
        { label: 'Repos en rentrant', start: '19:00', dur: 25, domain: 'corps' },
        { label: 'Manger', start: '19:25', dur: 35, domain: 'corps' },
        { label: 'Distraction (temps fermé)', start: '20:00', dur: 35, domain: 'corps' },
        { label: 'Se laver', start: '20:35', dur: 20, domain: 'corps' },
        { label: 'Prière + méditation', start: '20:55', dur: 25, domain: 'foi' },
        { label: 'Compte rendu du soir (N1)', start: '22:15', dur: 10, domain: 'corps' },
      ],
      eveningWork: { start: '21:20', end: '22:15' }, // zone perso du soir (~55 min)
      saturdayFlex: 'perso',   // 'perso' | 'mi-temps' | 'sortie' (sortie avec mes amies)
      sundaySocial: false,     // dimanche après-midi avec des amis ?
    },
    settings: { ringtone: true, weekStart: 1, language: 'fr' },
    // trajectoires longues (semaines → mois → années)
    trajectories: [
      { id: 't-kaydigi', name: 'Kaydigi (logo → identité → offres → clients)', horizonMonths: 18, milestones: [
        { title: 'Logo — première version', done: false },
        { title: 'Identité visuelle', done: false },
        { title: 'Offres écrites (dev web, CM, design, rédaction)', done: false },
        { title: 'Portfolio', done: false },
        { title: 'Premier client', done: false },
      ]},
      { id: 't-foi', name: 'Grandir en Christ', horizonMonths: 0, milestones: [
        { title: 'Prière + méditation chaque jour', done: false },
        { title: 'Église chaque dimanche', done: false },
      ]},
      { id: 't-design', name: 'UI/UX + design graphique', horizonMonths: 12, milestones: [
        { title: 'Fondamentaux UI/UX', done: false },
        { title: 'Premier projet design', done: false },
      ]},
      { id: 't-blog', name: 'Blog Substack + TikTok', horizonMonths: 12, milestones: [
        { title: 'Premier article publié', done: false },
        { title: 'Premier post TikTok', done: false },
        { title: 'Régularité 4 semaines', done: false },
      ]},
      { id: 't-dev', name: 'Software engineering', horizonMonths: 12, milestones: [
        { title: 'JS avancé', done: false },
        { title: 'Premier projet perso publié', done: false },
      ]},
    ],
    tasks: [], occurrences: [], checkins: [], rerouteLog: [],
    patterns: { sleepLog: [], saturdayFlex: 'perso' },
    seeded: false,
  };
}

/* ---------- exemples de weekly achievements (première semaine) ---------- */
export function seedTasks(week) {
  const mk = (title, domain, criticality, duration, zonePref) => ({
    id: uid(), title, domain, criticality, duration, zonePref,
    week, status: 'todo', origin: 'weekly', deadline: null, note: '',
  });
  return [
    mk('Écrire 1 article Substack', 'ecriture', 2, 60, 'deep'),
    mk('Préparer 2 posts TikTok (mes écrits)', 'ecriture', 2, 45, 'light'),
    mk('Logo kaydigi — première version', 'kaydigi', 2, 90, 'deep'),
    mk('Session UI/UX (cours)', 'apprentissage', 3, 60, 'deep'),
    mk('Session design graphique', 'apprentissage', 3, 60, 'deep'),
    mk('Marketing : 1 leçon', 'apprentissage', 3, 45, 'light'),
    mk('Software engineering : 1 leçon', 'apprentissage', 3, 45, 'light'),
    mk('Lire mon livre (1 chapitre)', 'lecture', 3, 30, 'light'),
    mk('Causer avec mes amies', 'amis', 3, 60, 'any'),
    mk('Étude biblique', 'foi', 2, 30, 'any'),
  ];
}

/* ---------- persistance ---------- */
const mem = {};
const ls = globalThis.localStorage ?? {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; },
};

// la vraie base = IndexedDB (db.js) ; localStorage sert de miroir de démarrage instantané
import { dbSet, dbGet, dbAppend, dbWipe } from './db.js';

export function load() {
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return defaultState();
    const st = JSON.parse(raw);
    // fusion défensive avec les défauts (les champs ajoutés plus tard existent toujours)
    const base = defaultState();
    return { ...base, ...st, profile: { ...base.profile, ...st.profile }, settings: { ...base.settings, ...st.settings } };
  } catch { return defaultState(); }
}

/** Restaure depuis la vraie base (IndexedDB) si elle est plus fraîche que le miroir. */
export async function restoreFromDB() {
  try {
    const saved = await dbGet('state');
    if (!saved) return null;
    const mirrored = ls.getItem(KEY);
    const mirrorTime = mirrored ? (JSON.parse(mirrored).savedAt || '') : '';
    if ((saved.savedAt || '') >= mirrorTime) return saved;
    return null;
  } catch { return null; }
}

export function save(st) {
  st.savedAt = new Date().toISOString();
  ls.setItem(KEY, JSON.stringify(st));           // miroir instantané
  try {
    dbSet('state', st);                           // vraie base (IndexedDB)
    for (const c of (st.checkins || [])) dbAppend('checkins', c);
    for (const l of (st.rerouteLog || [])) dbAppend('log', l);
  } catch { /* hors navigateur */ }
  return st;
}
export function exportBackup(st) {
  return JSON.stringify({ app: 'kai', exportedAt: new Date().toISOString(), state: st }, null, 2);
}
export function importBackup(json) {
  const parsed = JSON.parse(json);
  const st = parsed.state ?? parsed;
  if (!st.tasks || !st.profile) throw new Error('Fichier invalide');
  return save(st);
}
export function resetAll() {
  ls.removeItem(KEY);
  try { dbWipe(); } catch { }
  return defaultState();
}

/* ---------- compteurs rapides ---------- */
export function taskStats(tasks) {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const partial = tasks.filter(t => t.status === 'partial').length;
  const skipped = tasks.filter(t => t.status === 'skipped').length;
  return { total, done, partial, skipped, pending: total - done - partial - skipped };
}
