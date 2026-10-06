/* ============================================================
   test/insights.test.mjs — finances & statistiques
   Exécution : node test/insights.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import {
  financeKPIs, incomeByMonth, incomeByService, incomeTotal, monthIncome,
  heatmap, weeklyDoneSeries, domainHours, streak, doneMinutes,
} from '../src/insights.js';
import { defaultState, seedTasks, weekDates, todayISO, toHM, addDays, weekKey, uid } from '../src/model.js';

let passed = 0;
const ok = (name, fn) => {
  try { fn(); passed++; console.log('  ✅', name); }
  catch (e) { console.error('  ❌', name, '\n     ', e.message); process.exitCode = 1; }
};

const st = defaultState();
st.finances.incomes = [
  { id: uid(), date: '2026-07-12', client: 'A', service: 'dev', amount: 75000, status: 'paid' },
  { id: uid(), date: '2026-08-20', client: 'B', service: 'cm', amount: 30000, status: 'paid' },
  { id: uid(), date: '2026-09-15', client: 'C', service: 'design', amount: 25000, status: 'paid' },
  { id: uid(), date: '2026-10-01', client: 'D', service: 'redaction', amount: 15000, status: 'pending' },
];

console.log('\n— Finances —');

ok('Totaux : année, mois, en attente', () => {
  assert.equal(incomeTotal(st.finances.incomes, 'paid'), 130000);
  assert.equal(monthIncome(st, '2026-08'), 30000);
  assert.equal(incomeTotal(st.finances.incomes, 'pending'), 15000);
});

ok('incomeByMonth : 12 mois, bonnes sommes', () => {
  const m = incomeByMonth(st, 2026);
  assert.equal(m.length, 12);
  assert.equal(m[6].total, 75000);   // juillet
  assert.equal(m[11].total, 0);      // décembre
});

ok('incomeByService : trié par montant décroissant', () => {
  const s = incomeByService(st, st.finances.incomes);
  assert.equal(s[0].service, 'dev');
  assert.equal(s[0].total, 75000);
  assert.equal(s.length, 4);
});

ok('financeKPIs : moyenne, projection, progression objectifs', () => {
  st.finances.goals = { monthlyTarget: 50000, yearTarget: 600000 };
  const k = financeKPIs(st, new Date(2026, 9, 1)); // 1er octobre 2026
  assert.equal(k.paidYear, 130000);
  assert.equal(k.month, 15000); // octobre = le pending compte dans le mois
  assert.ok(k.avg > 0 && k.projection > k.avg * 11);
  assert.ok(k.yearProgress > 0 && k.yearProgress < 1);
});

console.log('\n— Statistiques —');

ok('doneMinutes / heatmap', () => {
  const iso = todayISO();
  const wk = weekKey(iso);
  st.tasks.push(...seedTasks(wk));
  const occ = st.tasks.slice(0, 2).map((t, i) => ({
    id: t.id + '@x', taskId: t.id, date: iso, start: toHM(600 + i * 90), end: toHM(660 + i * 90), state: 'done',
  }));
  st.occurrences.push(...occ);
  assert.equal(doneMinutes(st, iso), 120);
  const hm = heatmap(st, 2);
  assert.equal(hm.length, 14);
  assert.ok(hm.some(d => d.value === 4), 'une journée à 120 min = niveau 4');
});

ok('weeklyDoneSeries : 12 points, heures cohérentes', () => {
  const s = weeklyDoneSeries(st, 12);
  assert.equal(s.length, 12);
  assert.ok(s[s.length - 1].done >= 0);
});

ok('domainHours : répartition par domaine', () => {
  const d = domainHours(st, weekDates(todayISO()));
  assert.ok(d.length >= 1);
  assert.ok(d[0].hours > 0);
});

ok('streak : ≥ 1 (aujourd\'hui compte)', () => {
  assert.ok(streak(st) >= 1);
});

console.log(`\n${passed} test(s) réussis.${process.exitCode ? ' — DES ÉCHECS ⚠️' : ' — tout est vert 🎉'}\n`);
