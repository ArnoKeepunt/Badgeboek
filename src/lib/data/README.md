# `src/lib/data/` — de persistentielaag

De rest van de app weet **niet** waar de data leeft. Ze praat met `src/lib/store.ts` (een
in-memory reactieve store op basis van `useSyncExternalStore`), en die store praat met één
`BadgeboekPersistentie`.

```
pagina's / components
        │  useStore(), setDoelKleur(), maakGroep(), …
        ▼
   src/lib/store.ts          ← in-memory state + domeinregels (merge, meldingen, gewist, guards)
        │  laadDirect() / bewaar() / abonneer() / schrijfCurriculum() / schrijfOverlays()
        ▼
   BadgeboekPersistentie     ← deze map
        ├─ localStoragePersistentie   (VITE_PERSISTENTIE=local — demo/snel-itereren)
        └─ firebasePersistentie       (VITE_PERSISTENTIE=firebase — de echte backend, live)
```

Van backend wisselen = `.env`: `VITE_PERSISTENTIE=local|firebase`. De app zelf hoeft niet
aangepast te worden — geen enkele pagina praat rechtstreeks met Firestore of localStorage.

## De interface (`persistentie.ts`)

```ts
interface BadgeboekPersistentie {
  naam: string;
  laadDirect(): RauweStore | null;                        // synchroon, bij opstarten
  bewaar(store: PersistedStore): void | Promise<void>;     // de "gewone" personeel-brede save
  schrijfCurriculum?(data: CurriculumRuw | null): void | Promise<void>;   // beheerder-only, apart
  schrijfOverlays?(overlays: Overlays): void | Promise<void>;             // beheerder-only, apart
  abonneer?(luister: (store: RauweStore) => void): () => void;           // live updates
}
```

- `PersistedStore` = de volledige `State` uit `store.ts` **zonder** `sessie` (die leeft per
  browsertab in `sessieOpslag.ts`, los van dit alles — ook in firebase-modus).
- `schrijfCurriculum` en `schrijfOverlays` bestaan omdat die twee dingen **beheerder-only** zijn
  in de Firestore-regels, terwijl `bewaar()` personeel-breed schrijft — ze mogen dus niet in
  dezelfde gebatchte save meerijden (dat zou de save van een mentor doen falen). `localStorage`
  implementeert ze niet: daar rijden curriculum/overlays gewoon mee in `bewaar()`.

## `firebasePersistentie.ts` — hoe de live laag in elkaar zit

- **`firebaseApp.ts`** — Firebase-initialisatie (config uit `VITE_FIREBASE_*`, een *named*
  Firestore-database, niet `(default)`), Google-auth-helpers, `schrijfDocMap()` (gedeelde
  gebatchte writer, ≤450 docs, zet `updatedAt`/`updatedBy`).
- **`firestoreLayout.ts`** — het vertaalpaar `storeNaarDocs()` ↔ `docsNaarStore()` ↔ `diffDocs()`
  tussen de platte `PersistedStore` en de Firestore-documentstructuur (zie de root-README voor
  het datamodel). Moeten elkaars inverse zijn.
- **`firebaseBereik.ts`** — het vestiging-bereik van de aangemelde gebruiker (`{bekend, alles,
  vestigingen[]}`), gezet door `src/lib/firebaseAuth.ts`. Bepaalt of `firebasePersistentie` een
  onbeperkte of een `where("vestiging","in",…)`-beperkte query gebruikt voor `leerlingen` /
  `evaluaties` / `deelbadges` — de Firestore-regels weigeren een bredere query dan het bereik
  toelaat (regels zijn geen filters).
- **`bewaar()`** is gedebounced (600 ms), diff't tegen de laatst gesynchroniseerde documenten en
  schrijft enkel wat wijzigde. **`abonneer()`** luistert via `onSnapshot` per collectie plus
  `collectionGroup`-luisteraars voor het geneste curriculum/rubrieken.
- **`migratie.ts`** — eenmalige migratie van de allereerste (platte, AI-Studio-gegenereerde)
  documentstructuur; niet meer in de UI, `git log` kent de details.

Zie `security_spec.md` voor de Firestore-regels zelf (wie mag wat, per collectie).

## Nog een backend toevoegen (bv. Supabase)

Maak een nieuw bestand met exact dezelfde `BadgeboekPersistentie`-interface en wissel de keuze
in `index.ts` (`maakPersistentie()`). Verder verandert er niets aan de rest van de app.
