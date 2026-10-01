/* ============================================================
   engine.js — le chauffeur intelligent
   Moteur de placement + détection de collisions + re-route.
   Pur module : testable sous Node, aucun DOM.

   Rappel des règles (le contrat) :
   - N1 : jamais déplacées (blocs fixes de la vie réelle)
   - N2 : protégées — replanifiées uniquement avec notification
   - N3 : souples — glissent sans culpabilité
   - Le chauffeur RE-ROUTE d'abord, notifie, et ne vient voir
     le BOSS qu'en impasse totale.
   ============================================================ */

import { toMin, toHM, dayOfWeek, addDays, weekDates, frDay, frShort, fmtDur } from './store.js';

/* ============================================================
   1. Zones d'exécution & blocs fixes — MA VIE RÉELLE
   ============================================================ */

/** Blocs fixes affichés (critical times) pour une date ISO. */
export function fixedBlocksForDate(iso, st) {
  const dow = dayOfWeek(iso);
  const p = st.profile;
  const out = [];
  if (dow >= 1 && dow <= 5) {
    out.push({ label: 'Travail', start: p.workWeek.start, end: p.workWeek.end, locked: true, domain: null });
    out.push({ label: 'Trajet / rentrée', start: p.workWeek.end, end: p.homeBy, locked: true, domain: 'corps' });
    for (const b of p.eveningRoutine) {
      out.push({ label: b.label, start: b.start, end: toHM(toMin(b.start) + b.dur), locked: true, domain: b.domain });
    }
    out.push({ label: 'Coucher', start: p.sleep.bedtime, end: '23:59', locked: true, domain: 'corps' });
  } else if (dow === 6) {
    out.push({ label: 'Travail', start: p.workSat.start, end: p.workSat.end, locked: true, domain: null });
    out.push({ label: 'Trajet + repos', start: p.workSat.end, end: '15:30', locked: true, domain: 'corps' });
  } else {
    out.push({ label: 'Église', start: p.church.start, end: p.church.end, locked: true, domain: 'foi' });
    out.push({ label: 'Entrée hebdo + revue (Kai)', start: '15:00', end: '16:00', locked: true, domain: 'corps' });
  }
  return out;
}

/** Zones libres où les weekly achievements peuvent atterrir. */
export function zonesForDate(iso, st, nowMin = null) {
  const dow = dayOfWeek(iso);
  const p = st.profile;
  const zones = [];
  const push = (type, start, end, label) => {
    let s = toMin(start), e = toMin(end);
    if (nowMin !== null && dayIsToday(iso, nowMin, st)) s = Math.max(s, nowMin);
    if (e - s >= 15) zones.push({ type, start: toHM(s), end: toHM(e), label });
  };
  if (dow >= 1 && dow <= 5) {
    push('deep', p.sleep.wakePlan, '07:45', 'Matin bonus');
    push('light', p.eveningWork.start, p.eveningWork.end, 'Soir');
  } else if (dow === 6) {
    if (p.saturdayFlex === 'perso') push('deep', '15:30', '21:00', 'Samedi perso');
    else if (p.saturdayFlex === 'mi-temps') push('deep', '15:30', '18:00', 'Samedi perso');
    // 'sortie' (avec mes amies) → aucune zone, le chauffeur re-route ailleurs
  } else {
    if (!p.sundaySocial) push('deep', '16:00', '19:00', 'Dimanche');
  }
  return zones;
}

function dayIsToday(iso, nowMin, st) {
  // "aujourd'hui" = même date que l'horloge système ; nowMin = minutes depuis minuit
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  return iso === today;
}

/* ============================================================
   2. Capacité hebdomadaire (détection de surcharge)
   ============================================================ */
export function capacityMinutes(st, dates, nowMin = null) {
  let total = 0;
  const byDay = {};
  for (const d of dates) {
    const zm = zonesForDate(d, st, nowMin).reduce((a, z) => a + (toMin(z.end) - toMin(z.start)), 0);
    byDay[d] = zm;
    total += zm;
  }
  return { total, byDay };
}

export function requestedMinutes(tasks) {
  return tasks.reduce((a, t) => a + (t.duration || 0), 0);
}

/* ============================================================
   3. Placement de la semaine (l'entrée hebdo)
   ============================================================ */

const overlap = (s1, e1, s2, e2) => s1 < e2 && s2 < e1;

/** Fenêtres réellement libres = zones − (blocs fixes + déjà placé). */
function freeWindows(iso, st, placed, nowMin) {
  const busy = fixedBlocksForDate(iso, st).map(b => [toMin(b.start), toMin(b.end)]);
  for (const o of placed) {
    if (o.date === iso && o.state !== 'moved') busy.push([toMin(o.start), toMin(o.end)]);
  }
  const out = [];
  for (const z of zonesForDate(iso, st, nowMin)) {
    let s = toMin(z.start);
    const e = toMin(z.end);
    // découpe la zone contre les occupés (tri)
    const blockers = busy.filter(([bs, be]) => overlap(s, e, bs, be)).sort((a, b) => a[0] - b[0]);
    let cursor = s;
    for (const [bs, be] of blockers) {
      if (bs > cursor) out.push({ type: z.type, label: z.label, start: toHM(cursor), end: toHM(bs) });
      cursor = Math.max(cursor, be);
    }
    if (e > cursor) out.push({ type: z.type, label: z.label, start: toHM(cursor), end: toHM(e) });
  }
  return out;
}

/** Choisit le meilleur emplacement pour une tâche. Retourne null si rien. */
function bestSlot(task, st, dates, placed, domainByDay, nowMin, fromISO) {
  let best = null;
  for (const iso of dates) {
    if (fromISO && iso < fromISO) continue;
    for (const w of freeWindows(iso, st, placed, nowMin)) {
      const dur = Math.min(task.duration, toMin(w.end) - toMin(w.start));
      if (dur < 15) continue;
      const end = toMin(w.start) + dur;
      let score = 0;
      if (task.zonePref === 'any') score += 2;
      else if (task.zonePref === w.type) score += 3; else score += 0;
      // équilibre des domaines : moins ce domaine a déjà de minutes ce jour-là, mieux c'est
      score -= ((domainByDay[iso]?.[task.domain]) || 0) / 30;
      // on préfère les jours proches
      score -= dates.indexOf(iso) * 0.4;
      // les N2 veulent des zones deep un peu plus tôt dans la semaine
      if (task.criticality === 2 && w.type === 'deep') score += 0.5;
      const cand = { date: iso, start: w.start, end: toHM(end), zone: w.label, score };
      if (!best || cand.score > best.score) best = cand;
    }
  }
  return best;
}

/**
 * Place les tâches de la semaine. Ne renvoie que les NOUVELLES occurrences.
 * @param warnings: surcharge, tâches non placées (→ escalade au boss)
 */
export function placeWeek(tasks, st, dates, existing = [], nowMin = null) {
  const placed = [...existing];
  const warnings = [];
  const domainByDay = {};
  const cap = capacityMinutes(st, dates, nowMin);
  const req = requestedMinutes(tasks);
  if (req > cap.total) {
    warnings.push({
      type: 'overload', requested: req, capacity: cap.total,
      text: `Tes weekly achievements demandent ${fmtDur(req)}, ta semaine en offre ${fmtDur(cap.total)} — choisis, ou on en reporte.`,
    });
  }
  const ordered = [...tasks].sort((a, b) =>
    (a.criticality - b.criticality) ||
    ((a.deadline || '9999-99-99') < (b.deadline || '9999-99-99') ? -1 : 1) ||
    (b.duration - a.duration)
  );
  const newOnes = [];
  for (const t of ordered) {
    const slot = bestSlot(t, st, dates, placed, domainByDay, nowMin, null);
    if (!slot) {
      warnings.push({ type: 'unplaced', task: t, text: `« ${t.title} » n'a trouvé aucune place cette semaine.` });
      continue;
    }
    const occ = { id: t.id + '@' + slot.date + slot.start, taskId: t.id, date: slot.date, start: slot.start, end: slot.end, state: 'planned', zone: slot.zone };
    placed.push(occ);
    newOnes.push(occ);
    domainByDay[slot.date] = domainByDay[slot.date] || {};
    domainByDay[slot.date][t.domain] = (domainByDay[slot.date][t.domain] || 0) + (toMin(slot.end) - toMin(slot.start));
  }
  return { occurrences: newOnes, warnings, capacity: cap };
}

/* ============================================================
   4. Le chauffeur — re-route automatique (collisions, décalages)
   ============================================================ */

/**
 * Trouve des créneaux de repli pour une tâche (semaine courante + suivante).
 * Retourne jusqu'à `max` options avec coût humain en texte.
 */
export function findAlternatives(task, st, occurrences, fromISO, nowMin = null, max = 3) {
  const thisWeek = weekDates(fromISO);
  const nextWeek = thisWeek.map(d => addDays(d, 7));
  const dates = [...thisWeek, ...nextWeek];
  // on retire les occurrences de CETTE tâche (elle cherche un nouveau nid)
  const others = occurrences.filter(o => o.taskId !== task.id);
  const candidates = [];
  for (const iso of dates) {
    if (iso < fromISO) continue;
    for (const w of freeWindows(iso, st, others, nowMin)) {
      const dur = Math.min(task.duration, toMin(w.end) - toMin(w.start));
      if (dur < 15) continue;
      let score = 0;
      if (task.zonePref === 'any') score += 2;
      else if (task.zonePref === w.type) score += 3;
      score -= dates.indexOf(iso) * 0.35;
      candidates.push({
        date: iso, start: w.start, end: toHM(toMin(w.start) + dur), zone: w.label, score,
        label: `${frShort(iso)} — ${w.start} (${w.label})`,
        cost: costText(fromISO, iso),
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  // garder au plus une option par jour (diversité des solutions)
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    if (seen.has(c.date)) continue;
    seen.add(c.date);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

function costText(fromISO, toISO) {
  const diff = Math.round((parseMs(toISO) - parseMs(fromISO)) / 86400000);
  if (diff <= 0) return "Aujourd'hui — rien ne glisse.";
  if (diff === 1) return 'Glisse de 1 jour.';
  return `Glisse de ${diff} jours.`;
}
function parseMs(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getTime(); }

/**
 * Re-route : le chauffeur ne décide que dans les limites de LA SEMAINE.
 * S'il ne reste aucun chemin cette semaine → c'est le BOSS qui décide
 * (glisser sur la semaine suivante est un choix du boss, pas du chauffeur).
 */
export function reroute(task, st, occurrences, fromISO, nowMin = null) {
  const alts = findAlternatives(task, st, occurrences, fromISO, nowMin, 4);
  const weekEnd = weekDates(fromISO)[6];
  const inWeek = alts.filter(a => a.date <= weekEnd);
  if (inWeek.length > 0) {
    return { decision: 'auto', options: inWeek.slice(0, 3), chosen: inWeek[0], text: `Collision évitée : « ${task.title} » → ${inWeek[0].label}.` };
  }
  return { decision: 'boss', options: [], text: `Aucun chemin cette semaine pour « ${task.title} » — c'est toi le boss, tu décides.` };
}

/* ============================================================
   5. Règles humaines — dette de sommeil & samedi flex
   ============================================================ */
export function sleepDebt(st) {
  const log = (st.patterns?.sleepLog || []).slice(-2);
  if (log.length < 2) return { flag: false, note: 'Pas assez de données de sommeil.' };
  const avgs = log.map(l => l.hours ?? (toMin(l.wake || '06:00') + 1440 - toMin(l.bed || '22:30')) / 60);
  const avg = avgs.reduce((a, b) => a + b, 0) / avgs.length;
  return {
    flag: avg < 6,
    avg: Math.round(avg * 10) / 10,
    note: avg < 6
      ? `Tu dors en moyenne ${avg.toFixed(1)}h — je resserre demain : une seule tâche N2/N3, le reste glisse.`
      : `Sommeil OK (${avg.toFixed(1)}h en moyenne).`,
  };
}
