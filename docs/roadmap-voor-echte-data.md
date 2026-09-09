# Wat kan er nu al, terwijl we wachten

**Context / blokkers (aug–sep 2026):**

- Er mag pas met **echte leerlinggegevens** gewerkt worden na een GDPR-check. Eerst willen we
  bewijzen dat alles klopt met fake data, inclusief de werking met een echte database.
- De **database** zelf hangt vast op rechten binnen de organisatie om een nieuw Google-project
  aan te maken.

Dus: alles hieronder kan zonder echte data en zonder de echte DB. Ongeveer op volgorde van
opbrengst.

---

## 1. Persistentielaag afschermen (grootste winst) — ✅ GEDAAN 2026-09-03

`src/lib/data/` bevat nu de seam:

- `persistentie.ts` — de `BadgeboekPersistentie`-interface + `PersistedStore`-type
- `localStoragePersistentie.ts` — de huidige opslag (+ gratis cross-tab sync via het
  `storage`-event)
- `firebasePersistentie.ts` — **skelet** met de Firestore-mapping uitgeschreven in comments
- `sessieOpslag.ts` — de per-tab sessie (blijft altijd `sessionStorage`)
- `index.ts` — `maakPersistentie()` kiest op basis van `VITE_PERSISTENTIE` (`.env.example`)
- `README.md` — hoe het in elkaar zit + hoe je naar Supabase wisselt

`store.ts` praat enkel nog met die interface; geen enkele pagina is aangeraakt. Van backend
wisselen = één `.env`-regel + één bestand invullen.

## 2. De store async maken

Een echte DB is asynchroon. Maak de repo-methodes nu al `async` (ook al retourneert de
localStorage-versie meteen), en voeg een **kunstmatige vertraging** toe (`await sleep(300)`).
Dan zie je nu al waar **laad- en foutstates** ontbreken (matrix, overzicht, rubrics…). Dat soort
ding doet pas pijn als de DB er is.

## 3. Auth-seam definiëren

`useEffectieveRol()` / `sessie` is al een goed aanknopingspunt. Leg de **Google-mapping** vast:
Google-account (id + e-mail) → leerling / mentor / beheerder. Schrijf de interface
(`AuthProvider`) met een `DemoAuthProvider` (huidige `/aanmelden`) en een lege
`GoogleAuthProvider`.

### 3b. Leerlingrechten (nieuw — vanwege de wetgeving)

Niet elke leerkracht mag alle leerlingen zien. **Eerste laag is gebouwd** (`src/lib/rechten.ts`):
een mentor ziet enkel de leerlingen van de **eigen vestiging**, een beheerder ziet iedereen,
een leerling enkel zichzelf. Alle pagina's die leerlingen tonen gebruiken de hook
`useZichtbareLeerlingen()`; `StudentDetail` blokkeert met "Geen toegang" bij een leerling buiten
het bereik. Nog te doen: **fijnmaziger** (per klasgroep / groep / individuele leerling) en
**database-gestuurd** — dat komt allemaal in `rechten.ts` (`leerlingenBinnenBereik` /
`magLeerlingZien`), de pagina's hoeven niet mee te veranderen.

## 4. GDPR-document schrijven

Dit is de blokker, dus naar voren halen. Een **DPIA-light / verwerkingsregister**: welke
persoonsgegevens, waar opgeslagen, bewaartermijn, recht op verwijdering (+ de flow ervoor in de
app), dataminimalisatie, EU-regio, geen runtime-AI. Als dit klaar is, is de stap naar echte
data veel minder eng — en er is iets om aan de organisatie voor te leggen.

## 5. CSV import/export rond maken (`/gegevens`)

Zorg dat **alles** round-trippt met fake data: leerlingen, doelen, evaluaties, deelevaluaties,
groepen, `rubriekWijzigingen`, `doelWijzigingen`. Dat is meteen het **back-up- en
migratieverhaal** én de manier om testdata te beheren.

## 6. Tests op de pure logica (Vitest)

Geen DB nodig, en het beschermt tijdens de refactor van punt 1–2. Goede kandidaten:

- `codeMatchtPrefix` / `zoekDoel` (`src/lib/rubriekDoelen.ts`)
- `filterLeerlingen`, `verzoenGraadLeerjaar` (`src/lib/leerlingen.ts`)
- `voortgangVoor` (`src/lib/voortgang.ts`)
- `telKleuren` / `aantalIngevuld` (`src/lib/kleurstats.ts`)
- `systeemGroepen` (`src/lib/groepen.ts`)
- `pasGewistAan` en de meldingen-helpers (`src/lib/store.ts`)

## 7. Prototype hard maken voor de mentortest

Systematische doorklik van **elke pagina × elke rol** (leerling / mentor / beheerder), met een
checklist. Plus de openstaande kleintjes:

- **Schooljaar afsluiten**-actie (de read-only lock bestaat al hard-coded als
  `AFGESLOTEN_SCHOOLJAREN`), + beheerder-gating
- Een **undo** voor evaluaties
- Lege / fout / laadstates overal

## 8. Online zetten

De `dist` is nu al deploybaar (hash-routing + `base: "./"` staan goed). Op een eigen adres
zetten zodat mentoren kunnen testen — hangt niet van de DB af.

---

## Aanbevolen startvolgorde

1. **1 + 2 samen** (repo-interface + async) — dat ís het antwoord op "werkt de architectuur met
   een DB": je simuleert de DB met een vertraagde localStorage-repo.
2. **4** (GDPR-doc) — want dat is de echte blokker.
3. Daarna 5–8 in willekeurige volgorde.

## Verderop (heeft de DB / echte data / meer wel nodig)

- Echte Google-auth + DB-implementatie achter de seams van punt 1 en 3
- Smartschool / OneRoster-koppeling — **plan uitgeschreven in `smartschool-sync-plan.md`**
  (mentoren synchroniseren + automatisch toegang; wacht op de Smartschool API-sleutel)
- Rapportmodule, badgewiel, huisstijl
- 3A-doelen + resterende rubric-criteria (Cultuur/Vrije Tekst zijn er, de rest niet)
- De twee badgeboek-evaluatiemodi echt uitwerken (deelstapjes→badge; kleur per rapport per
  1e/2e jaar)
- Identifier-rename `leerdoel` → `badge` (dev-facing opkuis)
- Badge-`omschrijving`-teksten herschrijven (nu nog uit het papieren badgeboek)
