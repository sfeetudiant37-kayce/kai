/* scripts/build.mjs — copie l'app statique dans www/ (pour Capacitor / déploiement) */
import { mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');

const files = [
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'sw.js',
  'css/tokens.css',
  'css/app.css',
  'js/main.js',
  'js/store.js',
  'js/db.js',
  'js/engine.js',
  'js/alarms.js',
  'js/ui.js',
  'js/views.js',
];

rmSync(out, { recursive: true, force: true });
for (const f of files) {
  mkdirSync(join(out, dirname(f)), { recursive: true });
  copyFileSync(join(root, f), join(out, f));
}
console.log('✅ www/ prêt (' + files.length + ' fichiers) — npx cap sync');
