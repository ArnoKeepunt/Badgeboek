# Keerpunt Badgeboek

Webapp om het **dagelijks werk** van leerlingen te registreren met het Keerpunt-badgeboek:
per badge een **kleur** i.p.v. een cijfer. Vier kleuren, slechtst → best:

`rood` → `geel` → `groen` → `blauw`   (wit / leeg = *niet aangeboden of nog niet geëvalueerd*)

Geen cijfers, geen "geslaagd/gefaald" — enkel de kleur. Zie `src/lib/ratings.ts`.

## Status

Dit is een **prototype / testversie**, geen productie-app:

- **Geen echte login** — `/aanmelden` is een demo; standaard ben je "beheerder" met volledige toegang.
- **Alle data leeft in de browser** (`localStorage`). Niets wordt gedeeld tussen toestellen of
  gebruikers en er is geen back-up. Cache wissen = data weg. De opslag zit wel achter een
  seam (`src/lib/data/`) zodat dit later Firebase/Supabase kan worden zonder de pagina's te
  raken — zie `src/lib/data/README.md` en `docs/roadmap-voor-echte-data.md`.
- De leerlingen/mentoren zijn **fictief** (`docs/reference/fictieve_gebruikers_150ll_20mentoren.csv`).
- **Geen ingebouwde AI**, geen server, geen externe calls.

Voor een echte uitrol is nog nodig: echte authenticatie + autorisatie, een database/back-end,
dagelijkse back-up, hosting in de Google-omgeving en een verwerkersovereenkomst (GDPR).

## Stack

- React 19 + TypeScript
- Vite 8
- React Router 7 (`createHashRouter` — zie hieronder)

## Scripts

```bash
npm install
npm run dev      # dev-server (http://localhost:3000)
npm run build    # typecheck + productiebuild → dist/
npm run preview  # dist/ lokaal bekijken
npm run lint     # oxlint
```

## Online zetten

`npm run build` maakt een statische map `dist/`. Die kan je op **elk** adres of elke submap
zetten (gewone webhosting, S3, Netlify, …) — er is geen server-side nodig.

De routing gebruikt **hash-URLs** (`.../#/badges`), zodat deep links en verversen werken zonder
dat de host onbekende paden naar `index.html` moet herschrijven. Wil je nette URLs
(`.../badges`)? Zet `createHashRouter` in `src/router.tsx` terug naar `createBrowserRouter` en
regel een SPA-fallback op de host.

De asset-paden zijn relatief (`base: "./"` in `vite.config.ts`), dus `dist/` werkt zowel op een
domein-root als in een submap.

## Structuur (grote lijnen)

```
src/
  main.tsx              # entry
  router.tsx            # routes (hash router)
  components/           # Layout/Shell, RatingCell, ColorBar, BulkKnop, filterbalk, …
  pages/
    Dashboard.tsx       # Overzicht (mentor): periode + voortgang per groep
    Badges.tsx          # badgematrix: leerlingen × badges, kleur per rapport/periode
    Doelen.tsx          # minimumdoelen-lijst per stroom (los van de badges)
    Groepen.tsx         # eigen + systeemgroepen
    Students.tsx        # leerlingenlijst
    StudentDetail.tsx   # één leerling: badges × periodes
    Aanmelden.tsx       # demo-login
    LeerlingHome/Cursus # aparte, kindvriendelijke leerlingweergave
    Gegevens.tsx        # CSV import/export
  lib/
    store.ts            # useSyncExternalStore — in-memory reactieve store + domeinregels
    data/               # persistentielaag (seam): localStorage nu, Firebase/Supabase later
    curriculum*.ts      # badgeboek 1A/1B/2A/3A (auto-gegenereerd uit de Word-docs)
    minimumdoelen*.ts   # eindtermen per stroom (auto-gegenereerd uit de xlsx)
    seedGebruikers.ts   # fictieve leerlingen/mentoren
scripts/
  extract_badgeboeken.py # regenereert curriculum*.ts uit docs/reference/*.docx
```
