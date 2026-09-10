# Firestore Security Specification - Keerpunt Badgeboek

## 1. Data model

The data lives in **one collection per concept** (small documents, browsable):

| Collection | Doc id | Contents |
|---|---|---|
| `gebruikers/{email}` | e-mail | staff account: `{ naam, rol, vestigingen[], actief, dev? }` — **no passwords**; `vestigingen` = de campussen die een mentor mag zien (meerdere mogelijk), leeg/genegeerd bij coördinator+beheerder |
| `leerlingen/{id}` | pupil id | roster: name, vestiging, leerjaar, klasgroep, e-mail |
| `mentoren/{id}` | mentor id | demo roster (fictional) |
| `groepen/{id}` | group id | `{ naam, leerlingIds[], mentorId? }` |
| `curriculum/{stroom}` | `1A`/`1B`/`2A`/`3A` | node marker (empty doc); the badge-set lives in subcollections |
| `curriculum/{stroom}/cursussen/{cursusId}` | cursus id | `{ naam, volgorde }` |
| `curriculum/{stroom}/cursussen/{cursusId}/badges/{badgeId}` | badge id | `{ groep, omschrijving, volgorde, categorie }` — one doc per badge |
| `deelbadges/{id}` | deelbadge id | teacher-made test + `scores{leerlingId}` + `scoreNotities` + `scoreAudit` |
| `evaluaties/{schooljaar}/leerlingen/{leerlingId}` | pupil id | `{ kleuren{badgeId}, notities{badgeId}, gewist[], auditLog{} }` |
| `meldingen/{leerlingId}` | pupil id | `{ meldingen[], gezienOp }` |
| `instellingen/app` | `app` | `{ schooljaar, matrixStromen[], matrixCursus }` |
| `instellingen/overlays` | `overlays` | `{ doelWijzigingen, doelenImport, rubriekWijzigingen }` |

## 2. Access rules

1. Default-deny catch-all across every path.
2. **Role resolution is server-side** via `get()` on the caller's `/gebruikers/{email}` doc
   (`actieveRol()` → only if `actief == true`). The client cannot escalate its own role.
3. `isBootstrapAdmin()` (`arno.boriau@keerpuntscholen.be`) is a permanent fallback so the first
   beheerder can always sign in and create accounts, even when `/gebruikers` is empty.
4. **`isPersoneel()`** (any active `beheerder`/`coordinator`/`mentor`, or bootstrap admin) may
   read and write everything the normal app-save touches: `leerlingen`, `mentoren`, `groepen`,
   `deelbadges`, `meldingen`, `evaluaties/{sj}/leerlingen/{id}`, `instellingen/*`, and read
   the `curriculum` subtree (incl. the `cursussen`/`badges` collectionGroup queries the app
   subscribes to). The deelbadge-"types" on `/deelevaluaties` are **derived** from the badges
   (grouped by `groep`), not stored separately.
5. **`isBeheerder()`** only may: write the `curriculum` subtree (`curriculum/{stroom}`, its
   `cursussen/{id}` and `badges/{id}` docs) and manage `/gebruikers`
   (create/update/delete + list). `/gebruikers` writes are shape-restricted
   (`hasOnly` key allow-list incl. optional `dev` bool, `rol` ∈ the three roles, `actief is
   bool`, `vestigingen is list`; het oude `vestiging`-stringveld blijft toegelaten voor de
   overgang) and can never contain a password field. `dev: true` = extra toegang tot
   in-ontwikkeling-pagina's (Deelbadges, Rubrics); enkel de bootstrap-beheerder toont het
   vinkje in de UI. (Editing doelen/rubrieken is client-side beheerder-only; het
   `instellingen/overlays`-doc zelf is personeel-writable omdat het meerijdt in de gebatchte
   app-save — zie "Nog niet afgedwongen".)
6. **Afgesloten schooljaren zijn alleen-lezen in de regels.** `evaluaties/{sj}/leerlingen/{id}`
   and `deelbadges/{id}` deny **all writes** (create/update/delete) when `sj` is in
   `afgeslotenJaren()` — een **vaste lijst** `['2024-2025']` die `AFGESLOTEN_SCHOOLJAREN` uit
   `src/lib/schooljaar.ts` spiegelt (geen document-lees per write). Wordt het afsluiten later een
   beheerder-actie in de app, dan hier meelezen uit `instellingen/app.afgeslotenSchooljaren`.
   Een deelbadge zonder `schooljaar`-veld = behandeld als open.
7. Any verified user may read **only their own** `/gebruikers/{email}` doc (needed by the gate).
8. A verified `@keerpuntscholen.be` account with **no** `/gebruikers` doc (or `actief:false`) is
   denied everywhere except its own account doc.

### Nog niet afgedwongen in de regels (bewust, prototype-fase)

- **Per-vestiging scoping.** `isPersoneel()` geeft elke actieve mentor lees- én schrijftoegang
  tot *alle* `leerlingen`/`evaluaties`/`deelbadges`/`meldingen` van *alle* vestigingen. De
  vestiging-afscherming zit alleen in de UI (`src/lib/rechten.ts`, `useBereik` → `magLeerlingZien`).
  Het datamodel ondersteunt nu **meerdere vestigingen per mentor** (`gebruikers/{email}.vestigingen[]`,
  aan te vinken op `/gebruikers`) — dat was de reden om de regel-enforcement uit te stellen.
  Afdwingen in de regels vergt `leerlingen`/`evaluaties` per vestiging te nesten (of een
  query-constraint-regel) + de abonnementen in de persistentielaag aan te passen.
- **`instellingen/overlays`** (doel-/rubriekwijzigingen) is personeel-writable — het rijdt mee
  in de gebatchte `bewaar()` van elke mentor, en een `isBeheerder()`-only regel (met een
  gelijkheids-uitzondering voor de meerijdende save) bleek te broos zonder rules-testsuite.
  Het bewerken van doelen/rubrieken zit client-side wél achter de beheerder.
- **Firebase App Check** staat niet aan — elke `@keerpuntscholen.be` (dus ook elke leerling)
  kan bij Firebase Auth inloggen; alleen het ontbreken van een `gebruikers`-doc houdt ze tegen.
- **`auditLog{}`** in het evaluatie-doc wordt client-side geschreven → in principe vervalsbaar.
  Een echt onvervalsbaar auditspoor vergt een Cloud Function.
- **Bootstrap-admin** (`arno.boriau@keerpuntscholen.be`) is een permanente hardcoded superuser
  — noodluik; uit te faseren zodra `/gebruikers` stabiel gevuld is.
- **Regio:** de Firestore-database staat in `europe-west1` (België) — EU-conform. Vastleggen
  bij het aanmaken van het echte Google-project.

## 3. Payloads designed to fail (`PERMISSION_DENIED`)

1. Unauthenticated read/write on any collection.
2. `email_verified: false` token.
3. Verified non-Keerpunt account (`x@gmail.com`) reading `leerlingen` or `evaluaties`.
4. Verified `@keerpuntscholen.be` with no `/gebruikers` doc reading `evaluaties/.../{id}`.
5. `mentor` / `coordinator` writing `curriculum/1A` or any `curriculum/1A/cursussen/.../badges/...` doc.
6. `mentor` writing any `/gebruikers` doc (incl. `{rol:'beheerder'}` on their own doc).
7. `beheerder` writing a `/gebruikers` doc with a `wachtwoord`/`password` key.
8. Account with `actief:false` reading `badgeboek` data.
9. Path traversal / oversized ids (Firestore rejects `/` in ids).
10. Any personeel writing `evaluaties/2024-2025/leerlingen/{id}` (create, update én delete) —
    afgesloten schooljaar.
11. Any personeel creating/updating/deleting a `deelbadges/{id}` doc whose `schooljaar` is
    `2024-2025`.
