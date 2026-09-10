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
| `deelbadges/{id}` | deelbadge id | teacher-made test + `scores{leerlingId}` + `scoreNotities` + `scoreAudit` + `vestiging` (`""` = overkoepelend) |
| `evaluaties/{schooljaar}/leerlingen/{leerlingId}` | pupil id | `{ kleuren{badgeId}, notities{badgeId}, gewist[], auditLog{}, vestiging }` — `vestiging` gedenormaliseerd van de leerling, voor de regels |
| `meldingen/{leerlingId}` | pupil id | `{ meldingen[], gezienOp }` |
| `instellingen/app` | `app` | `{ schooljaar, matrixStromen[], matrixCursus }` — personeel-write (rijdt mee in `bewaar()`) |
| `instellingen/overlays` | `overlays` | `{ doelWijzigingen, doelenImport, rubriekWijzigingen }` — **beheerder-write**, aparte schrijfweg (`schrijfOverlays`) |

## 2. Access rules

1. Default-deny catch-all across every path.
2. **Role resolution is server-side** via `get()` on the caller's `/gebruikers/{email}` doc
   (`actieveRol()` → only if `actief == true`). The client cannot escalate its own role.
3. `isBootstrapAdmin()` (`arno.boriau@keerpuntscholen.be`) is a permanent fallback so the first
   beheerder can always sign in and create accounts, even when `/gebruikers` is empty.
4. **`isPersoneel()`** (any active `beheerder`/`coordinator`/`mentor`, or bootstrap admin) may
   read and write `mentoren`, `groepen`, `meldingen`, `instellingen/app`, and read the
   `curriculum` subtree (incl. the `cursussen`/`badges` collectionGroup queries the app
   subscribes to). The deelbadge-"types" on `/deelevaluaties` are **derived** from the badges
   (grouped by `groep`), not stored separately.
4b. **Vestiging-afscherming** — `leerlingen`, `evaluaties/{sj}/leerlingen/{id}` en `deelbadges`
   zijn per campus afgeschermd. `beheerder`/`coordinator`/bootstrap (`zietAlleVestigingen()`)
   zien alles; een `mentor` enkel `resource.data.vestiging in mijnVestigingen()`
   (= `gebruikers/{email}.vestigingen`, met terugval op het oude `vestiging`-stringveld).
   Een **overkoepelende** deelbadge (`vestiging == ""`) is **coördinator/beheerder-only** — een
   `vestiging == ''`- of `list.concat()`-tak in de regel breekt Firestore's list-analyzer, die
   dan een onbeperkte mentor-query tóch doorlaat; enkel de kale `field in [...]`-vorm werkt.
   Omdat regels geen filters zijn, **moet de client de query beperken** tot
   `where("vestiging","in", …)` — een bredere query wordt geweigerd. `firebasePersistentie`
   doet dat op basis van `firebaseBereik` (gezet door `firebaseAuth`); `rechten.ts` blijft de
   UI-filter (o.a. voor "bekijk als" en local-modus). `evaluaties.vestiging` staat
   gedenormaliseerd op het doc (afgeleid van de leerling); een eenmalige backfill (door de
   eerste volle-toegang-login) vult het op oudere docs — op een afgesloten jaar mag enkel dat
   ene veld nog toegevoegd worden (`alleenVestigingToegevoegd()`).
5. **`isBeheerder()`** only may: write the `curriculum` subtree (`curriculum/{stroom}`, its
   `cursussen/{id}` and `badges/{id}` docs), write **`instellingen/overlays`**
   (doel-/rubriekwijzigingen), and manage `/gebruikers` (create/update/delete + list).
   `/gebruikers` writes are shape-restricted (`hasOnly` key allow-list incl. optional `dev`
   bool, `rol` ∈ the three roles, `actief is bool`, `vestigingen is list`; het oude
   `vestiging`-stringveld blijft toegelaten voor de overgang) and can never contain a password
   field. `dev: true` = extra toegang tot in-ontwikkeling-pagina's (Deelbadges, Rubrics); enkel
   de bootstrap-beheerder toont het vinkje in de UI.
   **`instellingen/overlays` rijdt bewust NIET mee in de gebatchte `bewaar()`** (die is
   personeel-breed) — de store schrijft het apart weg via `schrijfOverlays()` bij een
   overlay-wijziging, zodat de `isBeheerder()`-regel de mentor-save niet breekt. De generieke
   `instellingen/{sleutel}`-regel sluit `overlays` expliciet uit (`sleutel != 'overlays'`).
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

- **`mentoren` / `groepen` / `meldingen`** zijn nog personeel-breed (niet per vestiging):
  `mentoren` = demo-roster, `groepen` = id-lijsten (per definitie campus-overschrijdend),
  `meldingen` = de notificaties van de leerling zelf. Bevatten geen kern-badgeboek-PII;
  per-vestiging scoping hier vergt weer een gedenormaliseerd `vestiging`-veld.
- **Firebase App Check** staat niet aan — elke `@keerpuntscholen.be` (dus ook elke leerling)
  kan bij Firebase Auth inloggen; alleen het ontbreken van een `gebruikers`-doc houdt ze tegen.
- **`auditLog{}`** in het evaluatie-doc wordt client-side geschreven → in principe vervalsbaar.
  Een echt onvervalsbaar auditspoor vergt een Cloud Function.
- **Bootstrap-admin** (`arno.boriau@keerpuntscholen.be`) is een permanente hardcoded superuser
  — noodluik; uit te faseren zodra `/gebruikers` stabiel gevuld is.
- **Regio:** de Firestore-database staat in `europe-west1` (België) — EU-conform. Vastleggen
  bij het aanmaken van het echte Google-project.

## 3. Tests

`test/firestore.rules.test.ts` voert §4 hieronder uit tegen de Firestore-emulator, plus de
tegenhanger (wat wél moet lukken), gegroepeerd per thema.

```
npm run test:rules      # start de emulator errond (firebase emulators:exec)
```

Of, met een al draaiende emulator (`firebase emulators:start --only firestore`): `npm test`.

**Eenmalige setup — een JDK 21+.** `firebase-tools` v15 vereist Java 21 of hoger; macOS
levert standaard geen (of een veel te oude) Java. Installeer:

```
brew install --cask temurin@21
java -version        # moet "21" tonen
```

Zonder gaat `emulators:exec` meteen onderuit ("no longer supports Java version before 21" /
"Unable to locate a Java Runtime") — dan is er niets mis met de tests zelf. De suite draait op
een demo-project (`demo-keerpunt`), volledig offline, geen credentials.

**Na een deploy van de vestiging-afscherming:** log éérst als beheerder/coördinator in. Die
sessie backfilt het `vestiging`-veld op oudere `evaluaties`-docs. Zolang dat niet gebeurd is,
ziet een mentor géén evaluaties (faalt veilig, niet lek).

## 4. Payloads designed to fail (`PERMISSION_DENIED`)

1. Unauthenticated read/write on any collection.
2. `email_verified: false` token.
3. Verified non-Keerpunt account (`x@gmail.com`) reading `leerlingen` or `evaluaties`.
4. Verified `@keerpuntscholen.be` with no `/gebruikers` doc reading `evaluaties/.../{id}`.
5. `mentor` / `coordinator` writing `curriculum/1A` or any `curriculum/1A/cursussen/.../badges/...` doc.
6. `mentor` writing any `/gebruikers` doc (incl. `{rol:'beheerder'}` on their own doc).
6b. `mentor` / `coordinator` writing `instellingen/overlays` (beheerder-only; `instellingen/app` mag wel).
7. `beheerder` writing a `/gebruikers` doc with a `wachtwoord`/`password` key.
8. Account with `actief:false` reading `badgeboek` data.
9. Path traversal / oversized ids (Firestore rejects `/` in ids).
10. Any personeel writing `evaluaties/2024-2025/leerlingen/{id}` (create, update én delete) —
    afgesloten schooljaar. Uitzondering: enkel het `vestiging`-veld toevoegen (migratie).
11. Any personeel creating/updating/deleting a `deelbadges/{id}` doc whose `schooljaar` is
    `2024-2025`.
12. A `mentor` (vestiging Gent) reading `leerlingen/{molenbeek-id}`, `evaluaties/.../{molenbeek-id}`,
    or a `deelbadges/{id}` with `vestiging: 'Molenbeek'`.
13. A `mentor` running an **unconstrained** `list` on `leerlingen` / `evaluaties/{sj}/leerlingen`
    / `deelbadges`, or one with `where("vestiging","in",[…])` wider than `mijnVestigingen()`.
14. A `mentor` reading or creating a `deelbadges/{id}` with `vestiging: ''` (overkoepelend =
    coördinator/beheerder-only).
