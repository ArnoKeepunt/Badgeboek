import type { BadgeboekPersistentie, PersistedStore, RauweStore } from "./persistentie";

/**
 * SKELET — nog niet in gebruik. Dit bestand toont waar de Firebase/Firestore-code komt zodra
 * er een Google-project is. Zolang dat er niet is, doet deze implementatie niets (met een
 * waarschuwing in de console). Zet `VITE_PERSISTENTIE=firebase` om ze te activeren.
 *
 * ── Stappen om dit in te vullen ────────────────────────────────────────────────
 *  1. `npm i firebase`
 *  2. `src/lib/data/firebaseApp.ts` met de projectconfig uit de Firebase-console
 *     (gebruik `import.meta.env.VITE_FIREBASE_*`, niet hardcoden).
 *  3. Firestore-model (voorstel — één document per "brok", zodat een schrijfbeurt klein blijft):
 *
 *        badgeboek/{schooljaar}
 *          kleuren:      map  ("studentId:nodeId" → "red" | …)  nodeId = leerdoel-/cursus-/rubric-id
 *          notities:     map
 *          deelKleuren:  map
 *          gewist:       array<string>
 *        badgeboek/_globaal
 *          students, mentoren, groepen, deelevaluaties, doelWijzigingen,
 *          doelenImport, rubriekWijzigingen, matrixStromen, schooljaar
 *        meldingen/{studentId}   →  { meldingen: array, gezienOp: number }
 *
 *     `PersistedStore` blijft de vorm die de store verwacht; deze klasse vertaalt heen en weer.
 *  4. `bewaar()` → `setDoc(..., { merge: true })` op de gewijzigde documenten (debounce ~500ms).
 *  5. `abonneer()` → `onSnapshot()` op de documenten; roep `luister(rauweStore)` bij elke wijziging.
 *  6. Beveiliging: Firestore-rules op basis van de ingelogde gebruiker + rol (zie de auth-seam,
 *     roadmap stap 3).
 *
 * ── Overstappen naar Supabase i.p.v. Firebase ──────────────────────────────────
 *  Maak een `supabasePersistentie.ts` met exact deze interface (`BadgeboekPersistentie`) en
 *  wissel de keuze in `index.ts`. Verder verandert er niets in de app.
 */

let gewaarschuwd = false;
function waarschuwEenmalig() {
  if (gewaarschuwd) return;
  gewaarschuwd = true;
  console.warn(
    "[persistentie] FirebasePersistentie is nog een skelet: er wordt niets bewaard of " +
      "gesynchroniseerd. Zie src/lib/data/README.md.",
  );
}

export function firebasePersistentie(): BadgeboekPersistentie {
  return {
    naam: "firebase (skelet)",

    laadDirect(): RauweStore | null {
      // Firestore heeft geen synchrone lees-API. De app start op de seed-data; de echte
      // data zou via abonneer() binnenkomen zodra dit ingevuld is.
      return null;
    },

    bewaar(_store: PersistedStore): void {
      waarschuwEenmalig();
      // TODO: setDoc(..., { merge: true }) — zie de mapping bovenaan.
    },

    abonneer(_luister: (store: RauweStore) => void): () => void {
      waarschuwEenmalig();
      // TODO: onSnapshot(...) → _luister(rauweStore); return unsubscribe.
      return () => {};
    },
  };
}
