# Plan — mentoren synchroniseren vanuit Smartschool

**Doel:** het mentoren-bestand automatisch uit Smartschool halen, en elke gesynchroniseerde
mentor toegang geven tot de app (rol `mentor`). Leerlingen krijgen **geen** toegang via deze weg.

Status: **planning** — nog niks gebouwd. Wacht op de Smartschool API-sleutel + documentatie.

---

## 1. Hoe toegang werkt vandaag

```
toegang = geverifieerd @keerpuntscholen.be-account
          EN ( bootstrap-admin  OF  actief document in collectie `gebruikers/{email}` )
```

De sync hoeft de toegangspoort dus **niet** te wijzigen: als hij voor elke mentor een
`gebruikers/{email}`-doc aanmaakt (`rol: "mentor"`, `actief: true`), is die persoon binnen.
Leerlingen staan niet in de Smartschool-personeelslijst → krijgen geen `gebruikers`-doc → geen
toegang. De aparte **mentoren-roosterlijst** (`mentoren/{id}`) blijft bestaan voor de
groep-koppeling en de `mentorId`-verwijzingen.

## 2. Smartschool webservices-API

- Smartschool heeft een **SOAP-webservices-API**. De school-beheerder zet die aan
  (Smartschool → Instellingen → Webservices) en genereert een **accesscode (API-sleutel)** +
  krijgt de bijhorende methodedocumentatie.
- Vermoedelijk relevante methodes (exacte namen/velden verifiëren met de docs die bij de sleutel
  komen):
  - `getAllAccountsExtended` — alle accounts (personeel **en** leerlingen) met o.a. interne id,
    gebruikersnaam, voornaam, naam, e-mail, accounttype/rol, status (actief), groepen.
  - `getUserDetailsByNumber` / `getUserDetails` — details per gebruiker.
  - `getClassList` / `getSchoolyearGroupList` — klassen/groepen (voor het afleiden van de
    vestiging).
- Elke call stuurt de accesscode mee. Antwoord = XML.
- **De accesscode is geheim en de API is niet CORS-vriendelijk → nooit vanuit de browser.**
  Alles server-side.

## 3. Architectuur

```
Cloud Scheduler  (bv. elke nacht 03:00)
      │
      ▼
Cloud Function / Cloud Run  "smartschoolSync"
  1. SMARTSCHOOL_API_KEY uit Secret Manager
  2. Smartschool getAllAccountsExtended  → alle accounts
  3. filter op personeel (accounttype ≠ leerling; dubbelcheck: niet in `leerlingen/`)
  4. map → mentoren/{id}  +  gebruikers/{email}
  5. Firestore-upsert via de Admin SDK (omzeilt de security rules)
  6. wie niet meer in Smartschool zit → gebruikers/{email}.actief = false
  7. sync-rapport naar `sync/smartschool` (tijdstip, aantallen, fouten)
```

- Het Firebase-project heeft al Firestore. Cloud Functions vereist het **Blaze-plan**
  (pay-as-you-go; één nachtelijke run kost quasi niks).
- **Alternatief zonder billing-wijziging:** een lokaal Node-script (`firebase-admin`) dat Arno
  handmatig of via een eigen cron draait. Sneller op te zetten; niet "vanzelf". Aanrader als
  eerste stap.

## 4. Data-mapping

| Smartschool-veld | `mentoren/{id}` | `gebruikers/{email}` |
|---|---|---|
| e-mail (verplicht — zonder e-mail geen account) | `email` | **doc-id** |
| interne id / gebruikersnaam | `id` (stabiele sleutel) | — |
| voornaam | `voornaam` | — |
| naam | `naam` | `naam` = "voornaam naam" |
| accounttype / functie / groep | — | `rol` (default `"mentor"`; mapping-tabel voor `coordinator`/`beheerder`) |
| hoofdvestiging / campusgroep | `vestiging` (naam, gematcht tegen de `vestigingen`-lijst) | `vestiging` |
| status actief | — | `actief` |

**Open vraag:** hoe staat de **vestiging** van een leerkracht in Smartschool? Meestal via een
groep/afdeling. Af te spreken (bv. leerkrachten zitten in een groep "Personeel — Gent").

## 5. Sync-regels

- **Alleen personeel.** Filter op accounttype ≠ leerling; extra vangnet: e-mail niet in
  `leerlingen/`.
- **Upsert** op e-mail (`gebruikers`) en op interne id (`mentoren`).
- **Verdwenen uit Smartschool** → `gebruikers/{email}.actief = false` (niet verwijderen —
  geschiedenis en `mentorId`-verwijzingen blijven kloppen).
- **Nooit** de bootstrap-admin (`arno.boriau@keerpuntscholen.be`) op inactief zetten.
- **Rollen respecteren.** Een handmatig op `/gebruikers` verhoogde rol (`beheerder`/
  `coordinator`) mag de sync niet terugzetten naar `mentor`. Oplossing: de sync zet `rol` alleen
  bij het **aanmaken** van een nieuw account, óf er komt een `rolVergrendeld: true`-vlag die de
  beheerder zet.
- **Idempotent** + een **dry-run**-modus (log wat er zou veranderen, schrijf niks).

## 6. Wijzigingen in de app-code

Minimaal:

- Toegangspoort + `firestore.rules`: **niks** — die kijken al naar `gebruikers/`. De Function
  gebruikt de Admin SDK en omzeilt de rules.
- `/gebruikers`: een read-only markering "beheerd via Smartschool" op gesynct'e accounts, en de
  laatste-sync-status tonen (uit `sync/smartschool`).
- Eventueel `Personeelslid` uitbreiden met `bron: "handmatig" | "smartschool"` en
  `rolVergrendeld?: boolean`.

## 7. Wat Arno moet regelen

1. Smartschool-beheerder: **Webservices aanzetten**, een **accesscode** genereren, en de
   **API-methodedocumentatie** opvragen.
2. Afspreken hoe de **vestiging** van een leerkracht in Smartschool herkenbaar is.
3. Kiezen: **lokaal script** (nu, geen billing) of meteen **Cloud Function** (Blaze-plan aan).
4. De accesscode veilig aanleveren (Secret Manager / `.env` van het script — **niet** in git).

## 8. Voorgestelde volgorde

1. Arno vraagt accesscode + docs op.
2. Ik schrijf `scripts/smartschool-sync.mjs` (Node + `firebase-admin`): eerst **dry-run**, dan
   echt. Meteen bruikbaar, geen infra.
3. Werkt dat betrouwbaar → hetzelfde script naar een **Cloud Function + Cloud Scheduler** tillen.

## 9. Risico's / open punten

- Smartschool API-versie en exacte methodenamen/velden verschillen per school-setup — pas te
  finaliseren met de echte documentatie.
- **GDPR:** personeelsgegevens zijn óók persoonsgegevens → opnemen in het verwerkingsregister;
  de sync draait in een EU-regio. Zie `roadmap-voor-echte-data.md` §4.
- **Leerling-sync** loopt via dezelfde API (`getAllAccounts` bevat leerlingen) en is een logische
  vervolgstap, maar valt onder de GDPR-blokker voor leerlinggegevens — bewust apart houden.
