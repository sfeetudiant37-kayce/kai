# Kai — le chauffeur personnel de Kayliah 🚗💨

> **Le système de consistency** — il organise ta semaine à partir de tes *weekly achievements*, **sonne** quand c'est l'heure, **gère les collisions** comme une voiture intelligente qui re-route dans l'embouteillage, et **te demande des comptes** comme une personne.
> 100% **hors-ligne**, JavaScript pur (zéro framework, zéro dépendance), installable sur téléphone et laptop.

---

## Le contrat (le cœur du produit)

| Elle (le boss) | Kai (le chauffeur) |
|---|---|
| Donne ses weekly achievements chaque semaine (dimanche 15h-16h) | **Place tout** dans la semaine — chaque domaine a sa place |
| Répond aux comptes rendus | **Ne rien oublier** — ce qui traîne revient dans la file |
| N'ignore pas les sonneries | **Sonner** à chaque créneau |
| | **Re-route automatiquement** en cas de collision, et notifier chaque changement |
| | Venir la voir **uniquement en impasse totale** — la dernière décision reste au boss |
| | Être **human-centric** : jamais de shame, mais aucune complaisance |

## La maison intelligente (codée telle quelle)

- **Travail** : lun-ven 8h30-18h · samedi 9h-14h · rentrée 19h max
- **Église** : dimanche 8h-13h · **Entrée hebdo + revue** : dimanche 15h-16h
- **Coucher 22h30** · réveil 4h/5h/6h → le **matin bonus** (0h30-3h30) devient une zone de deep work
- **Routine du soir (critical times, jamais déplacés)** : repos, manger, distraction, se laver, prière + méditation, compte rendu du soir
- **Samedi après-midi FLEX** : sortie amies **OU** bloc perso — le chauffeur re-route ce qui devait se faire
- **Priorités** : **N1** jamais déplacées · **N2** protégées (replanifiées avec notification) · **N3** souples (glissent sans culpabilité)
- **Règle sommeil** : <6h deux nuits de suite → le chauffeur allège le lendemain

## Les 6 écrans

1. **Aujourd'hui** — anneau de progression, maintenant/ensuite, matin bonus, messages du chauffeur
2. **Ma semaine** — charge demandée vs capacité, placement automatique, blocs fixes
3. **Ajouter** — insertion en milieu de semaine + re-route automatique (« Collision évitée : … »)
4. **Comptes rendus** — questions du système, point du soir (1 min), revue de semaine
5. **Progression** — trajectoires : kaydigi (logo → identité → offres → clients), foi, design, blog…
6. **Réglages** — vie réelle, samedi flex, sommeil, sonneries, export/import `.kaibak`

## Lancer l'appli

```bash
# option 1 : n'importe quel serveur statique
npm start                # python3 -m http.server 8080
# puis ouvrir http://localhost:8080

# option 2 : Node pur
npx serve .
```

**Sur ton téléphone (PWA)** : ouvrir l'URL → menu du navigateur → *Installer l'application* (ou *Ajouter à l'écran d'accueil*). Ouvre l'appli au moins une fois par jour pour des sonneries fiables (limitation des navigateurs, pas de Kai).

⚠️ **Android** : paramètres batterie → Kai = *Sans restriction*, et verrouille Kai dans les apps récentes, sinon le système tue les sonneries.

## Tests

```bash
npm test    # node test/engine.test.mjs — 13 tests du chauffeur
```

Couverts : zones de la maison intelligente, aucun double-booking, détection de surcharge, ajout sans collision, re-route (3 options, jours distincts, coût humain), **impasse → décision au boss**, dette de sommeil, rollover (rien ne meurt).

## Architecture (vanilla, offline-first)

```
index.html            shell + bannière de sonnerie + modales
css/tokens.css        design system (couleurs domaines, N1/N2/N3, typo…)
css/app.css           styles applicatifs (mobile-first)
js/store.js           données (localStorage), profil de vie, backup .kaibak
js/engine.js          LE CHAUFFEUR : zones, placement, collisions, re-route
js/alarms.js          carillon Web Audio + notifications + vibration
js/views.js           les 6 écrans + actions
js/main.js            routeur + horloge de sonnerie
sw.js                 service worker (offline complet)
```

**Choix techniques assumés** : zéro dépendance (tout fonctionne sans npm install, sans build, sans internet), ES modules, Web Audio (aucun fichier son), localStorage + export chiffrable plus tard. Le moteur (`engine.js`) est **pur et testé sous Node** — c'est la pièce maîtresse.

## Limitations honnêtes

- Les sonneries fiables exigent l'appli ouverte ou installée en PWA (règle des navigateurs). L'app sonne toutes les 30 s dès qu'un créneau commence.
- iOS limite les notifications quand l'appli est fermée — garde le widget / l'appli épinglée.
- Les données vivent dans le navigateur de l'appareil : **exporte ta sauvegarde `.kaibak`** régulièrement (Réglages).

## Feuille de route (voir `kai-production-roadmap.md`)

- [x] MVP web : placement, collisions, sonneries, comptes rendus
- [ ] Sync téléphone ↔ laptop (delta sync LAN/USB)
- [ ] Version installable desktop (Tauri/Electron)
- [ ] Multi-utilisateurs (les autres « dans ma situation »)

---

Fait avec 💜 pour Kayliah — *la lumière s'allume quand tu rentres chez toi.*
