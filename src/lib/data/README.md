# `src/lib/data/` — de persistentielaag

De rest van de app weet **niet** waar de data leeft. Ze praat met `src/lib/store.ts` (een
in-memory reactieve store op basis van `useSyncExternalStore`), en die store praat met één
`BadgeboekPersistentie`.

```
pagina's / components
        │  useStore(), setDoelKleur(), maakGroep(), …
        ▼
   src/lib/store.ts          ← in-memory state + domeinregels (merge, meldingen, gewist, guards)
        │  laadDirect() / bewaar() / abonneer()
        ▼
   BadgeboekPersistentie     ← deze map
        ├─ localStoragePersistentie   (nu in gebruik)
        ├─ firebasePersistentie       (skelet — Firestore)
        └─ supabasePersistentie       (nog niet gemaakt)
```

## Van backend wisselen

1. Zet `VITE_PERSISTENTIE` in een `.env`-bestand (zie `.env.example`):
   - `local` (standaard) — `localStorage`
   - `firebase` — `firebasePersistentie` (nu nog een skelet)
2. Eén implementatie = één bestand dat `BadgeboekPersistentie` implementeert. Voeg de keuze toe
   in `index.ts` (`maakPersistentie()`).

De app hoeft **niet** aangepast te worden.

## De interface

```ts
interface BadgeboekPersistentie {
  naam: string;
  laadDirect(): RauweStore | null;                 // synchroon, bij opstarten
  bewaar(store: PersistedStore): void | Promise<void>;
  abonneer?(luister: (store: RauweStore) => void): () => void;  // externe wijzigingen
}
```

- `PersistedStore` = de volledige `State` uit `store.ts` **zonder** `sessie`.
- `sessie` (wie kijk ik nu als) leeft altijd per browsertab → `sessieOpslag.ts`, los van dit alles.
- `laadDirect()` is bewust synchroon. Een echte backend geeft daar `null` terug en levert de
  data via `abonneer()`. De app volledig async maken (laadstates) is **roadmap-stap 2**.

## Firebase invullen (`firebasePersistentie.ts`)

Zie de uitgebreide comment bovenaan dat bestand: `npm i firebase`, een `firebaseApp.ts` met de
config uit `import.meta.env.VITE_FIREBASE_*`, een Firestore-model met één document per "brok"
(zodat een schrijfbeurt klein blijft), `setDoc({ merge: true })` in `bewaar()` (met debounce),
`onSnapshot()` in `abonneer()`, en Firestore-rules op basis van de ingelogde gebruiker + rol.

## Naar Supabase i.p.v. Firebase

Maak `supabasePersistentie.ts` met exact dezelfde interface en wissel de keuze in `index.ts`.
Verder verandert er niets.
