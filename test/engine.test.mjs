/* ============================================================
   test/engine.test.mjs — le chauffeur sous tous ses angles
   Exécution : node test/engine.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import {
  zonesForDate, fixedBlocksForDate, capacityMinutes, requestedMinutes,
  placeWeek, findAlternatives, reroute, sleepDebt,
} from '../src/engine.js';
import { defaultState, seedTasks, weekDates, todayISO, toMin, addDays, weekKey } from '../src/model.js';

const st = defaultState();
const LUNDI = '2026-09-28';   // lundi
const SAMEDI = '2026-10-03';
const DIMANCHE = '2026-10-04';
const semaine = weekDates(LUNDI);

let passed = 0;
const ok = (name, fn) => {
  try { fn(); passed++; console.log('  ✅', name); }
  catch (e) { console.error('  ❌', name, '\n     ', e.message); process.exitCode = 1; }
};

console.log('\n— Zones & blocs fixes (maison intelligente) —');

ok('Lundi : matin bonus + soir', () => {
  const z = zonesForDate(LUNDI, st);
  const labels = z.map(x => x.label);
  assert.ok(labels.includes('Matin bonus'), 'manque le matin bonus');
  assert.ok(labels.includes('Soir'), 'manque la zone du soir');
  const m = z.find(x => x.label === 'Matin bonus');
  assert.equal(m.start, '05:00');           // réveil 5h
  assert.ok(toMin(m.end) <= toMin('07:45')); // départ au travail
});

ok('Lundi : blocs fixes = travail, trajet, routine, coucher', () => {
  const f = fixedBlocksForDate(LUNDI, st).map(b => b.label);
  assert.ok(f.includes('Travail'));
  assert.ok(f.includes('Trajet / rentrée'));
  assert.ok(f.includes('Prière + méditation'));
  assert.ok(f.includes('Coucher'));
});

ok('Samedi flex : perso → zone, sortie avec mes amies → aucune zone', () => {
  const perso = zonesForDate(SAMEDI, st);
  assert.ok(perso.some(z => z.label === 'Samedi perso'));
  const st2 = defaultState();
  st2.profile.saturdayFlex = 'sortie';
  assert.equal(zonesForDate(SAMEDI, st2).length, 0, 'en sortie il ne doit rien rester');
});

ok('Dimanche : église + entrée hebdo fixes, deep work l\'après-midi', () => {
  const f = fixedBlocksForDate(DIMANCHE, st).map(b => b.label);
  assert.ok(f.includes('Église'));
  assert.ok(f.includes('Entrée hebdo + revue (Kai)'));
  const z = zonesForDate(DIMANCHE, st);
  assert.ok(z.some(x => x.label === 'Dimanche'));
});

console.log('\n— Placement de la semaine —');

ok('placeWeek : aucune double réservation, tout dans les zones', () => {
  const tasks = seedTasks(weekKey(LUNDI));
  const res = placeWeek(tasks, st, semaine, [], null);
  assert.equal(res.occurrences.length, tasks.length, 'tout devrait être placé');
  // pas de chevauchement entre occurrences
  for (const d of semaine) {
    const day = res.occurrences.filter(o => o.date === d).sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < day.length; i++) {
      assert.ok(day[i].start >= day[i - 1].end, `chevauchement le ${d} : ${day[i - 1].start}-${day[i - 1].end} vs ${day[i].start}-${day[i].end}`);
    }
    // pas de chevauchement avec les blocs fixes
    for (const o of day) {
      for (const f of fixedBlocksForDate(d, st)) {
        const clash = toMin(o.start) < toMin(f.end) && toMin(f.start) < toMin(o.end);
        assert.ok(!clash, `« ${o.taskId} » entre dans le bloc fixe ${f.label} le ${d}`);
      }
    }
  }
});

ok('Détection de surcharge : 25h demandées vs capacité réelle', () => {
  const tasks = Array.from({ length: 12 }, (_, i) => ({
    id: 't' + i, title: 'T' + i, domain: 'kaydigi', criticality: 3,
    duration: 240, zonePref: 'any', week: weekKey(LUNDI), status: 'todo',
  }));
  const res = placeWeek(tasks, st, semaine, [], null);
  assert.ok(res.warnings.some(w => w.type === 'overload'), 'la surcharge doit être signalée');
  const cap = capacityMinutes(st, semaine);
  assert.ok(cap.total > 0 && cap.total < 60 * 60, 'capacité plausible');
  assert.equal(requestedMinutes(tasks), 12 * 240);
});

ok('Un ajout en milieu de semaine trouve un créneau sans collision', () => {
  const tasks = seedTasks(weekKey(LUNDI));
  const placed = placeWeek(tasks, st, semaine, [], null);
  const extra = { id: 'extra', title: 'Logo kaydigi', domain: 'kaydigi', criticality: 2, duration: 45, zonePref: 'deep', status: 'todo' };
  const res = placeWeek([extra], st, semaine, placed.occurrences, null);
  assert.equal(res.occurrences.length, 1);
  const o = res.occurrences[0];
  for (const p of placed.occurrences) {
    if (p.date !== o.date) continue;
    assert.ok(o.start >= p.end || o.end <= p.start, 'collision avec une tâche existante !');
  }
});

console.log('\n— Le chauffeur : re-route & impasse —');

ok('re-route : jusqu\'à 3 options, jours distincts, coût humain', () => {
  const tasks = seedTasks(weekKey(LUNDI));
  const placed = placeWeek(tasks, st, semaine, [], null);
  const t = tasks[0];
  const alts = findAlternatives(t, st, placed.occurrences, LUNDI, null, 3);
  assert.ok(alts.length > 0 && alts.length <= 3);
  const days = new Set(alts.map(a => a.date));
  assert.equal(days.size, alts.length, 'une option par jour');
  for (const a of alts) assert.ok(a.cost && a.label, 'chaque option porte un label et un coût');
});

ok('re-route automatique quand il reste de la place', () => {
  const tasks = seedTasks(weekKey(LUNDI));
  const placed = placeWeek(tasks, st, semaine, [], null);
  const res = reroute(tasks[0], st, placed.occurrences, LUNDI, null);
  assert.equal(res.decision, 'auto');
  assert.ok(res.chosen, 'le chauffeur choisit un chemin');
  assert.ok(res.text.includes('Collision évitée'), 'message du chauffeur attendu');
});

ok('Impasse totale → décision au BOSS', () => {
  // on remplit tout avec des blocs de 2h partout
  const stFull = defaultState();
  const occurrences = [];
  for (const d of semaine) {
    for (const z of zonesForDate(d, stFull, null)) {
      let s = toMin(z.start);
      const e = toMin(z.end);
      while (s < e) {
        const len = Math.min(120, e - s);
        occurrences.push({ id: `f@${d}${s}`, taskId: 'filler', date: d, start: hm(s), end: hm(s + len), state: 'planned' });
        s += len;
      }
    }
  }
  const task = { id: 'urgent', title: 'Tâche impossible', domain: 'kaydigi', criticality: 2, duration: 90, zonePref: 'deep' };
  const res = reroute(task, stFull, occurrences, LUNDI, null);
  assert.equal(res.decision, 'boss', 'sans chemin, la décision revient au boss');
  assert.equal(res.options.length, 0);
});
function hm(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }

console.log('\n— Règles humaines —');

ok('Dette de sommeil : <6h × 2 nuits → le chauffeur resserre', () => {
  const st2 = defaultState();
  st2.patterns.sleepLog = [
    { date: '2026-09-29', bed: '22:30', wake: '04:00', hours: 5.5 },
    { date: '2026-09-30', bed: '23:00', wake: '04:30', hours: 5.5 },
  ];
  const d = sleepDebt(st2);
  assert.equal(d.flag, true);
  assert.ok(d.note.includes('resserre'), 'le chauffeur doit annoncer qu\'il allège');
});

ok('Sommeil correct → pas d\'alarme', () => {
  const st2 = defaultState();
  st2.patterns.sleepLog = [
    { date: '2026-09-29', hours: 7.5 }, { date: '2026-09-30', hours: 7 },
  ];
  assert.equal(sleepDebt(st2).flag, false);
});

ok('Report (rollover) : rien ne meurt', () => {
  // logique simple : une tâche non faite est recopiée sur la semaine suivante
  const tasks = seedTasks(weekKey(LUNDI));
  tasks[0].status = 'skipped';
  const left = tasks.filter(t => t.status !== 'done');
  const next = weekKey(addDays(LUNDI, 7));
  const rolled = left.map(t => ({ ...t, id: t.id + '-r', week: next, status: 'todo' }));
  assert.equal(rolled.length, left.length);
  assert.ok(rolled.every(t => t.week === next));
});

console.log(`\n${passed} test(s) réussis.${process.exitCode ? ' — DES ÉCHECS ⚠️' : ' — tout est vert 🎉'}\n`);
