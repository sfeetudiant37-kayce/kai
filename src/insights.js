/* ============================================================
   insights.js — agrégations : finances + statistiques
   Pur module : testable sous Node. Aucun DOM.
   Tout ce qui alimente les graphiques passe par ici.
   ============================================================ */

import { toMin, todayISO, parseISO, isoOf, addDays, weekDates, weekKey, monthKey, daysInMonth, dayOfWeek } from './model.js';

/* ================= FINANCES ================= */

export function incomesOfYear(state, year) {
  return (state.finances?.incomes || []).filter(i => i.date.startsWith(String(year)));
}

export function incomeTotal(list, status /* 'paid'|'pending'|undefined=all */) {
  return list.filter(i => !status || i.status === status)
    .reduce((a, i) => a + Number(i.amount || 0), 0);
}

export function monthIncome(state, ym /* 'YYYY-MM' */) {
  return incomeTotal((state.finances?.incomes || []).filter(i => i.date.startsWith(ym)));
}

export function yearIncome(state, year) {
  return incomeTotal(incomesOfYear(state, year));
}

/** Revenus par mois (12 mois de l'année demandée). */
export function incomeByMonth(state, year) {
  return Array.from({ length: 12 }, (_, m) => {
    const ym = `${year}-${String(m + 1).padStart(2, '0')}`;
    return { month: m, ym, total: monthIncome(state, ym) };
  });
}

/** Revenus par service (année en cours ou liste fournie). */
export function incomeByService(state, list) {
  const src = list || incomesOfYear(state, new Date().getFullYear());
  const map = {};
  for (const i of src) map[i.service] = (map[i.service] || 0) + Number(i.amount || 0);
  return Object.entries(map).map(([service, total]) => ({ service, total }))
    .sort((a, b) => b.total - a.total);
}

/** KPIs financiers du tableau de bord. */
export function financeKPIs(state, now = new Date()) {
  const year = now.getFullYear();
  const ym = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const list = incomesOfYear(state, year);
  const paidYear = incomeTotal(list, 'paid');
  const pendingYear = incomeTotal(list, 'pending');
  const month = monthIncome(state, ym);
  const monthsElapsed = now.getMonth() + 1;
  const avg = monthsElapsed ? paidYear / monthsElapsed : 0;
  const projection = avg * 12;
  const goals = state.finances?.goals || { monthlyTarget: 0, yearTarget: 0 };
  return {
    month, paidYear, pendingYear, avg, projection, goals,
    monthProgress: goals.monthlyTarget ? month / goals.monthlyTarget : 0,
    yearProgress: goals.yearTarget ? paidYear / goals.yearTarget : 0,
  };
}

/** Revenus par jour (pour la vue calendrier). */
export function incomeDays(state, ym) {
  const map = {};
  for (const i of (state.finances?.incomes || [])) {
    if (!i.date.startsWith(ym)) continue;
    map[i.date] = (map[i.date] || 0) + Number(i.amount || 0);
  }
  return map;
}

/* ================= STATISTIQUES ================= */

/** Minutes réalisées (tâches faites) pour une date. */
export function doneMinutes(state, iso) {
  return state.occurrences
    .filter(o => o.date === iso && (o.state === 'done'))
    .reduce((a, o) => a + (toMin(o.end) - toMin(o.start)), 0);
}

export function plannedMinutes(state, iso) {
  return state.occurrences
    .filter(o => o.date === iso && o.state !== 'moved')
    .reduce((a, o) => a + (toMin(o.end) - toMin(o.start)), 0);
}

/** Données du heatmap (nb de semaines) : [{date, value 0-4}]. */
export function heatmap(state, nWeeks = 16, today = todayISO()) {
  const end = weekDates(today)[6];
  const start = addDays(end, -(nWeeks * 7 - 1));
  const out = [];
  for (let iso = start; iso <= end; iso = addDays(iso, 1)) {
    const mins = doneMinutes(state, iso);
    const value = mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 120 ? 3 : 4;
    out.push({ date: iso, value, minutes: mins });
  }
  return out;
}

/** Série des heures faites par semaine (n dernières semaines). */
export function weeklyDoneSeries(state, n = 12, today = todayISO()) {
  const thisMon = weekKey(today);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const mon = addDays(thisMon, -7 * i);
    const days = weekDates(mon);
    const done = days.reduce((a, d) => a + doneMinutes(state, d), 0);
    const planned = days.reduce((a, d) => a + plannedMinutes(state, d), 0);
    out.push({ week: mon, done: Math.round(done / 6) / 10, planned: Math.round(planned / 6) / 10 }); // heures, 1 décimale
  }
  return out;
}

/** Heures par domaine pour une semaine. */
export function domainHours(state, dates) {
  const map = {};
  for (const iso of dates) {
    for (const o of state.occurrences) {
      if (o.date !== iso || o.state === 'moved') continue;
      const t = state.tasks.find(t => t.id === o.taskId);
      if (!t) continue;
      map[t.domain] = (map[t.domain] || 0) + (toMin(o.end) - toMin(o.start));
    }
  }
  return Object.entries(map).map(([domain, minutes]) => ({ domain, hours: Math.round(minutes / 6) / 10 }))
    .sort((a, b) => b.hours - a.hours);
}

/** Série de jours consécutifs avec ≥1 tâche faite. */
export function streak(state, today = todayISO()) {
  let n = 0;
  let iso = today;
  for (let i = 0; i < 400; i++) {
    const mins = doneMinutes(state, iso);
    if (mins > 0) { n++; iso = addDays(iso, -1); }
    else if (i === 0) { iso = addDays(iso, -1); } // aujourd'hui pas encore fini : on ne casse pas
    else break;
  }
  return n;
}

/** Charge du mois (tâches + fixation) pour la vue mensuelle. */
export function monthLoad(state, year, month /* 1-12 */) {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  let planned = 0, done = 0;
  for (const o of state.occurrences) {
    if (!o.date.startsWith(ym) || o.state === 'moved') continue;
    const mins = toMin(o.end) - toMin(o.start);
    planned += mins;
    if (o.state === 'done') done += mins;
  }
  return { planned, done };
}

/** Progression d'une trajectoire (0-1). */
export function trajectoryProgress(tr) {
  if (!tr.milestones.length) return 0;
  return tr.milestones.filter(m => m.done).length / tr.milestones.length;
}
