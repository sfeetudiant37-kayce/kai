/* ============================================================
   alarms.js — notifications & carillon
   Web Audio (synthèse, zéro asset) + Notification API + vibration.
   ============================================================ */

import { log, bus } from './kernel.js';

let ctx = null;
let ringing = false;
let ringTimer = null;

export function ensureAudio() {
  try {
    ctx = ctx || new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  } catch { return false; }
}

export function playRing() {
  if (!ensureAudio()) return;
  stopRing();
  ringing = true;
  const seq = () => {
    if (!ringing) return;
    chime(880, 0.0, 0.35);
    chime(660, 0.35, 0.55);
    chime(880, 0.95, 0.35);
    chime(1174, 1.3, 0.7);
  };
  seq();
  ringTimer = setInterval(seq, 3200);
  try { navigator.vibrate?.([300, 150, 300, 150, 500]); } catch { }
}

function chime(freq, delay, dur) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.32, t0 + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function stopRing() {
  ringing = false;
  if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
  try { navigator.vibrate?.(0); } catch { }
}

export function notificationsSupported() { return 'Notification' in globalThis; }
export function notificationsPermission() { return notificationsSupported() ? Notification.permission : 'unsupported'; }

export async function requestNotifications() {
  if (!notificationsSupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export function notify(title, body) {
  if (notificationsSupported() && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: 'icon.svg' }); } catch (e) { log.debug('notify', e); }
  }
}

/* ---------- horloge de sonnerie : vérification toutes les 30 s ---------- */
const rungIds = new Set();
let tickHandle = null;
let onRingCb = null;

export function startAlarmClock(getOccurrences, onRing, isRingEnabled = () => true) {
  onRingCb = onRing;
  if (tickHandle) clearInterval(tickHandle);
  const tick = () => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    for (const occ of getOccurrences()) {
      if (occ.date !== today) continue;
      if (occ.state === 'done' || occ.state === 'skipped' || occ.state === 'moved') continue;
      const [h, m] = occ.start.split(':').map(Number);
      const startMin = h * 60 + m;
      if (nowMin >= startMin && nowMin < startMin + 1 && !rungIds.has(occ.id)) {
        ringFor(occ, isRingEnabled);
      }
    }
  };
  tickHandle = setInterval(tick, 30000);
  tick();
}

function ringFor(occ, isRingEnabled) {
  rungIds.add(occ.id);
  if (isRingEnabled()) playRing();
  notify('Kai — ' + (occ.title || 'tâche'), `${occ.start} → ${occ.end} · Je commence ou je décale ?`);
  bus.emit('ring', occ);
  onRingCb?.(occ);
}

export function dismissRung(id) { rungIds.add(id); }
