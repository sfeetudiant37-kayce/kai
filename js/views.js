/* ============================================================
   views.js — les 6 écrans + les actions du chauffeur
   ============================================================ */

import {
  DOMAINS, domainColor, save, seedTasks, taskStats, uid, exportBackup, importBackup, resetAll,
  todayISO, addDays, weekDates, weekKey, frDay, frShort, fmtDur, toMin, toHM,
} from './store.js';
import {
  zonesForDate, fixedBlocksForDate, capacityMinutes, requestedMinutes,
  placeWeek, findAlternatives, reroute, sleepDebt,
} from './engine.js';
import { $, toast, sheet, closeSheet, ringSVG, meter, ICON, critChip, escapeHtml, applyTheme } from './ui.js';
import { playRing, ensureAudio, requestNotifications, notificationsPermission } from './alarms.js';

/* ---------- helpers ---------- */
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const domainLabel = id => (DOMAINS.find(d => d.id === id) || { label: id }).label;

function occOf(state, iso) {
  return state.occurrences
    .filter(o => o.date === iso && o.state !== 'moved')
    .map(o => ({ ...o, task: state.tasks.find(t => t.id === o.taskId) }))
    .filter(o => o.task)
    .sort((a, b) => a.start.localeCompare(b.start));
}
function unplacedTasks(state, wk) {
  return state.tasks.filter(t =>
    t.week === wk && t.status === 'todo' &&
    !state.occurrences.some(o => o.taskId === t.id && o.state !== 'moved'));
}

function taskCard(o, opts = {}) {
  const t = o.task;
  const done = t.status === 'done' || o.state === 'done';
  return `
    <div class="task ${done ? 'done' : ''} n${t.criticality}" data-occ="${o.id}">
      <div class="bar" style="background:${domainColor(t.domain)}"></div>
      <div class="body">
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="time">${o.start} → ${o.end} · ${o.zone || ''}</div>
        <div class="meta">
          <span class="chip"><span class="dot" style="background:${domainColor(t.domain)}"></span>${domainLabel(t.domain)}</span>
          ${critChip(t.criticality)}
        </div>
        ${opts.actions === false ? '' : `
        <div class="task-actions">
          <button class="btn small primary" data-action="task-done" data-task="${t.id}">✓ Fait</button>
          <button class="btn small" data-action="task-partial" data-task="${t.id}">~ Partiel</button>
          <button class="btn small ghost" data-action="task-move" data-task="${t.id}">⇄ Décaler</button>
        </div>`}
      </div>
    </div>`;
}

/* ============================================================
   VUE 1 — AUJOURD'HUI
   ============================================================ */
export function viewToday(state) {
  const iso = todayISO();
  const n = nowMin();
  const occ = occOf(state, iso);
  const done = occ.filter(o => o.task.status === 'done' || o.state === 'done').length;
  const pct = occ.length ? done / occ.length : 0;
  const current = occ.find(o => toMin(o.start) <= n && n < toMin(o.end) && o.state === 'planned');
  const next = occ.find(o => toMin(o.start) > n && o.state === 'planned');
  const hour = Math.floor(n / 60);
  const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const debt = sleepDebt(state);

  // zone du matin bonus active ?
  const morningZone = zonesForDate(iso, state).find(z => z.label === 'Matin bonus');
  const inMorning = morningZone && toMin(morningZone.start) <= n && n < toMin(morningZone.end);

  const logs = state.rerouteLog.slice(-4).reverse();

  return `
    <div class="hero">
      <h2>${greet}, ${escapeHtml(state.profile.name)} ✨</h2>
      <div class="muted">${frDay(iso)} ${frShort(iso).split(' ').slice(1).join(' ')} · il est ${toHM(n)} — voici ta journée, avec ce qui compte.</div>
    </div>

    ${debt.flag ? `<div class="driver-msg"><div class="avatar">K</div><div><strong>Le chauffeur veille sur toi.</strong><br>${escapeHtml(debt.note)}</div></div>` : ''}

    <div class="card">
      <div class="ring-wrap">
        ${ringSVG(pct)}
        <div class="ring-stats">
          <span class="muted">Aujourd'hui</span>
          <b>${done} / ${occ.length} tâches</b>
          <span class="muted">${occ.length ? fmtDur(occ.reduce((a, o) => a + (toMin(o.end) - toMin(o.start)), 0)) : '0 min'} planifiées</span>
        </div>
      </div>
    </div>

    ${inMorning ? `
      <div class="driver-msg">
        <div class="avatar">K</div>
        <div><strong>Il est ${toHM(n)} — tu as ${fmtDur(465 - n)} avant de partir.</strong><br>
        C'est ton meilleur créneau : cerveau frais. On attaque quoi ?</div>
      </div>` : ''}

    <div class="section-title">Maintenant</div>
    ${current ? taskCard(current) : `<div class="empty">Rien en cours. ${next ? 'La prochaine tâche arrive à ' + next.start + '.' : 'Profite de ton souffle.'}</div>`}

    <div class="section-title">Ensuite</div>
    ${occ.filter(o => o.state === 'planned' && toMin(o.start) > n).map(o => taskCard(o)).join('') || '<div class="empty">Rien d\'autre de planifié aujourd\'hui.</div>'}

    <div class="section-title">Ma vie fixe (jamais déplacée)</div>
    ${fixedBlocksForDate(iso, state).map(b => `
      <div class="fixed-block"><span>${b.locked ? ICON.lock : ''} ${escapeHtml(b.label)}</span><span class="time">${b.start} → ${b.end === '23:59' ? '…' : b.end}</span></div>
    `).join('')}

    ${logs.length ? `<div class="section-title">Le chauffeur a travaillé pour toi</div>
      ${logs.map(l => `<div class="driver-msg"><div class="avatar">K</div><div>${escapeHtml(l.text)}</div></div>`).join('')}` : ''}

    <div class="section-title">Aide rapide</div>
    <div class="btn-row">
      <button class="btn" data-action="ring-test">Tester la sonnerie</button>
      <button class="btn" data-action="go" data-view="add">+ Ajouter une tâche</button>
      <button class="btn" data-action="go" data-view="checkins">Compte rendu</button>
    </div>`;
}

/* ============================================================
   VUE 2 — MA SEMAINE
   ============================================================ */
export function viewWeek(state) {
  const iso = todayISO();
  const dates = weekDates(iso);
  const wk = weekKey(iso);
  const tasks = state.tasks.filter(t => t.week === wk);
  const cap = capacityMinutes(state, dates);
  const req = requestedMinutes(tasks);
  const ratio = cap.total ? req / cap.total : 0;
  const unplaced = unplacedTasks(state, wk);

  return `
    <h2>Ma semaine</h2>
    <p class="muted">Semaine du ${frShort(dates[0])} — la grille est une intention, le chauffeur re-route.</p>

    <div class="card">
      <div class="progress-line"><span>Charge demandée : <b>${fmtDur(req)}</b></span><span>Capacité : <b>${fmtDur(cap.total)}</b></span></div>
      ${meter(ratio, ratio > 1 ? 'over' : ratio > 0.85 ? 'warn' : '')}
      <div class="progress-line">
        <span class="muted">${ratio > 1 ? '⚠️ Surcharge — diminue ou reporte.' : ratio > 0.85 ? 'Ça va charger. Priorise les N2.' : 'Charge saine.'}</span>
        <span class="muted">${tasks.filter(t => t.status === 'done').length}/${tasks.length} faites</span>
      </div>
      ${unplaced.length ? `<div class="btn-row" style="margin-top:12px">
        <button class="btn primary" data-action="intake-run">Placer les ${unplaced.length} tâche(s) restante(s)</button>
      </div>` : ''}
    </div>

    <div class="week-grid">
      ${dates.map(d => `
        <div class="day-col ${d === iso ? 'today' : ''}">
          <h4>${frDay(d)} <span class="date">${frShort(d).split(' ').slice(1).join(' ')}</span></h4>
          ${fixedBlocksForDate(d, state).slice(0, 3).map(b => `
            <div class="fixed-block"><span>${escapeHtml(b.label)}</span><span class="time">${b.start}</span></div>`).join('')}
          ${occOf(state, d).map(o => taskCard(o)).join('')}
          ${occOf(state, d).length === 0 ? '<div class="muted" style="font-size:12px">— libre —</div>' : ''}
        </div>`).join('')}
    </div>

    <hr class="sep" />
    <div class="btn-row">
      <button class="btn primary" data-action="go" data-view="add">+ Ajouter (le chauffeur cale et gère les collisions)</button>
      <button class="btn" data-action="rollover-run">Reporter les non-faits à la semaine prochaine</button>
    </div>`;
}

/* ============================================================
   VUE 3 — AJOUTER (insertion en milieu de semaine)
   ============================================================ */
export function viewAdd() {
  return `
    <h2>Ajouter une tâche</h2>
    <p class="muted">Dis-moi ce que tu veux faire — je trouve la place, et s'il y a collision, je re-route avant de te déranger.</p>

    <form class="card" id="add-form">
      <div class="field">
        <label for="f-title">Quoi ?</label>
        <input type="text" id="f-title" name="title" required placeholder="Ex : Commencer le logo kaydigi" />
      </div>
      <div class="field">
        <label for="f-domain">Domaine</label>
        <select id="f-domain" name="domain">
          ${DOMAINS.map(d => `<option value="${d.id}">${d.label}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Criticalité</label>
        <div class="seg" id="f-crit">
          <button type="button" data-val="1">N1 · jamais</button>
          <button type="button" class="on" data-val="2">N2 · protégée</button>
          <button type="button" data-val="3">N3 · souple</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label for="f-dur">Durée (minutes)</label>
          <input type="number" id="f-dur" name="duration" value="45" min="15" step="15" />
        </div>
        <div class="field">
          <label for="f-zone">Meilleur moment</label>
          <select id="f-zone" name="zonePref">
            <option value="deep">Cerveau frais (matin, samedi, dimanche)</option>
            <option value="light">Léger (soir)</option>
            <option value="any">Peu importe</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label for="f-deadline">Avant quand ? (optionnel)</label>
        <input type="date" id="f-deadline" name="deadline" />
      </div>
      <button class="btn primary" type="submit" style="width:100%">Placer la tâche</button>
    </form>

    <div class="section-title">Rappel du contrat</div>
    <div class="driver-msg"><div class="avatar">K</div><div>
      Si ça entre en collision avec une tâche déjà placée, <strong>je re-route tout seul</strong> et je te préviens.
      Si je n'ai plus aucun chemin, <strong>la décision revient au boss</strong> — toi.
    </div></div>`;
}

/* ============================================================
   VUE 4 — COMPTES RENDUS (comme une personne)
   ============================================================ */
export function viewCheckins(state) {
  const iso = todayISO();
  const recent = [iso, addDays(iso, -1)];
  const pending = [];
  for (const d of recent) {
    for (const o of occOf(state, d)) {
      const checked = state.checkins.some(c => c.occurrenceId === o.id);
      if (!checked && o.state === 'planned' && toMin(o.start) < nowMin()) pending.push(o);
    }
  }
  const wk = weekKey(iso);
  const weekTasks = state.tasks.filter(t => t.week === wk);
  const stats = taskStats(weekTasks);

  return `
    <h2>Comptes rendus</h2>
    <p class="muted">C'est moi qui te demande des comptes — comme une personne. Pas pour te shame : pour t'aider à re-route.</p>

    <div class="section-title">En attente</div>
    ${pending.length ? pending.map(o => `
      <div class="card">
        <strong>${escapeHtml(o.task.title)}</strong>
        <div class="muted">${frShort(o.date)} · ${o.start} → ${o.end}</div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn small primary" data-action="checkin-answer" data-occ="${o.id}" data-result="done">✓ Fait</button>
          <button class="btn small" data-action="checkin-answer" data-occ="${o.id}" data-result="partial">~ Partiel</button>
          <button class="btn small" data-action="checkin-answer" data-occ="${o.id}" data-result="skipped">✗ Pas fait</button>
        </div>
      </div>`).join('') : '<div class="empty">Tout est à jour. Belle constance.</div>'}

    <div class="section-title">Point du soir (1 min)</div>
    <div class="card">
      <div class="muted">Qu'est-ce qui a glissé aujourd'hui, et pourquoi ?</div>
      <div class="field" style="margin-top:10px">
        <textarea id="evening-note" placeholder="Ex : fatiguée après le taf, j'ai choisi la distraction…"></textarea>
      </div>
      <button class="btn primary" data-action="evening-save">Enregistrer mon point</button>
    </div>

    <div class="section-title">Revue de semaine (dimanche 15h-16h)</div>
    <div class="card">
      <div class="progress-line">
        <span>Weekly achievements : <b>${stats.done} faites</b> · ${stats.partial} partielles · ${stats.skipped + stats.pending} non faites</span>
      </div>
      ${meter(weekTasks.length ? stats.done / weekTasks.length : 0)}
      <div class="btn-row">
        <button class="btn" data-action="go" data-view="week">Voir ma semaine</button>
        <button class="btn primary" data-action="rollover-run">Reporter les non-faits</button>
      </div>
    </div>

    <div class="section-title">Historique</div>
    ${state.checkins.slice(-8).reverse().map(c => `
      <div class="fixed-block"><span>${escapeHtml(c.title || 'Tâche')} — ${c.result === 'done' ? '✓' : c.result === 'partial' ? '~' : '✗'} ${escapeHtml(c.reason || '')}</span>
      <span class="time">${c.date}</span></div>`).join('') || '<div class="empty">Ton premier compte rendu apparaîtra ici.</div>'}`;
}

/* ============================================================
   VUE 5 — PROGRESSION (trajectoires : semaines → mois → années)
   ============================================================ */
export function viewProgress(state) {
  return `
    <h2>Progression</h2>
    <p class="muted">Rien ne meurt : chaque semaine est un pas sur ta trajectoire.</p>
    ${state.trajectories.map(tr => {
    const total = tr.milestones.length;
    const done = tr.milestones.filter(m => m.done).length;
    return `
        <div class="card traj">
          <div class="head">
            <strong>${escapeHtml(tr.name)}</strong>
            <span class="muted">${done}/${total} · ${tr.horizonMonths ? tr.horizonMonths + ' mois' : 'au quotidien'}</span>
          </div>
          ${meter(total ? done / total : 0)}
          <div class="btn-row" style="margin-top:8px">
            ${tr.milestones.map((m, i) => `
              <button class="chip ${m.done ? 'n1' : ''}" data-action="traj-toggle" data-traj="${tr.id}" data-idx="${i}">
                ${m.done ? '✓' : '○'} ${escapeHtml(m.title)}
              </button>`).join('')}
          </div>
        </div>`;
  }).join('')}

    <div class="driver-msg"><div class="avatar">K</div><div>
      Ton logo kaydigi débloque l'identité, qui débloque les offres, qui débloquent les clients.
      <strong>Un pas par semaine.</strong> Je surveille la chaîne.
    </div></div>`;
}

/* ============================================================
   VUE 6 — RÉGLAGES (ma vie réelle, mes règles)
   ============================================================ */
export function viewSettings(state) {
  const debt = sleepDebt(state);
  return `
    <h2>Réglages</h2>
    <p class="muted">La maison intelligente se règle ici.</p>

    <div class="section-title">Ma vie réelle</div>
    <form class="card" id="settings-form">
      <div class="grid-2">
        <div class="field">
          <label for="s-wake">Réveil prévu</label>
          <input type="time" id="s-wake" name="wakePlan" value="${state.profile.sleep.wakePlan}" />
        </div>
        <div class="field">
          <label for="s-bed">Coucher</label>
          <input type="time" id="s-bed" name="bedtime" value="${state.profile.sleep.bedtime}" />
        </div>
      </div>
      <div class="field">
        <label>Samedi après-midi (flex)</label>
        <div class="seg" id="s-flex">
          <button type="button" data-val="perso" class="${state.profile.saturdayFlex === 'perso' ? 'on' : ''}">Bloc perso</button>
          <button type="button" data-val="mi-temps" class="${state.profile.saturdayFlex === 'mi-temps' ? 'on' : ''}">Moitié moitié</button>
          <button type="button" data-val="sortie" class="${state.profile.saturdayFlex === 'sortie' ? 'on' : ''}">Sortie amies</button>
        </div>
      </div>
      <div class="field">
        <label>Dimanche après-midi</label>
        <div class="seg" id="s-sunday">
          <button type="button" data-val="0" class="${!state.profile.sundaySocial ? 'on' : ''}">Deep work dosé</button>
          <button type="button" data-val="1" class="${state.profile.sundaySocial ? 'on' : ''}">Amis / repos</button>
        </div>
      </div>
      <button class="btn primary" type="submit">Enregistrer</button>
    </form>

    <div class="section-title">Sommeil (la règle human-centric)</div>
    <div class="card">
      <div>${escapeHtml(debt.note)}</div>
      <form id="sleep-form" class="btn-row" style="margin-top:10px">
        <input type="time" name="bed" value="${state.profile.sleep.bedtime}" aria-label="Heure de coucher" />
        <input type="time" name="wake" value="${state.profile.sleep.wakePlan}" aria-label="Heure de réveil" />
        <button class="btn" type="submit">J'ai dormi ça</button>
      </form>
    </div>

    <div class="section-title">Apparence</div>
    <div class="card">
      <div class="seg" id="s-theme">
        <button type="button" data-val="auto" class="${(state.settings.theme || 'auto') === 'auto' ? 'on' : ''}">🌗 Auto</button>
        <button type="button" data-val="light" class="${state.settings.theme === 'light' ? 'on' : ''}">☀️ Clair</button>
        <button type="button" data-val="dark" class="${state.settings.theme === 'dark' ? 'on' : ''}">🌙 Sombre</button>
      </div>
    </div>

    <div class="section-title">Sonneries & notifications</div>
    <div class="card">
      <div class="btn-row">
        <button class="btn primary" data-action="ring-enable">Activer les sonneries + notifications</button>
        <button class="btn" data-action="ring-test">Tester</button>
      </div>
      <div class="muted" style="margin-top:8px">Permission notifications : <b>${notificationsPermission()}</b> ·
      Reste sur l'appli ou installe-la en PWA pour des sonneries fiables.</div>
    </div>

    <div class="section-title">Mes données (100% hors-ligne)</div>
    <div class="card">
      <div class="btn-row">
        <button class="btn" data-action="export">Exporter ma sauvegarde (.kaibak)</button>
        <label class="btn" style="display:inline-flex;align-items:center">Importer<input type="file" id="import-file" accept="application/json" hidden /></label>
        <button class="btn danger" data-action="reset">Tout réinitialiser</button>
      </div>
      <div class="muted" style="margin-top:8px">💾 Tes données vivent dans une vraie base de données locale (<b>IndexedDB</b>), hors-ligne, chiffrable. Exporte régulièrement.</div>
    </div>

    <div class="section-title">Le contrat (rappel)</div>
    <div class="driver-msg"><div class="avatar">K</div><div>
      Tu donnes tes weekly achievements chaque semaine, tu réponds aux comptes rendus, tu ne ignores pas les sonneries.
      Moi, je place tout, je n'oublie rien, je sonne, je re-route, et je te demande des comptes — sans jamais te mentir.
    </div></div>`;
}

/* ============================================================
   ACTIONS — le chauffeur en mouvement
   ============================================================ */

export const actions = {
  /* --- navigation --- */
  go(ctx, el) { location.hash = '#/' + (el.dataset.view || 'today'); },

  /* --- sonneries --- */
  'ring-enable': async (ctx) => {
    ensureAudio();
    const p = await requestNotifications();
    playRing(); setTimeout(() => { try { /* stop après 3s */ } catch { } }, 100);
    toast(p === 'granted' ? '🔔 Sonneries + notifications activées.' : 'Son activée. Notifications : ' + p + ' (autorise-les dans le navigateur).');
    setTimeout(() => stopRingSafe(), 2500);
  },
  'ring-test': () => { playRing(); setTimeout(stopRingSafe, 3200); toast('C\'est comme ça que ça sonnera.'); },

  /* --- bannière de sonnerie --- */
  'ring-start': (ctx) => {
    hideRing();
    toast('C\'est parti — je te laisse travailler. 🔥');
  },
  'ring-defer': (ctx) => {
    const occId = globalThis.__kaiRingOcc;
    hideRing();
    const o = ctx.state.occurrences.find(x => x.id === occId);
    if (!o) return;
    const t = ctx.state.tasks.find(x => x.id === o.taskId);
    if (t) openMoveSheet(ctx, t, o);
  },

  /* --- suivi des tâches --- */
  'task-done': (ctx, el) => setTaskStatus(ctx, el.dataset.task, 'done'),
  'task-partial': (ctx, el) => setTaskStatus(ctx, el.dataset.task, 'partial'),
  'task-skip': (ctx, el) => setTaskStatus(ctx, el.dataset.task, 'skipped'),

  'task-move': (ctx, el) => {
    const t = ctx.state.tasks.find(x => x.id === el.dataset.task);
    if (!t) return;
    const occ = ctx.state.occurrences.find(o => o.taskId === t.id && o.state === 'planned');
    openMoveSheet(ctx, t, occ);
  },

  'reroute-apply': (ctx, el) => {
    const { task, date, start, end, label, cost } = el.dataset;
    const t = ctx.state.tasks.find(x => x.id === task);
    const old = ctx.state.occurrences.find(o => o.taskId === task && o.state === 'planned');
    if (old) old.state = 'moved';
    ctx.state.occurrences.push({
      id: task + '@' + date + start, taskId: task, date, start, end,
      state: 'planned', zone: label || 're-planifié',
    });
    ctx.state.rerouteLog.push({
      id: uid(), taskId: task, decision: 'auto',
      text: `Collision évitée : « ${t?.title || 'tâche' } » → ${frDay(date)} ${start}. ${cost || ''}`,
      at: new Date().toISOString(),
    });
    closeSheet();
    ctx.save();
    toast(`✅ Collision évitée : « ${t?.title} » → ${frDay(date)} ${start}.`);
  },

  'boss-decide': (ctx, el) => {
    // dernier recours : on glisse la tâche en fin de semaine suivante
    const t = ctx.state.tasks.find(x => x.id === el.dataset.task);
    if (!t) return;
    const dates = weekDates(addDays(todayISO(), 7));
    const lastDay = dates[6];
    const old = ctx.state.occurrences.find(o => o.taskId === t.id && o.state === 'planned');
    if (old) old.state = 'moved';
    ctx.state.occurrences.push({ id: t.id + '@' + lastDay + '16:00', taskId: t.id, date: lastDay, start: '16:00', end: toHM(960 + t.duration), state: 'planned', zone: 'Dimanche (choix du boss)' });
    ctx.state.rerouteLog.push({ id: uid(), taskId: t.id, decision: 'boss', text: `Le boss a décidé : « ${t.title} » → dimanche prochain 16h.`, at: new Date().toISOString() });
    closeSheet(); ctx.save();
    toast('Décision du boss enregistrée. Je m\'en occupe.');
  },

  /* --- ajout (insertion milieu de semaine) --- */
  'add-submit': async (ctx, form) => {
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    if (!title) return;
    const critBtn = document.querySelector('#f-crit .on');
    const task = {
      id: uid(), title,
      domain: fd.get('domain') || 'apprentissage',
      criticality: Number(critBtn?.dataset.val || 2),
      duration: Number(fd.get('duration') || 45),
      zonePref: fd.get('zonePref') || 'any',
      deadline: fd.get('deadline') || null,
      week: weekKey(todayISO()), status: 'todo', origin: 'midweek', note: '',
    };
    ctx.state.tasks.push(task);
    const res = placeWeek([task], ctx.state, weekDates(todayISO()), ctx.state.occurrences, nowMin());
    if (res.occurrences.length) {
      ctx.state.occurrences.push(...res.occurrences);
      const o = res.occurrences[0];
      ctx.state.rerouteLog.push({ id: uid(), taskId: task.id, decision: 'auto', text: `« ${task.title} » placé ${frDay(o.date)} à ${o.start} (${o.zone}).`, at: new Date().toISOString() });
      ctx.save();
      toast(`✅ Je le place ${frDay(o.date)} à ${o.start} (${o.zone}).`);
      location.hash = '#/week';
    } else {
      ctx.save();
      openBossSheet(ctx, task);
    }
  },

  /* --- placement / report --- */
  'intake-run': (ctx) => {
    const wk = weekKey(todayISO());
    const todo = unplacedTasks(ctx.state, wk);
    if (!todo.length) return toast('Tout est déjà placé.');
    const res = placeWeek(todo, ctx.state, weekDates(todayISO()), ctx.state.occurrences, nowMin());
    ctx.state.occurrences.push(...res.occurrences);
    for (const w of res.warnings) {
      ctx.state.rerouteLog.push({ id: uid(), decision: 'auto', text: w.text, at: new Date().toISOString() });
    }
    ctx.save();
    const placedTxt = `${res.occurrences.length} tâche(s) placée(s)`;
    const warnTxt = res.warnings.length ? ' · ' + res.warnings[0].text : '';
    toast('✅ ' + placedTxt + warnTxt, 6000);
  },

  'rollover-run': (ctx) => {
    const wk = weekKey(todayISO());
    const next = weekKey(addDays(todayISO(), 7));
    const left = ctx.state.tasks.filter(t => t.week === wk && t.status !== 'done');
    if (!left.length) return toast('Rien à reporter — semaine accomplie. 🎉');
    for (const t of left) {
      ctx.state.tasks.push({ ...t, id: uid(), week: next, origin: 'rollover', status: 'todo' });
      if (t.status !== 'done') t.status = 'skipped';
    }
    ctx.save();
    toast(`↩️ ${left.length} tâche(s) reportée(s) à la semaine prochaine. Rien ne meurt.`);
  },

  /* --- comptes rendus --- */
  'checkin-answer': (ctx, el) => {
    const o = ctx.state.occurrences.find(x => x.id === el.dataset.occ);
    if (!o) return;
    const t = ctx.state.tasks.find(x => x.id === o.taskId);
    const result = el.dataset.result;
    if (t) t.status = result;
    o.state = result === 'done' ? 'done' : result === 'partial' ? 'partial' : 'skipped';
    ctx.state.checkins.push({ id: uid(), occurrenceId: o.id, taskId: o.taskId, title: t?.title, date: o.date, result, reason: '', at: new Date().toISOString() });
    ctx.save();
    toast(result === 'done' ? '✓ Noté. Belle constance.' : result === 'partial' ? '~ Noté. C\'est déjà ça.' : '✗ Noté — on en parle au point du soir, sans jugement.');
  },

  'evening-save': (ctx) => {
    const note = document.querySelector('#evening-note')?.value || '';
    ctx.state.checkins.push({ id: uid(), occurrenceId: 'evening-' + todayISO(), taskId: null, title: 'Point du soir', date: todayISO(), result: 'done', reason: note, at: new Date().toISOString() });
    ctx.save();
    toast('🌙 Point du soir enregistré. Repose-toi bien.');
  },

  /* --- trajectoires --- */
  'traj-toggle': (ctx, el) => {
    const tr = ctx.state.trajectories.find(t => t.id === el.dataset.traj);
    if (!tr) return;
    const m = tr.milestones[Number(el.dataset.idx)];
    if (m) { m.done = !m.done; ctx.save(); }
  },

  /* --- réglages --- */
  'settings-save': (ctx, form) => {
    const fd = new FormData(form);
    if (fd.get('wakePlan')) ctx.state.profile.sleep.wakePlan = fd.get('wakePlan');
    if (fd.get('bedtime')) ctx.state.profile.sleep.bedtime = fd.get('bedtime');
    const flex = document.querySelector('#s-flex .on')?.dataset.val;
    if (flex) ctx.state.profile.saturdayFlex = flex;
    const sun = document.querySelector('#s-sunday .on')?.dataset.val;
    if (sun !== undefined) ctx.state.profile.sundaySocial = sun === '1';
    const theme = document.querySelector('#s-theme .on')?.dataset.val;
    if (theme) { ctx.state.settings.theme = theme; applyTheme(theme); }
    ctx.save();
    toast('✅ Réglages enregistrés. La maison est calibrée.');
  },

  'theme-toggle': (ctx) => {
    const order = ['auto', 'light', 'dark'];
    const cur = ctx.state.settings.theme || 'auto';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    ctx.state.settings.theme = next;
    applyTheme(next);
    ctx.save();
    toast(next === 'dark' ? '🌙 Mode sombre.' : next === 'light' ? '☀️ Mode clair.' : '🌗 Thème auto (selon ton téléphone).');
  },

  'sleep-save': (ctx, form) => {
    const fd = new FormData(form);
    const bed = fd.get('bed'), wake = fd.get('wake');
    const hours = ((toMin(wake) + 1440 - toMin(bed)) % 1440) / 60;
    ctx.state.patterns.sleepLog.push({ date: todayISO(), bed, wake, hours: Math.round(hours * 10) / 10 });
    ctx.save();
    toast(`😴 ${hours.toFixed(1)}h de sommeil notées.`);
  },

  /* --- données --- */
  'export': (ctx) => {
    const blob = new Blob([exportBackup(ctx.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kai-backup-' + todayISO() + '.kaibak';
    a.click();
    toast('Sauvegarde exportée.');
  },
  'import-file': async (ctx, input) => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const st = importBackup(text);
      Object.assign(ctx.state, st);
      ctx.save(); location.reload();
    } catch { toast('❌ Fichier invalide.'); }
  },
  'reset': (ctx) => {
    if (!confirm('Tout effacer et repartir de zéro ?')) return;
    Object.assign(ctx.state, resetAll());
    ctx.save(); location.reload();
  },

  /* --- divers --- */
  'sheet-close': () => closeSheet(),

  /* boutons segments (criticalité, flex, dimanche) */
  'seg-pick': (ctx, el) => {
    const parent = el.parentElement;
    parent.querySelectorAll('button').forEach(b => b.classList.remove('on'));
    el.classList.add('on');
  },
};

/* ---------- helpers d'actions ---------- */
function setTaskStatus(ctx, taskId, status) {
  const t = ctx.state.tasks.find(x => x.id === taskId);
  if (!t) return;
  t.status = status;
  const occ = ctx.state.occurrences.find(o => o.taskId === taskId && o.state === 'planned');
  if (occ) occ.state = status === 'done' ? 'done' : status === 'partial' ? 'partial' : 'skipped';
  ctx.state.checkins.push({ id: uid(), occurrenceId: occ?.id || taskId, taskId, title: t.title, date: occ?.date || todayISO(), result: status, reason: '', at: new Date().toISOString() });
  ctx.save();
  toast(status === 'done' ? `✓ « ${t.title} » fait. La progression avance.` :
    status === 'partial' ? `~ « ${t.title} » en partie fait — c'est noté.` :
    `✗ « ${t.title} » glisse. On en parle sans jugement.`);
}

function openMoveSheet(ctx, task, occ) {
  const from = occ?.date || todayISO();
  const res = reroute(task, ctx.state, ctx.state.occurrences, from, nowMin());
  if (res.decision === 'boss') return openBossSheet(ctx, task);
  sheet(`
    <h3>⇄ Le chauffeur re-route</h3>
    <p class="muted">« ${escapeHtml(task.title)} » — voici les meilleurs chemins. Je recommande le premier.</p>
    ${res.options.map((o, i) => `
      <button class="option-card" data-action="reroute-apply"
        data-task="${task.id}" data-date="${o.date}" data-start="${o.start}" data-end="${o.end}"
        data-label="${escapeHtml(o.zone)}" data-cost="${escapeHtml(o.cost)}">
        <strong>${i === 0 ? '⭐ ' : ''}${escapeHtml(o.label)}</strong>
        <div class="cost">${escapeHtml(o.cost)}</div>
      </button>`).join('')}
    <div class="btn-row"><button class="btn ghost" data-action="sheet-close">Annuler</button></div>
  `);
}

function openBossSheet(ctx, task) {
  sheet(`
    <h3>🚨 Impasse — c'est toi le boss</h3>
    <p class="muted">J'ai cherché partout : plus aucun créneau libre cette semaine et la suivante pour « ${escapeHtml(task.title)} ».</p>
    <button class="option-card" data-action="boss-decide" data-task="${task.id}">
      <strong>La placer dimanche prochain à 16h</strong>
      <div class="cost">Glisse d'une semaine — je surveille quand même la trajectoire.</div>
    </button>
    <button class="option-card" data-action="task-skip" data-task="${task.id}">
      <strong>La reporter à plus tard (retirer de cette semaine)</strong>
      <div class="cost">Elle repart dans la file — rien ne meurt.</div>
    </button>
    <div class="btn-row"><button class="btn ghost" data-action="sheet-close">Laisse-moi réfléchir</button></div>
  `);
}

function hideRing() {
  document.querySelector('#ring-banner')?.classList.add('hidden');
}
function stopRingSafe() {
  import('./alarms.js').then(m => m.stopRing()).catch(() => { });
}
