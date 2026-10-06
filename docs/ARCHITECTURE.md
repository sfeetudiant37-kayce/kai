# Architecture — Kai v2.0

## Principes

1. **Offline-first** : aucune donnée ne quitte l'appareil sans action explicite. Aucun compte requis (comme Loop / Pedometer) — le compte est une option de synchronisation.
2. **Couches strictes** : `kernel` → `infra (db/store)` → `domain (model/engine/insights)` → `ui (views/charts/icons)` → `app (main)`. Une couche ne connaît que celles en dessous.
3. **Pur/testable** : `model`, `engine`, `insights`, `charts` n'ont **aucun DOM** — testés sous Node dans la CI.
4. **Migrations versionnées** : le schéma IndexedDB évolue par `MIGRATIONS` (v1 → v2 : store `incomes`), comme un vrai backend.

## Arborescence

```
src/
  kernel.js    config · logger · bus d'événements
  model.js     entités, utilitaires date/heure, état par défaut, seeds        [pur]
  engine.js    le chauffeur : zones, placement, collisions, re-route           [pur]
  insights.js  agrégations finances + statistiques                             [pur]
  charts.js    graphiques SVG (barres, ligne, donut, heatmap)                  [pur]
  db.js        IndexedDB + MIGRATIONS + healthCheck                            [infra]
  store.js     persistance (miroir localStorage + source de vérité IndexedDB)  [infra]
  alarms.js    carillon Web Audio + Notification API
  icons.js     jeu d'icônes SVG inline
  ui.js        primitives DOM (toast, sheet, progress…)
  views.js     écrans + actions
  main.js      boot · routeur · délégation
tests/
  engine.test.mjs    13 tests du planificateur
  insights.test.mjs  finances + statistiques
.github/workflows/ci.yml   CI : tests + build + modules
```

## Flux de données

```
clic → main.js (délégation) → views.js (action)
    → engine.js / insights.js (décision, calcul)
    → store.js → db.js (IndexedDB, source de vérité)
               → localStorage (miroir de boot instantané)
    → views.js re-rendu + ui.js (toast/sheet)
    → alarms.js (carillon + notification si créneau atteint)
```

## Modèle de données (schéma v2)

- `profile` : travail, église, sommeil, routine du soir, flex samedi — la maison intelligente
- `tasks` : weekly achievements (domaine, criticalité N1-3, durée, préférence de zone)
- `occurrences` : placements dans le temps (état : planned/done/partial/skipped/moved)
- `checkins` : comptes rendus (la preuve, l'historique)
- `rerouteLog` : journal du chauffeur (traçabilité des collisions)
- `finances.incomes` : revenus kaydigi (client, service dev/CM/design/rédaction, montant, statut)
- `finances.goals` : objectifs mensuel/annuel
- `trajectories` : trajectoires longues (kaydigi, foi, design…) avec jalons

## Stratégie de synchronisation (compte optionnel)

Aujourd'hui : mode `local` (tout sur l'appareil). L'interface de compte existe (comme Acupedo/Loop : l'option ne doit pas manquer) ; l'endpoint `CONFIG.syncEndpoint` est prêt pour un futur relais chiffré de bout en bout (delta sync par horloge logique — voir `kai-production-roadmap.md` §5).

## Packaging

- **PWA** : `sw.js` cache-first, installable partout.
- **APK/iOS** : `scripts/build.mjs` → `www/` → Capacitor (`capacitor.config.json`) → notifications natives programmées (sonneries appli fermée).
