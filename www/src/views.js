/* ============================================================
   views.js — écrans & interactions
   Aujourd'hui · Calendrier (jour/semaine/mois/année) · Finances
   Progression · Réglages + actions du chauffeur
   ============================================================ */

import {
  DOMAINS, SERVICES, taskStats, uid,
  todayISO, addDays, weekDates, weekKey, monthKey, daysInMonth, frDay, frShort, frMonth,
  fmtDur, fmtMoney, toMin, toHM, parseISO,
} from './model.js';
import { exportBackup, importBackup, resetAll } from './store.js';
import {
  zonesForDate, fixedBlocksForDate, capacityMinutes, requestedMinutes,
  placeWeek, findAlternatives, reroute, sleepDebt,
} from './engine.js';
import {
  financeKPIs, incomeByMonth, incomeByService, incomeDays, incomesOfYear, incomeTotal,
  heatmap, weeklyDoneSeries, domainHours, streak, doneMinutes, plannedMinutes, trajectoryProgress,
} from './insights.js';
import { barChart, lineChart, donutChart, heatmap as heatSvg, sparkbars } from './charts.js';
import { icons } from './icons.js';
import { $, toast, sheet, closeSheet, ringSVG, progress, critChip, domainDot, escapeHtml, applyTheme } from './ui.js';
import { playRing, ensureAudio, requestNotifications, notificationsPermission } from './alarms.js';
import { CONFIG, log, bus } from './kernel.js';

/* ---------- état d'interface (non persisté) ---------- */
let calMode = 'week';       // day | week | month | year
let calAnchor = todayISO();

const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const domainLabel = id => (DOMAINS.find(d => d.id === id) || { label: id }).label;
const serviceLabel = id => (SERVICES.find(s => s.id === id) || { label: id }).label;

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

/* ============================================================
   VUE 1 — AUJOURD'HUI (tableau de bord)
   ============================================================ */
export function viewToday(state) {
  const iso = todayISO();
  const n = nowMin();
  const occ = occOf(state, iso);
  const done = occ.filter(o => o.task.status === 'done' || o.state === 'done').length;
  const dayStreak = streak(state);
  const debt = sleepDebt(state);
  const logs = state.rerouteLog.slice(-3).reverse();

  return `
    <header class="page-head">
      <div>
        <p class="overline">${frDay(iso)} ${frShort(iso).split(' ').slice(1).join(' ')}</p>
        <h1>Bonjour, ${escapeHtml(state.profile.name)}</h1>
      </div>
      <p class="head-time">${toHM(n)}</p>
    </header>

    ${debt.flag ? `<div class="callout callout-warn"><strong>Le chauffeur veille.</strong> ${escapeHtml(debt.note)}</div>` : ''}

    <section class="tiles">
      <div class="tile">
        <p class="tile-label">Tâches du jour</p>
        <p class="tile-value">${done}<span class="tile-sub">/${occ.length}</span></p>
        ${progress(occ.length ? done / occ.length : 0)}
      </div>
      <div class="tile">
        <p class="tile-label">Régularité</p>
        <p class="tile-value">${dayStreak} <span class="tile-sub">jours</span></p>
        <p class="tile-note">${dayStreak > 0 ? 'Continue, la constance se construit.' : 'Un pas aujourd\'hui suffit.'}</p>
      </div>
      <div class="tile">
        <p class="tile-label">Charge planifiée</p>
        <p class="tile-value">${fmtDur(plannedMinutes(state, iso))}</p>
        <p class="tile-note">${fmtDur(doneMinutes(state, iso))} réalisées</p>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Agenda du jour</h2>
        <button class="btn btn-ghost btn-sm" data-action="open-add">${icons.plus(14)} Tâche</button>
      </div>
      ${occ.length ? `
      <ol class="agenda">
        ${occ.map(o => `
          <li class="agenda-item ${o.state === 'done' ? 'is-done' : ''}">
            <div class="agenda-time">${o.start}<span>${o.end}</span></div>
            <div class="agenda-card dom-rail-${escapeHtml(o.task.domain)}">
              <div class="agenda-title">${escapeHtml(o.task.title)}</div>
              <div class="agenda-meta">
                ${domainDot(o.task.domain)} ${domainLabel(o.task.domain)} · ${critChip(o.task.criticality)}
              </div>
              <div class="row-actions">
                <button class="btn btn-primary btn-sm" data-action="task-done" data-task="${o.task.id}">Fait</button>
                <button class="btn btn-sm" data-action="task-partial" data-task="${o.task.id}">Partiel</button>
                <button class="btn btn-ghost btn-sm" data-action="task-move" data-task="${o.task.id}">Décaler</button>
              </div>
            </div>
          </li>`).join('')}
      </ol>` : `<div class="empty">Rien de planifié aujourd'hui. Le chef a tout calé dans la semaine — ouvre le calendrier.</div>`}
    </section>

    <section class="section">
      <div class="section-head"><h2>Point du soir (1 min)</h2></div>
      <div class="card">
        <p class="muted">Qu'est-ce qui a glissé aujourd'hui, et pourquoi ? Le système te demande des comptes — sans jugement.</p>
        <div class="field"><textarea id="evening-note" placeholder="Ex : fatiguée après le taf, j'ai choisi la distraction…"></textarea></div>
        <button class="btn btn-primary" data-action="evening-save">Enregistrer mon point</button>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Revue de semaine</h2><span class="muted">dimanche 15h-16h</span></div>
      <div class="card">
        ${(() => {
          const wk = weekKey(todayISO());
          const stats = taskStats(state.tasks.filter(t => t.week === wk));
          return `<p><b class="num">${stats.done}</b> faites · <b class="num">${stats.partial}</b> partielles · <b class="num">${stats.skipped + stats.pending}</b> non faites</p>
            ${progress(stats.total ? stats.done / stats.total : 0)}`;
        })()}
        <div class="row-actions">
          <button class="btn" data-action="go" data-view="calendar">Voir ma semaine</button>
          <button class="btn btn-primary" data-action="rollover-run">Reporter les non-faits</button>
        </div>
      </div>
    </section>

    ${logs.length ? `
    <section class="section">
      <div class="section-head"><h2>Journal du chauffeur</h2></div>
      ${logs.map(l => `<div class="feed-item"><span class="feed-icon">${icons.move(15)}</span><p>${escapeHtml(l.text)}</p></div>`).join('')}
    </section>` : ''}

    <section class="section">
      <div class="section-head"><h2>Ma vie fixe</h2></div>
      <ul class="fixed-list">
        ${fixedBlocksForDate(iso, state).map(b => `
          <li><span>${icons.lock(13)} ${escapeHtml(b.label)}</span><span class="num">${b.start} → ${b.end === '23:59' ? '…' : b.end}</span></li>
        `).join('')}
      </ul>
    </section>`;
}

/* ============================================================
   VUE 2 — CALENDRIER (jour · semaine · mois · année)
   ============================================================ */

const CAL_START = 6 * 60, CAL_END = 24 * 60, PPM = 1; // pixels par minute

export function viewCalendar(state) {
  const titles = { day: frShort(calAnchor), week: `Semaine du ${frShort(weekDates(calAnchor)[0])}`, month: `${frMonth(parseISO(calAnchor).getFullYear(), parseISO(calAnchor).getMonth())} ${parseISO(calAnchor).getFullYear()}`, year: String(parseISO(calAnchor).getFullYear()) };
  return `
    <header class="page-head">
      <div>
        <p class="overline">Programme</p>
        <h1>${titles[calMode]}</h1>
      </div>
      <div class="head-nav">
        <button class="icon-btn" data-action="cal-prev" aria-label="Précédent">${icons.arrowL(18)}</button>
        <button class="btn btn-sm" data-action="cal-today">Aujourd'hui</button>
        <button class="icon-btn" data-action="cal-next" aria-label="Suivant">${icons.arrowR(18)}</button>
      </div>
    </header>

    <div class="segmented" role="tablist">
      ${['day:Jour', 'week:Semaine', 'month:Mois', 'year:Année'].map(s => {
        const [mode, label] = s.split(':');
        return `<button role="tab" aria-selected="${calMode === mode}" class="${calMode === mode ? 'on' : ''}" data-action="cal-mode" data-mode="${mode}">${label}</button>`;
      }).join('')}
    </div>

    ${calMode === 'week' ? weekGrid(state, weekDates(calAnchor)) :
      calMode === 'day' ? weekGrid(state, [calAnchor]) :
      calMode === 'month' ? monthGrid(state) : yearGrid(state)}
  `;
}

function weekGrid(state, dates) {
  const n = nowMin();
  const today = todayISO();
  const hours = [];
  for (let h = CAL_START / 60; h <= CAL_END / 60; h++) hours.push(h);
  return `
    <div class="cal-scroll">
      <div class="cal-grid" style="--cols:${dates.length}">
        <div class="cal-gutter">
          ${hours.slice(0, -1).map(h => `<div class="cal-hourlabel" style="top:${(h * 60 - CAL_START) * PPM}px">${String(h).padStart(2, '0')}:00</div>`).join('')}
        </div>
        ${dates.map(iso => {
          const evs = [
            ...fixedBlocksForDate(iso, state).map(b => ({ ...b, kind: 'fixed' })),
            ...occOf(state, iso).map(o => ({
              label: o.task.title, start: o.start, end: o.end, kind: 'task',
              domain: o.task.domain, occ: o, criticality: o.task.criticality, state: o.state,
            })),
          ];
          return `
          <div class="cal-daycol ${iso === today ? 'is-today' : ''}">
            <div class="cal-dayhead">
              <span>${frDay(iso).slice(0, 3)}</span>
              <b>${parseISO(iso).getDate()}</b>
            </div>
            <div class="cal-daybody" data-action="cal-goto-day" data-date="${iso}">
              ${evs.map(e => {
                const top = (toMin(e.start) - CAL_START) * PPM;
                const h = Math.max(16, (toMin(e.end) - toMin(e.start)) * PPM);
                if (e.kind === 'fixed') {
                  return `<div class="cal-ev cal-fixed" style="top:${top}px;height:${h}px" title="${escapeHtml(e.label)}">
                    <span class="cal-ev-title">${escapeHtml(e.label)}</span></div>`;
                }
                return `<div class="cal-ev cal-task dom-rail-${escapeHtml(e.domain)} ${e.state === 'done' ? 'is-done' : ''}" data-action="event-detail" data-occ="${e.occ.id}"
                    style="top:${top}px;height:${h}px" title="${escapeHtml(e.label)}">
                  <span class="cal-ev-title">${e.criticality === 1 ? icons.lock(11) : ''} ${escapeHtml(e.label)}</span>
                  ${h > 34 ? `<span class="cal-ev-time">${e.start} → ${e.end}</span>` : ''}
                </div>`;
              }).join('')}
              ${iso === today ? `<div class="cal-now" style="top:${(n - CAL_START) * PPM}px"></div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <p class="chart-legend"><span class="dot dot-fixed"></span> Vie fixe · <span class="dot" style="background:var(--c-accent)"></span> Mes tâches · cliquer un bloc pour agir</p>`;
}

function monthGrid(state) {
  const anchor = parseISO(calAnchor);
  const year = anchor.getFullYear(), month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // lundi = 0
  const dim = daysInMonth(year, month + 1);
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  const incDays = incomeDays(state, ym);
  const today = todayISO();

  return `
    <div class="month-grid">
      ${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => `<div class="month-dow">${d}</div>`).join('')}
      ${cells.map(d => {
        if (!d) return '<div class="month-cell is-empty"></div>';
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const evs = occOf(state, iso);
        const inc = incDays[iso];
        return `
        <button class="month-cell ${iso === today ? 'is-today' : ''}" data-action="cal-goto-day" data-date="${iso}">
          <span class="month-num">${d.getDate()}</span>
          ${evs.slice(0, 2).map(o => `<span class="month-chip dom-rail-${escapeHtml(o.task.domain)} ${o.state === 'done' ? 'is-done' : ''}">${escapeHtml(o.task.title)}</span>`).join('')}
          ${evs.length > 2 ? `<span class="month-more">+${evs.length - 2}</span>` : ''}
          ${inc ? `<span class="month-income">+${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(inc)}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`;
}

function yearGrid(state) {
  const year = parseISO(calAnchor).getFullYear();
  const months = incomeByMonth(state, year);
  return `
    <div class="year-list">
      ${months.map(m => {
        const load = monthLoadSafe(state, year, m.month + 1);
        const pct = load.planned ? load.done / load.planned : 0;
        return `
        <button class="year-row" data-action="cal-goto-month" data-month="${m.month}">
          <span class="year-name">${frMonth(year, m.month)}</span>
          <span class="year-bar">${progress(pct)}</span>
          <span class="year-stat num">${fmtDur(load.done)} <em>/ ${fmtDur(load.planned)}</em></span>
          <span class="year-money num ${m.total > 0 ? 'is-pos' : ''}">${m.total > 0 ? fmtMoney(m.total, state.settings.currency) : '—'}</span>
        </button>`;
      }).join('')}
    </div>
    <p class="chart-legend">Barre = part des tâches planifiées réalisées · Droite = revenus encaissés du mois</p>`;
}
function monthLoadSafe(state, year, month) {
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

/* ============================================================
   VUE 3 — FINANCES (kaydigi : ce que je gagne)
   ============================================================ */
export function viewFinance(state) {
  const year = new Date().getFullYear();
  const cur = state.settings.currency || 'FCFA';
  const k = financeKPIs(state);
  const byMonth = incomeByMonth(state, year);
  const byService = incomeByService(state, incomesOfYear(state, year));
  const palette = { dev: 'var(--c-accent)', cm: 'var(--dom-foi)', design: 'var(--dom-kaydigi)', redaction: 'var(--dom-ecriture)' };
  const entries = [...(state.finances?.incomes || [])].sort((a, b) => b.date.localeCompare(a.date));

  return `
    <header class="page-head">
      <div><p class="overline">Kaydigi · freelance</p><h1>Finances</h1></div>
      <button class="btn btn-primary btn-sm" data-action="income-sheet">${icons.plus(14)} Revenu</button>
    </header>

    <section class="tiles tiles-4">
      <div class="tile"><p class="tile-label">Ce mois</p><p class="tile-value num">${fmtMoney(k.month, cur)}</p>${progress(k.monthProgress, k.monthProgress >= 1 ? 'ok' : '')}<p class="tile-note">Objectif : ${fmtMoney(k.goals.monthlyTarget, cur)}</p></div>
      <div class="tile"><p class="tile-label">Encaissé ${year}</p><p class="tile-value num">${fmtMoney(k.paidYear, cur)}</p>${progress(k.yearProgress, k.yearProgress >= 1 ? 'ok' : '')}<p class="tile-note">Objectif annuel : ${fmtMoney(k.goals.yearTarget, cur)}</p></div>
      <div class="tile"><p class="tile-label">Moyenne / mois</p><p class="tile-value num">${fmtMoney(k.avg, cur)}</p><p class="tile-note">Sur les mois écoulés</p></div>
      <div class="tile"><p class="tile-label">Projection annuelle</p><p class="tile-value num">${fmtMoney(k.projection, cur)}</p><p class="tile-note">Au rythme actuel</p></div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Revenus par mois</h2><span class="muted num">${year}</span></div>
      <div class="card">
        ${barChart(byMonth.map(m => ({ label: frMonth(year, m.month).slice(0, 3), value: m.total, color: m.total ? 'var(--c-accent)' : 'var(--c-surface-2)' })), {
          height: 180, unit: cur,
          format: v => v >= 1000 ? Math.round(v / 1000) + 'k' : String(Math.round(v)),
        })}
      </div>
    </section>

    <section class="section two-col">
      <div>
        <div class="section-head"><h2>Par service</h2></div>
        <div class="card">
          ${byService.length ? `
          <div class="donut-wrap">
            ${donutChart(byService.map(s => ({ label: serviceLabel(s.service), value: s.total, color: palette[s.service] || 'var(--c-accent)' })), {
              centerValue: fmtMoney(k.paidYear + k.pendingYear, cur).replace(' ' + cur, ''), centerLabel: cur + ' · ' + year,
            })}
            <ul class="legend">
              ${byService.map(s => `<li><span class="dot" style="background:${palette[s.service] || 'var(--c-accent)'}"></span>
                ${serviceLabel(s.service)} <b class="num">${fmtMoney(s.total, cur)}</b></li>`).join('')}
            </ul>
          </div>` : `<div class="empty">Ajoute ton premier revenu pour voir la répartition.</div>`}
        </div>
      </div>
      <div>
        <div class="section-head"><h2>Objectifs</h2></div>
        <form class="card" id="goals-form">
          <div class="field"><label for="g-month">Objectif mensuel (${cur})</label>
            <input type="number" id="g-month" name="monthlyTarget" value="${k.goals.monthlyTarget}" min="0" step="5000" /></div>
          <div class="field"><label for="g-year">Objectif annuel (${cur})</label>
            <input type="number" id="g-year" name="yearTarget" value="${k.goals.yearTarget}" min="0" step="50000" /></div>
          <button class="btn btn-primary" type="submit">Enregistrer</button>
        </form>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Historique</h2></div>
      <div class="card table-wrap">
        <table class="table">
          <thead><tr><th>Date</th><th>Client</th><th>Service</th><th class="num">Montant</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            ${entries.map(i => `
              <tr>
                <td class="num">${frShort(i.date)}</td>
                <td>${escapeHtml(i.client)}</td>
                <td><span class="chip"><span class="dot" style="background:${palette[i.service] || 'var(--c-accent)'}"></span>${serviceLabel(i.service)}</span></td>
                <td class="num"><b>${fmtMoney(i.amount, cur)}</b></td>
                <td><span class="badge ${i.status === 'paid' ? 'badge-ok' : 'badge-warn'}">${i.status === 'paid' ? 'Encaissé' : 'En attente'}</span></td>
                <td class="num"><button class="icon-btn icon-btn-sm" data-action="income-delete" data-id="${i.id}" aria-label="Supprimer">${icons.trash(14)}</button></td>
              </tr>`).join('') || `<tr><td colspan="6"><div class="empty">Aucun revenu enregistré.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>`;
}

/* ============================================================
   VUE 4 — PROGRESSION (graphiques réels)
   ============================================================ */
export function viewProgress(state) {
  const days = heatmap(state, 16);
  const weekly = weeklyDoneSeries(state, 12);
  const dates = weekDates(todayISO());
  const doms = domainHours(state, dates);
  const maxDom = Math.max(...doms.map(d => d.hours), 1);

  return `
    <header class="page-head">
      <div><p class="overline">Semaines · mois · années</p><h1>Progression</h1></div>
      <p class="head-stat num">${streak(state)} j de série</p>
    </header>

    <section class="section">
      <div class="section-head"><h2>Régularité — 16 dernières semaines</h2>
        <p class="chart-legend">${heatLegend()}</p>
      </div>
      <div class="card heat-wrap">${heatSvg(days)}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Heures réalisées par semaine</h2><span class="muted">vs planifié</span></div>
      <div class="card">
        ${lineChart(
          weekly.map(w => frShort(w.week).split(' ').slice(1).join(' ')),
          [
            { label: 'Réalisé', values: weekly.map(w => w.done), color: 'var(--c-accent)' },
            { label: 'Planifié', values: weekly.map(w => w.planned), color: 'var(--c-text-3)', dashed: true },
          ],
          { height: 190, unit: 'h', format: v => Math.round(v) + 'h' },
        )}
        <p class="chart-legend"><span class="dot" style="background:var(--c-accent)"></span> Réalisé · <span class="dot" style="background:var(--c-text-3)"></span> Planifié</p>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Par domaine — cette semaine</h2></div>
      <div class="card">
        ${doms.length ? `
        <ul class="domain-bars">
          ${doms.map(d => `
            <li>
              <span class="domain-bars-label">${domainDot(d.domain)} ${domainLabel(d.domain)}</span>
              <span class="domain-bars-track"><span class="domain-bars-fill dom-bg-${escapeHtml(d.domain)}" style="width:${(d.hours / maxDom * 100).toFixed(0)}%"></span></span>
              <span class="num">${d.hours}h</span>
            </li>`).join('')}
        </ul>` : '<div class="empty">Place tes weekly achievements pour voir la répartition.</div>'}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Trajectoires</h2><span class="muted">semaines → mois → années</span></div>
      ${state.trajectories.map(tr => {
        const p = trajectoryProgress(tr);
        return `
        <div class="card traj">
          <div class="traj-head">
            <strong>${escapeHtml(tr.name)}</strong>
            <span class="num muted">${Math.round(p * 100)}%${tr.horizonMonths ? ' · ' + tr.horizonMonths + ' mois' : ''}</span>
          </div>
          ${progress(p, p >= 1 ? 'ok' : '')}
          <div class="row-actions">
            ${tr.milestones.map((m, i) => `
              <button class="chip ${m.done ? 'chip-done' : ''}" data-action="traj-toggle" data-traj="${tr.id}" data-idx="${i}">
                ${m.done ? icons.check(12) : ''} ${escapeHtml(m.title)}
              </button>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </section>`;
}
function heatLegend() {
  return `<span class="heat-scale">moins</span>
    ${['var(--c-surface-2)', '#D8D4F4', '#B3A9EC', '#8474DE', '#5E6AD2'].map(c => `<span class="dot" style="background:${c}"></span>`).join('')}
    <span class="heat-scale">plus</span>`;
}

/* ============================================================
   VUE 5 — RÉGLAGES
   ============================================================ */
export function viewSettings(state) {
  const debt = sleepDebt(state);
  const acc = state.settings.account || { mode: 'local', email: null };
  return `
    <header class="page-head"><div><p class="overline">Système</p><h1>Réglages</h1></div></header>

    <section class="section">
      <div class="section-head"><h2>Ma vie réelle</h2></div>
      <form class="card" id="settings-form">
        <div class="two-col">
          <div class="field"><label for="s-wake">Réveil prévu</label>
            <input type="time" id="s-wake" name="wakePlan" value="${state.profile.sleep.wakePlan}" /></div>
          <div class="field"><label for="s-bed">Coucher</label>
            <input type="time" id="s-bed" name="bedtime" value="${state.profile.sleep.bedtime}" /></div>
        </div>
        <div class="field"><label>Samedi après-midi</label>
          <div class="segmented" id="s-flex">
            <button type="button" data-val="perso" class="${state.profile.saturdayFlex === 'perso' ? 'on' : ''}">Bloc perso</button>
            <button type="button" data-val="mi-temps" class="${state.profile.saturdayFlex === 'mi-temps' ? 'on' : ''}">Moitié moitié</button>
            <button type="button" data-val="sortie" class="${state.profile.saturdayFlex === 'sortie' ? 'on' : ''}">Sortie amies</button>
          </div>
        </div>
        <div class="field"><label>Dimanche après-midi</label>
          <div class="segmented" id="s-sunday">
            <button type="button" data-val="0" class="${!state.profile.sundaySocial ? 'on' : ''}">Deep work dosé</button>
            <button type="button" data-val="1" class="${state.profile.sundaySocial ? 'on' : ''}">Amis / repos</button>
          </div>
        </div>
        <div class="field"><label>Apparence</label>
          <div class="segmented" id="s-theme">
            <button type="button" data-val="auto" class="${(state.settings.theme || 'auto') === 'auto' ? 'on' : ''}">Auto</button>
            <button type="button" data-val="light" class="${state.settings.theme === 'light' ? 'on' : ''}">Clair</button>
            <button type="button" data-val="dark" class="${state.settings.theme === 'dark' ? 'on' : ''}">Sombre</button>
          </div>
        </div>
        <button class="btn btn-primary" type="submit">Enregistrer</button>
      </form>
    </section>

    <section class="section">
      <div class="section-head"><h2>Sommeil</h2></div>
      <div class="card">
        <p>${escapeHtml(debt.note)}</p>
        <form id="sleep-form" class="inline-form">
          <input type="time" name="bed" value="${state.profile.sleep.bedtime}" aria-label="Heure de coucher" />
          <input type="time" name="wake" value="${state.profile.sleep.wakePlan}" aria-label="Heure de réveil" />
          <button class="btn" type="submit">J'ai dormi ça</button>
        </form>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Compte (optionnel)</h2></div>
      <div class="card">
        ${acc.mode === 'local' ? `
          <p><strong>Aucun compte requis.</strong> Comme Loop ou Pedometer : Kai fonctionne à 100% sur ton appareil, sans inscription.</p>
          <p class="muted">Crée un compte seulement si tu veux synchroniser tes appareils et sauvegarder dans le cloud (chiffré de bout en bout).</p>
          <form id="account-form" class="inline-form">
            <input type="email" name="email" placeholder="ton@email.com" required />
            <input type="password" name="pass" placeholder="Phrase secrète" required minlength="8" />
            <button class="btn btn-primary" type="submit">Créer mon compte</button>
          </form>
        ` : `
          <p>${icons.cloud(16)} Compte : <strong>${escapeHtml(acc.email || '')}</strong> — mode synchronisation.</p>
          <p class="muted">Serveur de sync : ${CONFIG.syncEndpoint || 'en attente de déploiement (architecture prête)'}</p>
          <button class="btn btn-ghost" data-action="account-logout">Revenir en mode local</button>
        `}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Sonneries</h2></div>
      <div class="card">
        <div class="row-actions">
          <button class="btn btn-primary" data-action="ring-enable">Activer sonneries + notifications</button>
          <button class="btn" data-action="ring-test">Tester</button>
        </div>
        <p class="muted">Permission : <b>${notificationsPermission()}</b> · installe l'app (PWA/APK) pour des sonneries fiables.</p>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Données</h2></div>
      <div class="card">
        <div class="row-actions">
          <button class="btn" data-action="export">${icons.download(15)} Exporter (.kaibak)</button>
          <label class="btn">Importer<input type="file" id="import-file" accept="application/json" hidden /></label>
          <button class="btn btn-danger-ghost" data-action="reset">${icons.trash(15)} Réinitialiser</button>
        </div>
        <p class="muted">Base locale ${CONFIG.dbName} (IndexedDB) · schéma v2 · app ${CONFIG.version} · jamais de compte obligatoire.</p>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Le contrat</h2></div>
      <div class="callout">
        Tu donnes tes weekly achievements chaque semaine, tu réponds aux comptes rendus, tu n'ignores pas les sonneries.
        Kai place tout, n'oublie rien, sonne, re-route, et te demande des comptes — sans jamais te mentir.
      </div>
    </section>`;
}

/* ============================================================
   FEUILLE : NOUVELLE TÂCHE (FAB)
   ============================================================ */
function addSheetHTML() {
  return `
    <h3>Nouvelle tâche</h3>
    <p class="muted">Le chauffeur trouve la place et gère les collisions.</p>
    <form id="add-form">
      <div class="field"><label for="f-title">Quoi ?</label>
        <input type="text" id="f-title" name="title" required placeholder="Ex : Commencer le logo kaydigi" /></div>
      <div class="two-col">
        <div class="field"><label for="f-domain">Domaine</label>
          <select id="f-domain" name="domain">${DOMAINS.map(d => `<option value="${d.id}">${d.label}</option>`).join('')}</select></div>
        <div class="field"><label for="f-dur">Durée (min)</label>
          <input type="number" id="f-dur" name="duration" value="45" min="15" step="15" /></div>
      </div>
      <div class="field"><label>Criticalité</label>
        <div class="segmented" id="f-crit">
          <button type="button" data-val="1">N1</button>
          <button type="button" class="on" data-val="2">N2</button>
          <button type="button" data-val="3">N3</button>
        </div>
      </div>
      <div class="field"><label for="f-zone">Meilleur moment</label>
        <select id="f-zone" name="zonePref">
          <option value="deep">Cerveau frais (matin, samedi, dimanche)</option>
          <option value="light">Léger (soir)</option>
          <option value="any">Peu importe</option>
        </select>
      </div>
      <div class="field"><label for="f-deadline">Avant quand ?</label>
        <input type="date" id="f-deadline" name="deadline" /></div>
      <button class="btn btn-primary btn-block" type="submit">Placer la tâche</button>
    </form>`;
}

function incomeSheetHTML() {
  const today = todayISO();
  return `
    <h3>Nouveau revenu</h3>
    <p class="muted">Kaydigi — ce que tu gagnes avec tes compétences.</p>
    <form id="income-form">
      <div class="field"><label for="i-client">Client</label>
        <input type="text" id="i-client" name="client" required placeholder="Ex : Cliente — site vitrine" /></div>
      <div class="two-col">
        <div class="field"><label for="i-service">Service</label>
          <select id="i-service" name="service">${SERVICES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}</select></div>
        <div class="field"><label for="i-amount">Montant (${CONFIG.currency})</label>
          <input type="number" id="i-amount" name="amount" required min="0" step="500" placeholder="25000" /></div>
      </div>
      <div class="two-col">
        <div class="field"><label for="i-date">Date</label>
          <input type="date" id="i-date" name="date" value="${today}" required /></div>
        <div class="field"><label for="i-status">Statut</label>
          <select id="i-status" name="status"><option value="paid">Encaissé</option><option value="pending">En attente</option></select></div>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Enregistrer le revenu</button>
    </form>`;
}

/* ============================================================
   ACTIONS
   ============================================================ */

export const actions = {
  go(ctx, el) { location.hash = '#/' + (el.dataset.view || 'today'); },
  'open-add': () => sheet(addSheetHTML()),
  'income-sheet': () => sheet(incomeSheetHTML()),
  'sheet-close': () => closeSheet(),

  /* --- calendrier --- */
  'cal-mode': (ctx, el) => { calMode = el.dataset.mode; ctx.render(); },
  'cal-prev': (ctx) => { calAnchor = shiftAnchor(-1); ctx.render(); },
  'cal-next': (ctx) => { calAnchor = shiftAnchor(1); ctx.render(); },
  'cal-today': (ctx) => { calAnchor = todayISO(); ctx.render(); },
  'cal-goto-day': (ctx, el) => {
    if (globalThis.__suppressDayJump) return;
    calAnchor = el.dataset.date; calMode = 'day'; ctx.render();
  },
  'cal-goto-month': (ctx, el) => {
    const y = parseISO(calAnchor).getFullYear();
    calAnchor = `${y}-${String(Number(el.dataset.month) + 1).padStart(2, '0')}-01`;
    calMode = 'month'; ctx.render();
  },
  'event-detail': (ctx, el) => {
    const o = ctx.state.occurrences.find(x => x.id === el.dataset.occ);
    if (!o) return;
    globalThis.__suppressDayJump = true;
    setTimeout(() => { globalThis.__suppressDayJump = false; }, 100);
    const t = ctx.state.tasks.find(x => x.id === o.taskId);
    if (!t) return;
    sheet(`
      <h3>${escapeHtml(t.title)}</h3>
      <p class="muted">${frShort(o.date)} · ${o.start} → ${o.end} · ${escapeHtml(o.zone || '')}</p>
      <p>${domainDot(t.domain)} ${domainLabel(t.domain)} · ${critChip(t.criticality)} · état : <b>${o.state}</b></p>
      <div class="row-actions">
        <button class="btn btn-primary" data-action="task-done" data-task="${t.id}">Fait</button>
        <button class="btn" data-action="task-partial" data-task="${t.id}">Partiel</button>
        <button class="btn btn-ghost" data-action="task-move" data-task="${t.id}">Décaler</button>
      </div>`);
  },

  /* --- sonneries --- */
  'ring-enable': async () => {
    ensureAudio();
    const p = await requestNotifications();
    playRing(); setTimeout(() => stopRingSafe(), 2200);
    toast(p === 'granted' ? 'Sonneries + notifications activées.' : 'Son activée. Notifications : ' + p);
  },
  'ring-test': () => { playRing(); setTimeout(stopRingSafe, 3200); toast('Voilà ce que ça donne.'); },
  'ring-start': (ctx) => {
    $('#ring-banner').classList.add('hidden');
    toast('C\'est parti — je te laisse travailler.');
  },
  'ring-defer': (ctx) => {
    const occId = globalThis.__kaiRingOcc;
    $('#ring-banner').classList.add('hidden');
    const o = ctx.state.occurrences.find(x => x.id === occId);
    if (!o) return;
    const t = ctx.state.tasks.find(x => x.id === o.taskId);
    if (t) openMoveSheet(ctx, t, o);
  },

  /* --- tâches --- */
  'task-done': (ctx, el) => { setTaskStatus(ctx, el.dataset.task, 'done'); closeSheet(); },
  'task-partial': (ctx, el) => { setTaskStatus(ctx, el.dataset.task, 'partial'); closeSheet(); },
  'task-skip': (ctx, el) => { setTaskStatus(ctx, el.dataset.task, 'skipped'); closeSheet(); },
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
    ctx.state.occurrences.push({ id: task + '@' + date + start, taskId: task, date, start, end, state: 'planned', zone: label || 're-planifié' });
    ctx.state.rerouteLog.push({ id: uid(), taskId: task, decision: 'auto', text: `Collision évitée : « ${t?.title || 'tâche'} » → ${frShort(date)} ${start}. ${cost || ''}`, at: new Date().toISOString() });
    closeSheet(); ctx.save();
    toast(`Collision évitée : « ${t?.title} » → ${frShort(date)} ${start}.`);
  },
  'boss-decide': (ctx, el) => {
    const t = ctx.state.tasks.find(x => x.id === el.dataset.task);
    if (!t) return;
    const dates = weekDates(addDays(todayISO(), 7));
    const lastDay = dates[6];
    const old = ctx.state.occurrences.find(o => o.taskId === t.id && o.state === 'planned');
    if (old) old.state = 'moved';
    ctx.state.occurrences.push({ id: t.id + '@' + lastDay + '16:00', taskId: t.id, date: lastDay, start: '16:00', end: toHM(960 + t.duration), state: 'planned', zone: 'Dimanche (choix du boss)' });
    ctx.state.rerouteLog.push({ id: uid(), taskId: t.id, decision: 'boss', text: `Le boss a décidé : « ${t.title} » → dimanche prochain 16h.`, at: new Date().toISOString() });
    closeSheet(); ctx.save();
    toast('Décision du boss enregistrée.');
  },

  /* --- ajout / placement --- */
  'add-submit': (ctx, form) => {
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
      ctx.state.rerouteLog.push({ id: uid(), taskId: task.id, decision: 'auto', text: `« ${task.title} » placé ${frShort(o.date)} à ${o.start} (${o.zone}).`, at: new Date().toISOString() });
      closeSheet();
      ctx.save();
      toast(`Placé ${frShort(o.date)} à ${o.start} (${o.zone}).`);
      calMode = 'week'; location.hash = '#/calendar';
    } else {
      closeSheet(); ctx.save();
      openBossSheet(ctx, task);
    }
  },
  'intake-run': (ctx) => {
    const wk = weekKey(todayISO());
    const todo = unplacedTasks(ctx.state, wk);
    if (!todo.length) return toast('Tout est déjà placé.');
    const res = placeWeek(todo, ctx.state, weekDates(todayISO()), ctx.state.occurrences, nowMin());
    ctx.state.occurrences.push(...res.occurrences);
    for (const w of res.warnings) ctx.state.rerouteLog.push({ id: uid(), decision: 'auto', text: w.text, at: new Date().toISOString() });
    ctx.save();
    toast(`${res.occurrences.length} tâche(s) placée(s).` + (res.warnings.length ? ' · ' + res.warnings[0].text : ''), 6000);
  },
  'rollover-run': (ctx) => {
    const wk = weekKey(todayISO());
    const next = weekKey(addDays(todayISO(), 7));
    const left = ctx.state.tasks.filter(t => t.week === wk && t.status !== 'done');
    if (!left.length) return toast('Rien à reporter — semaine accomplie.');
    for (const t of left) {
      ctx.state.tasks.push({ ...t, id: uid(), week: next, origin: 'rollover', status: 'todo' });
      t.status = 'skipped';
    }
    ctx.save();
    toast(`${left.length} tâche(s) reportée(s). Rien ne meurt.`);
  },

  /* --- comptes rendus --- */
  'checkin-answer': (ctx, el) => setTaskStatus(ctx, el.dataset.task || el.dataset.occ, el.dataset.result),
  'evening-save': (ctx) => {
    const note = $('#evening-note')?.value || '';
    ctx.state.checkins.push({ id: uid(), occurrenceId: 'evening-' + todayISO(), taskId: null, title: 'Point du soir', date: todayISO(), result: 'done', reason: note, at: new Date().toISOString() });
    ctx.save();
    toast('Point du soir enregistré. Repose-toi bien.');
  },

  /* --- trajectoires --- */
  'traj-toggle': (ctx, el) => {
    const tr = ctx.state.trajectories.find(t => t.id === el.dataset.traj);
    const m = tr?.milestones[Number(el.dataset.idx)];
    if (m) { m.done = !m.done; ctx.save(); }
  },

  /* --- finances --- */
  'income-add': (ctx, form) => {
    const fd = new FormData(form);
    ctx.state.finances.incomes.push({
      id: uid(), date: fd.get('date') || todayISO(),
      client: String(fd.get('client') || '').trim(),
      service: fd.get('service') || 'dev',
      amount: Number(fd.get('amount') || 0),
      status: fd.get('status') || 'paid', note: '',
    });
    closeSheet(); ctx.save();
    toast('Revenu enregistré.');
  },
  'income-delete': (ctx, el) => {
    ctx.state.finances.incomes = ctx.state.finances.incomes.filter(i => i.id !== el.dataset.id);
    ctx.save();
    toast('Revenu supprimé.');
  },
  'goals-save': (ctx, form) => {
    const fd = new FormData(form);
    ctx.state.finances.goals.monthlyTarget = Number(fd.get('monthlyTarget') || 0);
    ctx.state.finances.goals.yearTarget = Number(fd.get('yearTarget') || 0);
    ctx.save();
    toast('Objectifs enregistrés.');
  },

  /* --- compte (optionnel) --- */
  'account-create': (ctx, form) => {
    const fd = new FormData(form);
    ctx.state.settings.account = { mode: 'sync', email: String(fd.get('email') || '') };
    ctx.save();
    toast('Compte créé. La synchronisation s\'activera dès que le serveur Kai est en ligne.');
  },
  'account-logout': (ctx) => {
    ctx.state.settings.account = { mode: 'local', email: null };
    ctx.save();
    toast('Retour en mode local. Tes données restent sur ton appareil.');
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
    toast('Réglages enregistrés.');
  },
  'sleep-save': (ctx, form) => {
    const fd = new FormData(form);
    const bed = fd.get('bed'), wake = fd.get('wake');
    const hours = ((toMin(wake) + 1440 - toMin(bed)) % 1440) / 60;
    ctx.state.patterns.sleepLog.push({ date: todayISO(), bed, wake, hours: Math.round(hours * 10) / 10 });
    ctx.save();
    toast(`${hours.toFixed(1)}h de sommeil notées.`);
  },
  'theme-toggle': (ctx) => {
    const order = ['auto', 'light', 'dark'];
    const cur = ctx.state.settings.theme || 'auto';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    ctx.state.settings.theme = next;
    applyTheme(next);
    ctx.save();
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
      const st = importBackup(await file.text());
      Object.assign(ctx.state, st);
      ctx.save(); location.reload();
    } catch { toast('Fichier invalide.'); }
  },
  'reset': (ctx) => {
    if (!confirm('Tout effacer et repartir de zéro ?')) return;
    Object.assign(ctx.state, resetAll());
    ctx.save(); location.reload();
  },
};

/* ---------- helpers d'actions ---------- */
function shiftAnchor(dir) {
  if (calMode === 'day') return addDays(calAnchor, dir);
  if (calMode === 'week') return addDays(calAnchor, 7 * dir);
  if (calMode === 'month') {
    const d = parseISO(calAnchor);
    d.setMonth(d.getMonth() + dir);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  const d = parseISO(calAnchor);
  d.setFullYear(d.getFullYear() + dir);
  return `${d.getFullYear()}-01-01`;
}

function setTaskStatus(ctx, refId, status) {
  const t = ctx.state.tasks.find(x => x.id === refId);
  const occ = ctx.state.occurrences.find(o => (o.id === refId || o.taskId === refId) && o.state === 'planned');
  const task = t || ctx.state.tasks.find(x => x.id === occ?.taskId);
  if (!task) return;
  task.status = status;
  if (occ) occ.state = status === 'done' ? 'done' : status === 'partial' ? 'partial' : 'skipped';
  ctx.state.checkins.push({ id: uid(), occurrenceId: occ?.id || refId, taskId: task.id, title: task.title, date: occ?.date || todayISO(), result: status, reason: '', at: new Date().toISOString() });
  ctx.save();
  toast(status === 'done' ? `« ${task.title} » fait.` : status === 'partial' ? `« ${task.title} » en partie fait.` : `« ${task.title} » glisse — sans culpabilité.`);
}

function openMoveSheet(ctx, task, occ) {
  const from = occ?.date || todayISO();
  const res = reroute(task, ctx.state, ctx.state.occurrences, from, nowMin());
  if (res.decision === 'boss') return openBossSheet(ctx, task);
  sheet(`
    <h3>Le chauffeur re-route</h3>
    <p class="muted">« ${escapeHtml(task.title)} » — meilleurs chemins disponibles.</p>
    ${res.options.map((o, i) => `
      <button class="option-card" data-action="reroute-apply"
        data-task="${task.id}" data-date="${o.date}" data-start="${o.start}" data-end="${o.end}"
        data-label="${escapeHtml(o.zone)}" data-cost="${escapeHtml(o.cost)}">
        <strong>${i === 0 ? '★ ' : ''}${escapeHtml(o.label)}</strong>
        <div class="cost">${escapeHtml(o.cost)}</div>
      </button>`).join('')}
    <div class="row-actions"><button class="btn btn-ghost" data-action="sheet-close">Annuler</button></div>`);
}

function openBossSheet(ctx, task) {
  sheet(`
    <h3>Impasse — c'est toi le boss</h3>
    <p class="muted">Plus aucun créneau libre cette semaine pour « ${escapeHtml(task.title)} ».</p>
    <button class="option-card" data-action="boss-decide" data-task="${task.id}">
      <strong>Placer dimanche prochain à 16h</strong>
      <div class="cost">Glisse d'une semaine — la trajectoire reste surveillée.</div>
    </button>
    <button class="option-card" data-action="task-skip" data-task="${task.id}">
      <strong>Retirer de cette semaine</strong>
      <div class="cost">Elle repart dans la file — rien ne meurt.</div>
    </button>
    <div class="row-actions"><button class="btn btn-ghost" data-action="sheet-close">Réfléchir</button></div>`);
}

function stopRingSafe() {
  import('./alarms.js').then(m => m.stopRing()).catch(() => { });
}
