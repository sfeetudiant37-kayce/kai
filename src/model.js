/* ============================================================
   model.js — modèle du domaine
   entités · utilitaires date/heure · état par défaut · seeds
   Pur module : testable sous Node, aucun DOM.
   ============================================================ */

/* ---------- utilitaires date/heure ---------- */
export function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
export function toHM(min) {
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60), m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
export function isoOf(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}
export function todayISO(now = new Date()) { return isoOf(now); }
export function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); }
export function addMonths(iso, n) { const d = parseISO(iso); d.setMonth(d.getMonth() + n); return isoOf(d); }
export function dayOfWeek(iso) { return parseISO(iso).getDay(); } // 0 = dimanche
export function weekDates(iso) {
  const dow = dayOfWeek(iso);
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(iso, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export function weekKey(iso) { return weekDates(iso)[0]; }
export function monthKey(iso) { return iso.slice(0, 7); }
export function daysInMonth(year, month /* 1-12 */) { return new Date(year, month, 0).getDate(); }
export function frDay(iso) {
  return ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dayOfWeek(iso)];
}
export function frShort(iso) {
  const d = parseISO(iso);
  return frDay(iso).slice(0, 3) + '. ' + d.getDate() + ' ' +
    ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][d.getMonth()];
}
export function frMonth(year, month /* 0-11 */) {
  return ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][month];
}
export function fmtDur(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return (h ? h + 'h' : '') + (m ? String(m).padStart(h ? 2 : 1, '0') : h ? '' : '0');
}
export function fmtMoney(amount, currency = 'FCFA') {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(amount)) + ' ' + currency;
}
export function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- domaines de vie ---------- */
export const DOMAINS = [
  { id: 'foi', label: 'Foi' },
  { id: 'corps', label: 'Corps' },
  { id: 'ecriture', label: 'Écriture' },
  { id: 'apprentissage', label: 'Apprentissage' },
  { id: 'kaydigi', label: 'Kaydigi' },
  { id: 'lecture', label: 'Lecture' },
  { id: 'amis', label: 'Amis' },
];

export const SERVICES = [
  { id: 'dev', label: 'Développement web' },
  { id: 'cm', label: 'Community management' },
  { id: 'design', label: 'Design' },
  { id: 'redaction', label: 'Rédaction' },
];

/* ---------- état par défaut : la vie réelle de Kayliah ---------- */
export function defaultState() {
  return {
    version: 2,
    profile: {
      name: 'Kayliah',
      workWeek: { start: '08:30', end: '18:00' },
      workSat: { start: '09:00', end: '14:00' },
      homeBy: '19:00',
      church: { start: '08:00', end: '13:00' },
      sleep: { bedtime: '22:30', wakePlan: '05:00' },
      eveningRoutine: [
        { label: 'Repos en rentrant', start: '19:00', dur: 25, domain: 'corps' },
        { label: 'Manger', start: '19:25', dur: 35, domain: 'corps' },
        { label: 'Distraction (temps fermé)', start: '20:00', dur: 35, domain: 'corps' },
        { label: 'Se laver', start: '20:35', dur: 20, domain: 'corps' },
        { label: 'Prière + méditation', start: '20:55', dur: 25, domain: 'foi' },
        { label: 'Compte rendu du soir', start: '22:15', dur: 10, domain: 'corps' },
      ],
      eveningWork: { start: '21:20', end: '22:15' },
      saturdayFlex: 'perso',
      sundaySocial: false,
    },
    settings: {
      theme: 'auto', ringtone: true, language: 'fr', currency: 'FCFA',
      account: { mode: 'local', email: null }, // 'local' = aucun compte (comme Loop / Pedometer)
    },
    trajectories: [
      { id: 't-kaydigi', name: 'Kaydigi — logo → identité → offres → clients', horizonMonths: 18, milestones: [
        { title: 'Logo — première version', done: false },
        { title: 'Identité visuelle', done: false },
        { title: 'Offres (dev web, CM, design, rédaction)', done: false },
        { title: 'Portfolio', done: false },
        { title: 'Premier client payant', done: false },
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
    finances: {
      goals: { monthlyTarget: 50000, yearTarget: 600000 },
      incomes: [], // { id, date, client, service, amount, status: 'paid'|'pending', note }
    },
    tasks: [], occurrences: [], checkins: [], rerouteLog: [],
    patterns: { sleepLog: [], saturdayFlex: 'perso' },
    seeded: false,
  };
}

/* ---------- seeds : première semaine ---------- */
export function seedTasks(week) {
  const mk = (title, domain, criticality, duration, zonePref) => ({
    id: uid(), title, domain, criticality, duration, zonePref,
    week, status: 'todo', origin: 'weekly', deadline: null, note: '',
  });
  return [
    mk('Écrire 1 article Substack', 'ecriture', 2, 60, 'deep'),
    mk('Préparer 2 posts TikTok', 'ecriture', 2, 45, 'light'),
    mk('Logo kaydigi — première version', 'kaydigi', 2, 90, 'deep'),
    mk('Session UI/UX', 'apprentissage', 3, 60, 'deep'),
    mk('Session design graphique', 'apprentissage', 3, 60, 'deep'),
    mk('Marketing : 1 leçon', 'apprentissage', 3, 45, 'light'),
    mk('Software engineering : 1 leçon', 'apprentissage', 3, 45, 'light'),
    mk('Lire mon livre (1 chapitre)', 'lecture', 3, 30, 'light'),
    mk('Causer avec mes amies', 'amis', 3, 60, 'any'),
    mk('Étude biblique', 'foi', 2, 30, 'any'),
  ];
}

export function seedIncomes(today = todayISO()) {
  const mk = (date, client, service, amount, status) => ({
    id: uid(), date, client, service, amount, status, note: '',
  });
  const y = parseISO(today).getFullYear();
  return [
    mk(`${y}-07-12`, 'Cliente — site vitrine', 'dev', 75000, 'paid'),
    mk(`${y}-08-20`, 'Marque locale — posts Instagram', 'cm', 30000, 'paid'),
    mk(`${y}-09-15`, 'Logo pour artisan', 'design', 25000, 'paid'),
    mk(today, 'Article pour blog client', 'redaction', 15000, 'pending'),
  ];
}

export function taskStats(tasks) {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const partial = tasks.filter(t => t.status === 'partial').length;
  const skipped = tasks.filter(t => t.status === 'skipped').length;
  return { total, done, partial, skipped, pending: total - done - partial - skipped };
}
