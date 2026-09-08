import {
  type DocumentData,
  type Unsubscribe,
  collection,
  collectionGroup,
  onSnapshot,
} from "firebase/firestore";
import { HUIDIG_SCHOOLJAAR } from "../schooljaar";
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  schrijfCurriculum as schrijfCurriculumDoc,
  schrijfDocMap,
} from "./firebaseApp";
import { type DocData, type DocMap, diffDocs, docsNaarStore, storeNaarDocs } from "./firestoreLayout";
import type { CurriculumRuw } from "../curriculum";
import type { BadgeboekPersistentie, PersistedStore, RauweStore } from "./persistentie";

const CACHE_SLEUTEL = "keerpunt-badgeboek:firebase-cache";

function laadCache(): RauweStore | null {
  try {
    const raw = localStorage.getItem(CACHE_SLEUTEL);
    return raw ? (JSON.parse(raw) as RauweStore) : null;
  } catch {
    return null;
  }
}

function bewaarCache(data: RauweStore): void {
  try {
    localStorage.setItem(CACHE_SLEUTEL, JSON.stringify(data));
  } catch {
    // quota of browserbeperking
  }
}

/** `updatedAt`/`updatedBy` weghalen zodat de diff inhoud-tegen-inhoud vergelijkt. */
function zonderMeta(d: DocumentData): DocData {
  const kopie = { ...d };
  delete kopie.updatedAt;
  delete kopie.updatedBy;
  return kopie;
}

export function firebasePersistentie(): BadgeboekPersistentie {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let laatsteStore: PersistedStore | null = null;
  /** De documentstand zoals die in Firestore staat (zonder meta). `bewaar` diff't hiertegen. */
  let vorigeDocs: DocMap | null = null;
  /** Het schooljaar waarvoor `vorigeDocs` de evaluatie-docs bevat. */
  let vorigeDocsSchooljaar: string = HUIDIG_SCHOOLJAAR;
  /** Het schooljaar waarvoor de `evaluaties`-luisteraar draait. */
  let actiefSchooljaar: string = HUIDIG_SCHOOLJAAR;
  /** Gezet door `abonneer`: herabonneer de evaluaties-luisteraar op een ander schooljaar. */
  let herabonneerEvaluaties: ((sj: string) => void) | null = null;

  return {
    naam: "firebase (Firestore)",

    laadDirect(): RauweStore | null {
      return laadCache();
    },

    schrijfCurriculum(data: CurriculumRuw | null): Promise<void> {
      return schrijfCurriculumDoc(data);
    },

    bewaar(store: PersistedStore): void {
      laatsteStore = store;
      bewaarCache(store);
      if (store.schooljaar !== actiefSchooljaar) {
        actiefSchooljaar = store.schooljaar;
        herabonneerEvaluaties?.(store.schooljaar);
      }

      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!auth.currentUser || !laatsteStore) return;
        // Wacht met schrijven tot `abonneer` opnieuw gesynct is voor het huidige schooljaar —
        // anders zou de diff de evaluatie-docs van een ander jaar als "verdwenen" zien.
        if (vorigeDocs && vorigeDocsSchooljaar !== actiefSchooljaar) return;
        // Alleen het actieve schooljaar aanraken.
        const nu = storeNaarDocs(laatsteStore, actiefSchooljaar);
        const { schrijf, verwijder } = vorigeDocs
          ? diffDocs(vorigeDocs, nu)
          : { schrijf: nu, verwijder: [] };
        if (schrijf.size === 0 && verwijder.length === 0) return;
        try {
          await schrijfDocMap(schrijf, verwijder);
          vorigeDocs = nu;
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, "batch");
        }
      }, 600);
    },

    abonneer(luister: (store: RauweStore) => void): () => void {
      // Per bron het laatst ontvangen fragment. `undefined` = nog geen snapshot gehad.
      const bron: Record<string, DocMap | undefined> = {
        leerlingen: undefined,
        mentoren: undefined,
        groepen: undefined,
        deelbadges: undefined,
        meldingen: undefined,
        currCursussen: undefined,
        currBadges: undefined,
        instellingen: undefined,
        evaluaties: undefined,
      };

      const emit = () => {
        if (Object.values(bron).some((f) => f === undefined)) return;
        const docs: DocMap = new Map();
        for (const frag of Object.values(bron)) {
          if (frag) for (const [pad, data] of frag) docs.set(pad, data);
        }
        vorigeDocs = new Map(docs);
        vorigeDocsSchooljaar = actiefSchooljaar;
        const rauw = docsNaarStore(docs);
        bewaarCache(rauw);
        luister(rauw);
      };

      const collectieLuisteraar = (
        naam: string,
        pad: string,
        padVoor: (id: string) => string,
      ): Unsubscribe =>
        onSnapshot(
          collection(db, pad),
          (snap) => {
            const frag: DocMap = new Map();
            snap.forEach((d) => frag.set(padVoor(d.id), zonderMeta(d.data())));
            bron[naam] = frag;
            emit();
          },
          (err) => console.warn(`Firestore ${naam}:`, err.message),
        );

      // Curriculum staat in subcollecties (curriculum/{stroom}/cursussen/{c}/badges/{b}) —
      // via twee collectionGroup-luisteraars i.p.v. per stroom.
      const curriculumGroepLuisteraar = (naam: "cursussen" | "badges"): Unsubscribe =>
        onSnapshot(
          collectionGroup(db, naam),
          (snap) => {
            const frag: DocMap = new Map();
            snap.forEach((d) => {
              const pad = d.ref.path.replace(/^.*?\/documents\//, "");
              if (pad.startsWith("curriculum/")) frag.set(pad, zonderMeta(d.data()));
            });
            bron[naam === "cursussen" ? "currCursussen" : "currBadges"] = frag;
            emit();
          },
          (err) => console.warn(`Firestore curriculum/${naam}:`, err.message),
        );

      let unsubs: Unsubscribe[] = [];
      let unsubEval: Unsubscribe | null = null;

      const startEvaluaties = (sj: string) => {
        unsubEval?.();
        bron.evaluaties = undefined;
        unsubEval = onSnapshot(
          collection(db, "evaluaties", sj, "leerlingen"),
          (snap) => {
            const frag: DocMap = new Map();
            snap.forEach((d) =>
              frag.set(`evaluaties/${sj}/leerlingen/${d.id}`, zonderMeta(d.data())),
            );
            bron.evaluaties = frag;
            emit();
          },
          (err) => console.warn(`Firestore evaluaties/${sj}:`, err.message),
        );
      };
      herabonneerEvaluaties = startEvaluaties;

      const stopAlles = () => {
        unsubs.forEach((u) => u());
        unsubs = [];
        unsubEval?.();
        unsubEval = null;
        for (const k of Object.keys(bron)) bron[k] = undefined;
      };

      const startAlles = () => {
        stopAlles();
        actiefSchooljaar = laatsteStore?.schooljaar ?? HUIDIG_SCHOOLJAAR;
        unsubs = [
          collectieLuisteraar("leerlingen", "leerlingen", (id) => `leerlingen/${id}`),
          collectieLuisteraar("mentoren", "mentoren", (id) => `mentoren/${id}`),
          collectieLuisteraar("groepen", "groepen", (id) => `groepen/${id}`),
          collectieLuisteraar("deelbadges", "deelbadges", (id) => `deelbadges/${id}`),
          collectieLuisteraar("meldingen", "meldingen", (id) => `meldingen/${id}`),
          collectieLuisteraar("instellingen", "instellingen", (id) => `instellingen/${id}`),
          curriculumGroepLuisteraar("cursussen"),
          curriculumGroepLuisteraar("badges"),
        ];
        startEvaluaties(actiefSchooljaar);
      };

      const unsubAuth = auth.onAuthStateChanged((user) => {
        if (user) startAlles();
        else stopAlles();
      });

      return () => {
        unsubAuth();
        stopAlles();
        herabonneerEvaluaties = null;
      };
    },
  };
}
