# Keerpunt Badgeboek

Webapp om het **dagelijks werk** van leerlingen te registreren met het Keerpunt-badgeboek: per
badge een **kleur** i.p.v. een cijfer — `rood` → `geel` → `groen` → `blauw` (positiefste laatst),
plus wit voor "niet aangeboden" en drie neutrale statussen (afwezig / vrijgesteld / n.v.t.).
Geen cijfers, geen "geslaagd/gefaald". Zie `src/lib/ratings.ts`.

Deze README is bedoeld voor wie aan de **code** werkt (Arno, of een AI-assistent). Gebruikers-
documentatie staat elders — zie "Documentatie" hieronder.

## Status (2026-09)

Draait op een **echte backend**: Firestore + verplichte Google-login (`@keerpuntscholen.be`).
Geen prototype meer voor wat de architectuur betreft, wél nog met **fictieve** leerlingen/
mentoren — echte leerlinggegevens wachten op een GDPR-sign-off (zie `docs/roadmap-voor-echte-data.md`).
Personeelsaccounts zijn intussen wel echt (zie `security_spec.md`).

- **Auth**: Google-login via de `Toegangspoort` (`src/components/Toegangspoort.tsx`). Enkel
  geverifieerde `@keerpuntscholen.be`-accounts met een actief `gebruikers`-doc komen binnen
  (met een hardcoded bootstrap-beheerder als noodluik).
- **Rollen**: `beheerder` (alles) · `coordinator` (alle vestigingen, geen accountbeheer) ·
  `mentor` (enkel eigen vestiging(en)) · `leerling` (demo/toekomst — nog geen leerling-login).
- **Data**: Firestore, één collectie per concept, per-vestiging afgeschermd in de regels voor
  `leerlingen`/`evaluaties`/`deelbadges`. Zie "Datamodel" hieronder en `security_spec.md`.
- **Lokale modus** bestaat nog (`VITE_PERSISTENTIE=local`, alles in `localStorage`, iedereen
  "beheerder") — handig om snel te itereren zonder Firebase, niet voor echt gebruik.

## Stack

- React 19 + TypeScript, Vite 8, React Router 7 (`createHashRouter`)
- Firebase (Firestore + Auth) — `firebase` npm-package, geen Cloud Functions
- Vitest + `@firebase/rules-unit-testing` voor de regels-tests (emulator, vergt een JDK 21+)

## Scripts

```bash
npm install
npm run dev          # dev-server (http://localhost:3000)
npm run build        # typecheck + productiebuild → dist/
npm run preview      # dist/ lokaal bekijken
npm run lint         # oxlint
npm run test:rules   # Firestore-regels tegen de emulator (start 'm automatisch, vergt Java 21+)
npm test             # tegen een al draaiende emulator
```

`.env` (kopie van `.env.example`) kiest de persistentielaag (`VITE_PERSISTENTIE=local|firebase`)
en de Firebase-config. `.env` staat in `.gitignore` — de sleutels zijn geen geheim (publieke
web-config), de **regels** zijn de echte beveiliging.

## Deploy

Geen CI in de repo. Twee aparte stappen, allebei handmatig:

1. **De app**: AI Studio drijft de deploy (na een push naar `main`: opnieuw syncen + deployen
   in AI Studio). `npm run build` zelf levert een statische `dist/` op die overal kan draaien
   (hash-routing, relatieve asset-paden) als je ooit los van AI Studio wil hosten.
2. **De Firestore-regels** (`firestore.rules`) — **apart**, via de Firebase-console (Rules →
   Publish) of `firebase deploy --only firestore:rules`. Een gewone app-deploy raakt de regels
   niet aan. Na een regel-wijziging: **eerst als beheerder inloggen** vóór iemand anders de app
   gebruikt — sommige migraties (bv. het vestiging-veld op oudere evaluatie-docs) lopen pas dan.

## Documentatie

| Document | Voor wie |
|---|---|
| Deze README | ontwikkelaar / AI — structuur en architectuur |
| `src/lib/data/README.md` | de persistentielaag in detail |
| `security_spec.md` | de Firestore-regels: wie mag wat, en waarom |
| `docs/roadmap-voor-echte-data.md` | wat nog moet gebeuren vóór echte leerlinggegevens |
| `docs/smartschool-sync-plan.md` | plan voor een Smartschool-koppeling (nog niet gebouwd) |
| `docs/handleidingen/Badgeboek - naslag voor mentoren.pdf` (+ `.pages`-bronbestand) | mentoren: naslag per knop/functie, geen uitleg over wat kleuren betekenen |
| `docs/handleidingen/Badgeboek - naslag voor beheerders.pdf` (+ `.pages`-bronbestand) | beheerders: zelfde opzet + wat onomkeerbaar is |

## Structuur

```
src/
  main.tsx                # entry
  router.tsx               # routes (hash router), rolafhankelijke lazy chunks
  components/
    Toegangspoort.tsx       # verplichte Google-login-poort (firebase-modus)
    Shell.tsx / Layout.tsx / LeerlingShell.tsx   # mentor/beheerder-zijbalk vs. leerling-topbar
    AlleenBeheerder.tsx / AlleenDev.tsx           # route-gates
    RatingCell.tsx / RatingPicker.tsx / ColorBar.tsx   # de kleurkeuze-UI
    GroepEditor.tsx / DeelevaluatieEditor.tsx / RubriekEditor.tsx / DoelEditor.tsx  # modale editors
  pages/
    Dashboard.tsx           # Overzicht (mentor/beheerder): voortgang per groep
    Badges.tsx               # badgematrix: leerlingen × badges
    Deelevaluaties.tsx       # deelbadges (toetsen/opdrachten) — dev-only vlag
    Doelen.tsx               # minimumdoelen per stroom
    Rubrics.tsx               # uitgeschreven beoordelingsrubrieken (naslag)
    Groepen.tsx / Students.tsx / StudentDetail.tsx
    Gebruikers.tsx / Vestigingen.tsx / Gegevens.tsx   # beheerder-only
    Aanmelden.tsx             # "bekijk als" leerling/mentor (beheerder-only, geen echte login)
    LeerlingHome.tsx / LeerlingCursus.tsx            # kindvriendelijke leerlingweergave
  lib/
    store.ts                 # useSyncExternalStore — in-memory reactieve store + domeinregels
    rechten.ts                # wie ziet welke leerlingen (vestiging-scope, UI-laag)
    firebaseAuth.ts           # wie is aangemeld + welk personeelsaccount hoort erbij
    curriculum.ts + curriculum1A/1B/2A/3A.ts        # het badgeboek (cursussen → badges)
    minimumdoelen*.ts         # eindtermen per stroom
    rubrieken.ts + rubriekenData.ts                 # uitgeschreven rubrics (bundel)
    vestigingen.ts            # de vestigingen-lijst (bundel + DB-override)
    gebruikers.ts             # personeelsrollen + normalisatie van gebruikers-docs
    seedGebruikers.ts         # fictieve demo-leerlingen/mentoren
    data/                     # persistentielaag — zie src/lib/data/README.md
scripts/
  extract_badgeboeken.py      # (historisch) curriculum*.ts uit de oude Word-badgeboeken
  extract_badges.py           # curriculum1A/1B/2A/3A.ts uit deelevaluaties_alle-graden-*.xlsx
  extract_rubrics.py          # rubriekenData.ts uit rubrics_overzicht.xlsx
  add-testteam.mjs            # (gitignored) eenmalig demo-personeel wegschrijven
test/
  firestore.rules.test.ts     # de regels tegen de emulator — zie "Scripts" hierboven
docs/
  reference/                  # bronbestanden (xlsx/docx) voor de extract-scripts + fictieve data
  roadmap-voor-echte-data.md
  smartschool-sync-plan.md
```

## Datamodel (Firestore)

Eén collectie per concept, kleine documenten, browsebaar in de console:

```
gebruikers/{email}                                          personeelsaccount (rol, vestigingen[])
leerlingen/{id}            mentoren/{id}            groepen/{id}
curriculum/{stroom}/cursussen/{cursusId}/badges/{badgeId}    het badgeboek (beheerder bewerkt in de console)
rubrieken/{stroom}/cursussen/{cursusId}/lijst/{rubriekId}    uitgeschreven rubrics (zelfde vorm als curriculum)
deelbadges/{id}                                              toetsen/opdrachten + scores per leerling
evaluaties/{schooljaar}/leerlingen/{leerlingId}              badge-kleuren/notities/audit, per schooljaar
meldingen/{leerlingId}      instellingen/app      instellingen/overlays
vestigingen/{id}                                             de campussen (beheerbare lijst)
```

`curriculum` en `rubrieken` delen bewust dezelfde structuur (`{stroom}/cursussen/{cursusId}/…`,
dezelfde `cursusId`-vorm) — badges bewerk je rechtstreeks in de Firestore-console (beheerder-
only, geen editor in de app); rubrics kunnen wel via `RubriekEditor` in de app. Zie
`src/lib/data/firestoreLayout.ts` voor het vertaalpaar store ↔ Firestore-documenten.

**Vestiging-afscherming** zit zowel client-side (`src/lib/rechten.ts`, wat de UI toont) als in
de Firestore-regels zelf (`leerlingen`/`evaluaties`/`deelbadges` — een mentor-query buiten de
eigen vestiging wordt geweigerd, niet gefilterd). Zie `security_spec.md`.
