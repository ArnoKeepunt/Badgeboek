import {
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import {
  auth,
  CURRICULUM_DOC,
  db,
  handleFirestoreError,
  OperationType,
  schrijfCurriculum as schrijfCurriculumDoc,
} from "./firebaseApp";
import type { CurriculumData } from "../curriculum";
import type {
  BadgeboekPersistentie,
  PersistedStore,
  RauweStore,
} from "./persistentie";

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

export function firebasePersistentie(): BadgeboekPersistentie {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let laatsteStore: PersistedStore | null = null;

  return {
    naam: "firebase (Firestore)",

    laadDirect(): RauweStore | null {
      return laadCache();
    },

    schrijfCurriculum(data: CurriculumData | null): Promise<void> {
      return schrijfCurriculumDoc(data);
    },

    bewaar(store: PersistedStore): void {
      laatsteStore = store;
      // Werk lokale offline cache altijd onmiddellijk bij
      bewaarCache(store);

      // Debounce Firestore writes (~600ms) om overbodige writes te vermijden
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!laatsteStore) return;
        const teBewaren = laatsteStore;

        if (!auth.currentUser) {
          // Niet ingelogd via Firebase Auth; wijziging blijft in lokale cache
          return;
        }

        const email = auth.currentUser.email ?? auth.currentUser.uid;
        const now = new Date().toISOString();

        const globaalDoc = {
          schooljaar: teBewaren.schooljaar,
          students: teBewaren.students,
          mentoren: teBewaren.mentoren,
          groepen: teBewaren.groepen,
          deelevaluaties: teBewaren.deelevaluaties,
          doelWijzigingen: teBewaren.doelWijzigingen,
          doelenImport: teBewaren.doelenImport,
          rubriekWijzigingen: teBewaren.rubriekWijzigingen,
          matrixStromen: teBewaren.matrixStromen,
          matrixCursus: teBewaren.matrixCursus,
          meldingen: teBewaren.meldingen,
          meldingGezien: teBewaren.meldingGezien,
          updatedAt: now,
          updatedBy: email,
        };

        const evaluatieDoc = {
          schooljaar: teBewaren.schooljaar,
          kleuren: teBewaren.kleuren,
          notities: teBewaren.notities,
          deelKleuren: teBewaren.deelKleuren,
          deelNotities: teBewaren.deelNotities,
          auditLog: teBewaren.auditLog,
          gewist: teBewaren.gewist,
          updatedAt: now,
          updatedBy: email,
        };

        try {
          await Promise.all([
            setDoc(doc(db, "badgeboek", "_globaal"), globaalDoc, { merge: true }),
            setDoc(doc(db, "badgeboek", teBewaren.schooljaar), evaluatieDoc, { merge: true }),
          ]);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, "badgeboek");
        }
      }, 600);
    },

    abonneer(luister: (store: RauweStore) => void): () => void {
      let unsubs: Unsubscribe[] = [];
      let globaalData: Partial<PersistedStore> | null = null;
      let evaluatieData: Partial<PersistedStore> | null = null;
      // `undefined` = nog niet geladen, `null` = geladen maar geen database-versie (= bundel).
      let curriculumData: CurriculumData | null | undefined = undefined;

      const triggerLuister = () => {
        if (!globaalData && !evaluatieData && curriculumData === undefined) return;
        const samengevoegd: RauweStore = {
          ...(globaalData ?? {}),
          ...(evaluatieData ?? {}),
        };
        if (curriculumData !== undefined) samengevoegd.curriculumOverride = curriculumData;
        bewaarCache(samengevoegd);
        luister(samengevoegd);
      };

      const startLuisteraars = (schooljaar: string) => {
        // Stop eerdere luisteraars indien schooljaar gewisseld is
        unsubs.forEach((u) => u());
        unsubs = [];

        // 1. Luister naar globaal
        const unsubGlobaal = onSnapshot(
          doc(db, "badgeboek", "_globaal"),
          (snap) => {
            if (snap.exists()) {
              globaalData = snap.data() as Partial<PersistedStore>;
              triggerLuister();
            } else if (laatsteStore && auth.currentUser) {
              // Als document nog niet bestaat, initialiseer eenmalig
              const now = new Date().toISOString();
              void setDoc(
                doc(db, "badgeboek", "_globaal"),
                {
                  schooljaar: laatsteStore.schooljaar,
                  students: laatsteStore.students,
                  mentoren: laatsteStore.mentoren,
                  groepen: laatsteStore.groepen,
                  deelevaluaties: laatsteStore.deelevaluaties,
                  doelWijzigingen: laatsteStore.doelWijzigingen,
                  doelenImport: laatsteStore.doelenImport,
                  rubriekWijzigingen: laatsteStore.rubriekWijzigingen,
                  matrixStromen: laatsteStore.matrixStromen,
                  matrixCursus: laatsteStore.matrixCursus,
                  meldingen: laatsteStore.meldingen,
                  meldingGezien: laatsteStore.meldingGezien,
                  updatedAt: now,
                  updatedBy: auth.currentUser?.email ?? "systeem",
                },
                { merge: true },
              );
            }
          },
          (err) => {
            // Als de gebruiker nog niet bevoegd is, loggen we zonder te crashen
            console.warn("Firestore _globaal snapshot melding:", err.message);
          },
        );
        unsubs.push(unsubGlobaal);

        // 2. Luister naar evaluaties van huidig schooljaar
        const unsubEval = onSnapshot(
          doc(db, "badgeboek", schooljaar),
          (snap) => {
            if (snap.exists()) {
              evaluatieData = snap.data() as Partial<PersistedStore>;
              triggerLuister();
            } else if (laatsteStore && auth.currentUser) {
              const now = new Date().toISOString();
              void setDoc(
                doc(db, "badgeboek", schooljaar),
                {
                  schooljaar: laatsteStore.schooljaar,
                  kleuren: laatsteStore.kleuren,
                  notities: laatsteStore.notities,
                  deelKleuren: laatsteStore.deelKleuren,
                  deelNotities: laatsteStore.deelNotities,
                  auditLog: laatsteStore.auditLog,
                  gewist: laatsteStore.gewist,
                  updatedAt: now,
                  updatedBy: auth.currentUser?.email ?? "systeem",
                },
                { merge: true },
              );
            }
          },
          (err) => {
            console.warn(`Firestore ${schooljaar} snapshot melding:`, err.message);
          },
        );
        unsubs.push(unsubEval);
      };

      // 3. Luister naar de database-versie van de badges (`curriculum/actief`) — niet
      //    schooljaar-gebonden, dus één luisteraar voor de sessie.
      let unsubCurriculum: Unsubscribe | null = null;
      const startCurriculum = () => {
        unsubCurriculum?.();
        unsubCurriculum = onSnapshot(
          doc(db, CURRICULUM_DOC[0], CURRICULUM_DOC[1]),
          (snap) => {
            curriculumData = snap.exists() ? (snap.data() as CurriculumData) : null;
            triggerLuister();
          },
          (err) => {
            console.warn("Firestore curriculum/actief snapshot melding:", err.message);
          },
        );
      };

      // Luister naar auth wijzigingen om Firestore-verbinding te starten
      const unsubAuth = auth.onAuthStateChanged((user) => {
        if (user) {
          const sj = laatsteStore?.schooljaar ?? "2025-2026";
          startLuisteraars(sj);
          startCurriculum();
        } else {
          unsubs.forEach((u) => u());
          unsubs = [];
          unsubCurriculum?.();
          unsubCurriculum = null;
        }
      });

      return () => {
        unsubAuth();
        unsubs.forEach((u) => u());
        unsubCurriculum?.();
      };
    },
  };
}
