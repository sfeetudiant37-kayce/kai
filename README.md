# Kai — programme · progression · revenus

> **Le système de consistency de Kayliah** : un calendrier intelligent qui place tes *weekly achievements*, sonne quand c'est l'heure, gère les collisions comme un chauffeur qui re-route dans l'embouteillage, te demande des comptes, et suit **rigoureusement** tes progrès et tes revenus (kaydigi) sur des semaines, des mois, des années.
> **100% hors-ligne · aucun compte requis · JavaScript pur, zéro dépendance.**

---

## Ce que fait le système

| Écran | Ce qu'il montre |
|---|---|
| **Aujourd'hui** | Agenda du jour (timeline), KPIs (tâches, série, charge), point du soir, revue de semaine, journal du chauffeur |
| **Calendrier** | **Vrai calendrier** : Jour · **Semaine** (grille horaire, blocs proportionnels, ligne « maintenant ») · **Mois** (charges + revenus par jour) · **Année** (réalisation + revenus par mois) |
| **Finances** | Revenus kaydigi : KPIs (ce mois, encaissé, moyenne, **projection annuelle**), graphique 12 mois, répartition par service (dev web, CM, design, rédaction), objectifs, historique |
| **Progression** | **Heatmap** de régularité (16 semaines), courbe heures réalisées vs planifiées, heures par domaine, trajectoires longues (kaydigi, foi, design, blog…) |
| **Réglages** | Vie réelle (travail, église, sommeil, samedi flex), **compte optionnel**, sonneries, thème clair/sombre, données |

**Le contrat** : tu donnes tes weekly achievements (dimanche 15h-16h), Kai les place, sonne, re-route les collisions (notification : « Collision évitée : … »), et **en impasse seulement** te consulte — la dernière décision reste au boss. Rien ne meurt : les non-faits sont reportés.

## Le design (aucun dégradé « IA », de la rigueur)

- Calendrier temps-réel type Akiflow/Morgen/Structured : grille horaire, blocs proportionnels, clic pour agir
- Graphiques SVG dessinés à la main : barres, courbes, donut, heatmap (style Loop/GitHub)
- Neutres maîtrisés + **un seul accent** (#5E6AD2) · couleur = domaine de vie · chiffres tabulaires
- Icônes SVG cohérentes (grille 20px, trait 1.8) — **zéro émoji dans l'interface**
- Mode sombre précis · responsive mobile → desktop · `prefers-reduced-motion` respecté

## L'ingénierie (sous le capot)

```
src/kernel.js   config · logger · bus          src/db.js     IndexedDB + MIGRATIONS
src/model.js    domaine (pur, testé)           src/store.js  persistance + backup .kaibak
src/engine.js   le chauffeur (pur, testé)      src/insights.js  finances + stats (pur, testé)
src/charts.js   graphiques SVG (pur)           src/alarms.js sonneries Web Audio + notifications
src/views.js    écrans + actions               src/main.js   boot · routeur
```
- **21 tests Node** (`npm test`) + **CI GitHub Actions** (tests + build + modules)
- Base de données **IndexedDB** versionnée (migrations), localStorage en miroir de boot
- Comme Loop / Pedometer : **pas de compte obligatoire** ; l'option compte (sync cloud) existe dans Réglages
- PWA offline complet · prêt pour l'APK Capacitor (sonneries appli fermée)

## Lancer

```bash
npm start        # http://localhost:8080
npm test         # 21 tests
npm run build    # artefact statique dans www/
```

**Téléphone (PWA)** : ouvrir l'URL → *Installer l'application*. Android : batterie → Kai = « Sans restriction ».
**APK (sonneries appli fermée)** : `npm run build && npx cap add android && npx cap sync && npx cap open android`.

## Inspirations (recherchées, non copiées)

Akiflow · Morgen · Structured · Sunsama · Motion/Reclaim (re-route automatique) · Loop Habit Tracker (offline, heatmap, sans compte) · Pedometer de Simple Design (« no sign-in », graphiques mobiles) — avec **les particularités de Kayliah** en plus : la maison intelligente (19h, église 8h-13h, coucher 22h30, réveil 4-6h, samedi flex), le chauffeur/boss, les comptes rendus, kaydigi.

---

Fait avec rigueur pour Kayliah. *La lumière s'allume quand tu rentres chez toi.*
