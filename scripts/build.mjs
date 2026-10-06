/* scripts/build.mjs — copie l'app statique dans www/ (Capacitor, déploiement) */
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
  'src/kernel.js',
  'src/model.js',
  'src/store.js',
  'src/db.js',
  'src/engine.js',
  'src/insights.js',
  'src/alarms.js',
  'src/icons.js',
  'src/charts.js',
  'src/ui.js',
  'src/views.js',
  'src/main.js',
];

rmSync(out, { recursive: true, force: true });
for (const f of files) {
  mkdirSync(join(out, dirname(f)), { recursive: true });
  copyFileSync(join(root, f), join(out, f));
}
console.log('✅ www/ prêt (' + files.length + ' fichiers) — npx cap sync');
