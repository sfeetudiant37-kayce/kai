/* ============================================================
   main.js — démarrage (vraie base IndexedDB), routeur, sonneries
   ============================================================ */

import { load, save, restoreFromDB, seedTasks, weekKey, weekDates, todayISO } from './store.js';
import { openDB } from './db.js';
import { placeWeek } from './engine.js';
import * as views from './views.js';
import { startAlarmClock, ensureAudio } from './alarms.js';
import { $, toast, closeSheet, applyTheme } from './ui.js';

/* ---------- état ---------- */
let state = load();

const ctx = {
  get state() { return state; },
  save() { save(state); render(); },
};

/* ---------- routeur ---------- */
const routes = {
  today: views.viewToday,
  week: views.viewWeek,
  add: views.viewAdd,
  checkins: views.viewCheckins,
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
  document.querySelectorAll('#bottomnav button').forEach(b => {
    b.classList.toggle('active', b.dataset.view === route);
  });
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

/* ---------- délégation des événements ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  // boutons de segments (criticalité, flex, dimanche, thème) : bascule visuelle
  if (el.parentElement?.classList.contains('seg')) {
    el.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on'));
    el.classList.add('on');
    if (!el.dataset.action) return;
  }

  const fn = views.actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(ctx, el, e); }
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.id === 'add-form') { e.preventDefault(); views.actions['add-submit'](ctx, form); }
  else if (form.id === 'settings-form') { e.preventDefault(); views.actions['settings-save'](ctx, form); }
  else if (form.id === 'sleep-form') { e.preventDefault(); views.actions['sleep-save'](ctx, form); }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'import-file') views.actions['import-file'](ctx, e.target);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});

/* ---------- la sonnerie : ça sonne à chaque truc à faire ---------- */
function showRing(occ) {
  globalThis.__kaiRingOcc = occ.id;
  const title = state.tasks.find(t => t.id === occ.taskId)?.title || 'tâche';
  $('#ring-title').textContent = "C'est l'heure — " + title;
  $('#ring-sub').textContent = `${occ.start} → ${occ.end} · Je commence ou je décale ?`;
  $('#ring-banner').classList.remove('hidden');
}

/* ---------- démarrage : vraie base → thème → écran → horloge ---------- */
async function boot() {
  // 1. ouvrir la base locale (IndexedDB) et restaurer si elle est plus fraîche
  await openDB();
  try {
    const restored = await restoreFromDB();
    if (restored && restored.profile) {
      state = { ...state, ...restored };
      if (!state.seeded) state.seeded = true;
    }
  } catch { /* première utilisation */ }

  // 2. première ouverture : on sème les weekly achievements d'exemple et on les place
  if (!state.seeded) {
    const wk = weekKey(todayISO());
    state.tasks.push(...seedTasks(wk));
    const res = placeWeek(state.tasks, state, weekDates(todayISO()), [], null);
    state.occurrences.push(...res.occurrences);
    state.seeded = true;
    save(state);
  }

  // 3. thème + réglages globaux
  globalThis.__kaiSettings = state.settings;
  applyTheme(state.settings?.theme);

  // 4. écran + horloge de sonnerie (toutes les 30 s)
  render();
  startAlarmClock(
    () => state.occurrences.map(o => ({
      ...o,
      title: state.tasks.find(t => t.id === o.taskId)?.title || '',
    })),
    showRing
  );

  console.log('%cKai est prêt — le chauffeur surveille ta semaine.', 'color:#A855F7;font-weight:bold');
}

// geste utilisateur → audio autorisé pour les futures sonneries
document.addEventListener('pointerdown', () => ensureAudio(), { once: true });

/* ---------- PWA : service worker (offline) ---------- */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* pas grave en dev */ });
}

boot();
