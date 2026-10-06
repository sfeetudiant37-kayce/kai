/* ============================================================
   main.js — boot applicatif · routeur · délégation · horloge
   ============================================================ */

import { CONFIG, log, bus } from './kernel.js';
import { load, save, restoreFromDB } from './store.js';
import { seedTasks, seedIncomes, weekKey, weekDates, todayISO } from './model.js';
import { openDB, healthCheck } from './db.js';
import { placeWeek } from './engine.js';
import * as views from './views.js';
import { startAlarmClock, ensureAudio, stopRing } from './alarms.js';
import { $, toast, closeSheet, applyTheme } from './ui.js';

/* ---------- état ---------- */
let state = load();

const ctx = {
  get state() { return state; },
  save() { save(state); render(); },
  render() { render(); },
  go(v) { location.hash = '#/' + v; },
};

/* ---------- routeur ---------- */
const routes = {
  today: views.viewToday,
  calendar: views.viewCalendar,
  finance: views.viewFinance,
  progress: views.viewProgress,
  settings: views.viewSettings,
};

function currentRoute() {
  const r = (location.hash || '').replace('#/', '').split('?')[0];
  return routes[r] ? r : 'today';
}

function render() {
  const route = currentRoute();
  $('#app').innerHTML = routes[route](state);
  document.querySelectorAll('#bottomnav [data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === route);
  });
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

/* ---------- délégation ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  // segments : bascule visuelle (criticalité, flex, thème…)
  if (el.parentElement?.classList.contains('segmented')) {
    el.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on'));
    el.classList.add('on');
    if (!el.dataset.action) return;
  }

  const fn = views.actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(ctx, el, e); }
});

const FORMS = {
  'add-form': 'add-submit',
  'income-form': 'income-add',
  'goals-form': 'goals-save',
  'account-form': 'account-create',
  'settings-form': 'settings-save',
  'sleep-form': 'sleep-save',
};

document.addEventListener('submit', (e) => {
  const action = FORMS[e.target.id];
  if (!action) return;
  e.preventDefault();
  views.actions[action](ctx, e.target);
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'import-file') views.actions['import-file'](ctx, e.target);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});

/* ---------- sonnerie ---------- */
function showRing(occ) {
  globalThis.__kaiRingOcc = occ.id;
  const title = state.tasks.find(t => t.id === occ.taskId)?.title || 'tâche';
  $('#ring-title').textContent = title;
  $('#ring-sub').textContent = `${occ.start} → ${occ.end} · Je commence ou je décale ?`;
  $('#ring-banner').classList.remove('hidden');
}

/* ---------- démarrage ---------- */
async function boot() {
  log.info('démarrage', CONFIG.appName, CONFIG.version);
  await openDB();
  try {
    const restored = await restoreFromDB();
    if (restored && restored.profile) state = { ...state, ...restored };
  } catch (e) { log.debug('restore', e); }

  if (!state.seeded) {
    const wk = weekKey(todayISO());
    state.tasks.push(...seedTasks(wk));
    state.finances.incomes.push(...seedIncomes());
    const res = placeWeek(state.tasks, state, weekDates(todayISO()), [], null);
    state.occurrences.push(...res.occurrences);
    state.seeded = true;
    save(state);
  }

  globalThis.__kaiSettings = state.settings;
  applyTheme(state.settings?.theme);
  render();

  startAlarmClock(
    () => state.occurrences.map(o => ({ ...o, title: state.tasks.find(t => t.id === o.taskId)?.title || '' })),
    showRing,
    () => state.settings?.ringtone !== false,
  );

  healthCheck().then(h => log.info('système', h));
  console.log('%cKai — le chauffeur est en service.', 'color:#5E6AD2;font-weight:bold');
}

document.addEventListener('pointerdown', () => ensureAudio(), { once: true });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}

boot();
