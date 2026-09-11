# Wat nog moet gebeuren vóór échte leerlinggegevens

**Status (2026-09-11):** de backend is intussen **live** — Firestore + verplichte Google-login,
per-vestiging afgeschermd in de regels, personeelsaccounts zijn **echt** (geïmporteerd vanuit
Smartschool/school-administratie). Enkel de **leerlingen** zijn nog fictief. Deze pagina beschreef
oorspronkelijk (03/09) een to-do-lijst voor toen alles nog een prototype was; wat hieronder als
✅ staat is intussen gewoon gebouwd en live, zie de root-`README.md` voor de architectuur.

**De enige echte blocker:** een **GDPR-check** vooraleer met échte leerlinggegevens gewerkt mag
worden (DPIA-light / verwerkingsregister — nog te schrijven). Dat geldt ongeacht hóe de
leerlingen straks in de app terechtkomen.

---

## ✅ Al gedaan

- **Persistentielaag** (`src/lib/data/`) — `firebasePersistentie` is de echte, live backend, geen
  skelet meer. Zie `src/lib/data/README.md`.
- **Auth-seam** — Google-login via `Toegangspoort.tsx`, enkel `@keerpuntscholen.be` met een
  actief `gebruikers`-doc.
- **Leerlingrechten** — niet enkel client-side (`src/lib/rechten.ts`,
  `useZichtbareLeerlingen()`), maar ook **in de Firestore-regels zelf**:
  `leerlingen`/`evaluaties`/`deelbadges` zijn per vestiging afgeschermd, een mentor-query buiten
  de eigen vestiging wordt geweigerd. Zie `security_spec.md`.
- **Personeelsaccounts** — echt, 9 vestigingen, rollen (beheerder/coördinator/mentor).

## Hoe de leerlingen er straks bij moeten komen: Smartschool-sync

Voor de mentoren ligt het plan al klaar (en is voor personeel deels al hergebruikt) in
`smartschool-sync-plan.md`: een sync haalt accounts op uit Smartschool en zet ze om naar
`gebruikers/{email}` + een roosterdocument. Dat plan sluit **leerlingen bewust uit** ("valt onder
de GDPR-blokker, bewust apart houden" — zie §9 van dat document).

Leerlingen zullen via **diezelfde soort synchronisatie** binnenkomen, zodra de GDPR-check rond is.
Twee routes zijn mogelijk, nog niet beslist:

1. **Rechtstreeks via de Smartschool-webservices-API** — dezelfde `getAllAccountsExtended`-call
   als voor personeel geeft ook leerlingen terug (accounttype = leerling i.p.v. eruit gefilterd).
   Data-mapping en sync-regels uit `smartschool-sync-plan.md` §4–5 gelden dan ook voor leerlingen.
2. **Via Google (Workspace) i.p.v. rechtstreeks Smartschool** — Smartschool provisioneert bij
   veel scholen de leerling-Google-accounts zelf al in Google Workspace (klas/afdeling als
   organisatie-eenheid of groep). Als dat hier ook zo loopt, kan een sync tegen de **Google
   Workspace Admin Directory API** volstaan i.p.v. een aparte Smartschool-accesscode — mogelijk
   eenvoudiger op te zetten (geen aparte API-sleutel/SOAP), maar dan moet de vestiging/klas nog
   wel afleidbaar zijn uit de Google-groepsstructuur.

**Te beslissen zodra de GDPR-check rond is:** welke van de twee, en of de bestaande
Smartschool-sync-Function (mentoren) uitgebreid wordt, of dat er een aparte leerling-sync komt.
Tot dan blijven de 150 fictieve testleerlingen (`src/lib/seedGebruikers.ts`) de manier om de app
te testen — zie ook de opmerking daarover in `README.md` en `security_spec.md`.

## Verderop (nog te doen, los van de leerling-sync)

- **GDPR-document** — DPIA-light / verwerkingsregister: welke persoonsgegevens, waar opgeslagen,
  bewaartermijn, recht op verwijdering (+ de flow ervoor in de app), dataminimalisatie,
  EU-regio (al bevestigd: `europe-west1`), geen runtime-AI. Dé blocker, dus prioriteit.
- **CSV-rondtrip** (`/gegevens`) — vandaag enkel export (leerlingen/doelen/evaluaties). Een
  volledige import/export-rondtrip (ook groepen, `rubriekWijzigingen`, `doelWijzigingen`) is het
  back-up- en migratieverhaal, en handig om testdata te beheren zolang alles fictief is.
- **Firebase App Check** staat nog niet aan (zie `security_spec.md` §2).
- **Bootstrap-superuser** (`arno.boriau@keerpuntscholen.be`) uitfaseren zodra `/gebruikers`
  stabiel gevuld is.
- **`auditLog{}`** wordt client-side geschreven, dus in principe vervalsbaar — een écht
  onvervalsbaar auditspoor vergt een Cloud Function.
- Rapportmodule, badgewiel, huisstijl.
- 3A-doelen + resterende rubric-criteria (Cultuur/Vrije Tekst zijn er, de rest niet).
- De twee badgeboek-evaluatiemodi echt uitwerken (deelstapjes→badge; kleur per rapport per
  1e/2e jaar).
