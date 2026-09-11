import {
  type DocumentData,
  type Query,
  type Unsubscribe,
  collection,
  collectionGroup,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { HUIDIG_SCHOOLJAAR, eerdereSchooljaren } from "../schooljaar";
import { huidigBereik, opBereikWissel } from "./firebaseBereik";
import {
  auth,
  db,
  schrijfCurriculum as schrijfCurriculumDoc,
  schrijfOverlays as schrijfOverlaysDoc,
  schrijfDocMap,
} from "./firebaseApp";
import { duidOpslagFout, zetOpslagStatus } from "../opslagStatus";
import { type DocData, type DocMap, diffDocs, docsNaarStore, storeNaarDocs } from "./firestoreLayout";
import type { CurriculumRuw } from "../curriculum";
import type { BadgeboekPersistentie, Overlays, PersistedStore, RauweStore } from "./persistentie";

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

/**
 * De collecties die `bewaar()` (via `storeNaarDocs`) beheert. Alleen documenten met dit
 * voorvoegsel mogen door een gewone save geschreven of **verwijderd** worden. Het curriculum
 * (`curriculum/…`, via `schrijfCurriculum`), de accounts (`gebruikers/…`) en legacy-docs vallen
 * er buiten — anders wist de diff ze omdat `storeNaarDocs` ze niet teruggeeft.
 */
const BEHEERD =
  /^(leerlingen|mentoren|groepen|deelbadges|meldingen|instellingen|vestigingen|rubrieken)\//;

/**
 * Mag `bewaar()` dit pad schrijven/verwijderen? `evaluaties/` alleen voor het actieve
 * schooljaar — het vorige schooljaar wordt wel meegeladen (voor de kleur-overname binnen een
 * graad) maar mag door een gewone save nooit aangeraakt worden. `instellingen/overlays` is
 * beheerder-only in de regels → aparte schrijfweg (`schrijfOverlays`), niet via `bewaar()`.
 */
const magBewarenSchrijven = (pad: string, actiefSchooljaar: string): boolean => {
  if (pad === "instellingen/overlays") return false;
  return pad.startsWith("evaluaties/")
    ? pad.startsWith(`evaluaties/${actiefSchooljaar}/`)
    : BEHEERD.test(pad);
};

type GescoopteBron =
  | { modus: "wacht" } // bereik nog onbekend → nog niet abonneren, bron blijft undefined
  | { modus: "leeg" } // mentor zonder vestiging → lege bron
  | { modus: "ref"; ref: Query<DocumentData> | ReturnType<typeof collection> };

/**
 * De vestiging-afgeschermde collecties (`leerlingen`, `deelbadges`, `evaluaties/…`) opvragen
 * binnen het bereik van de aangemelde gebruiker. `alles` → geen filter. Anders
 * `where("vestiging","in",[…])` — Firestore weigert een bredere query dan de regels toelaten
 * (en enkel de kale `in`-vorm, geen `== ''`-tak → overkoepelende deelbadges zijn coördinator+).
 */
function gescoopte(pad: readonly string[]): GescoopteBron {
  const b = huidigBereik();
  if (!b.bekend) return { modus: "wacht" };
  const basis = collection(db, pad[0], ...pad.slice(1));
  if (b.alles) return { modus: "ref", ref: basis };
  if (b.vestigingen.length === 0) return { modus: "leeg" };
  return { modus: "ref", ref: query(basis, where("vestiging", "in", b.vestigingen)) };
}

/**
 * Eénmalige migratie: voeg `vestiging` toe aan evaluatie-docs die het nog niet hebben (van vóór
 * de vestiging-afscherming), afgeleid van de leerling. Zonder dit veld zou een mentor-query
 * (`where("vestiging","in",…)`) die docs niet meer terugkrijgen.
 */
async function backfillEvalVestiging(docs: DocMap): Promise<void> {
  const vestigingVan = new Map<string, string>();
  for (const [pad, d] of docs) {
    if (pad.startsWith("leerlingen/")) {
      vestigingVan.set(pad.slice(11), typeof d.vestiging === "string" ? d.vestiging : "");
    }
  }
  const bij: DocMap = new Map();
  for (const [pad, d] of docs) {
    if (/^evaluaties\/[^/]+\/leerlingen\/[^/]+$/.test(pad) && !("vestiging" in d)) {
      const v = vestigingVan.get(pad.split("/")[3]);
      if (v) bij.set(pad, { vestiging: v });
    }
  }
  if (bij.size === 0) return;
  try {
    await schrijfDocMap(bij);
    console.info(`Firestore: vestiging-veld toegevoegd aan ${bij.size} evaluatie-doc(s).`);
  } catch (error) {
    console.warn("Firestore: backfill vestiging mislukt:", error);
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

    async schrijfOverlays(overlays: Overlays): Promise<void> {
      if (!auth.currentUser) return;
      try {
        await schrijfOverlaysDoc(overlays);
        zetOpslagStatus({ soort: "ok" });
      } catch (error) {
        console.error("Firestore overlays-schrijffout:", error);
        zetOpslagStatus(duidOpslagFout(error));
      }
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
        const volledigNu = storeNaarDocs(laatsteStore, actiefSchooljaar);
        // Alleen het actieve schooljaar aanraken, en alleen de door `bewaar` beheerde collecties
        // — anders ziet de diff het curriculum (dat `storeNaarDocs` niet teruggeeft), het
        // meegeladen vorige schooljaar of `instellingen/overlays` (aparte schrijfweg) als
        // "verdwenen" en wist/overschrijft het.
        const beheerd = (m: DocMap) =>
          new Map([...m].filter(([pad]) => magBewarenSchrijven(pad, actiefSchooljaar)));
        const nu = beheerd(volledigNu);
        const vorigeBeheerd = vorigeDocs ? beheerd(vorigeDocs) : null;
        const { schrijf, verwijder } = vorigeBeheerd
          ? diffDocs(vorigeBeheerd, nu)
          : { schrijf: nu, verwijder: [] };
        if (schrijf.size === 0 && verwijder.length === 0) return;
        try {
          await schrijfDocMap(schrijf, verwijder);
          vorigeDocs = volledigNu;
          zetOpslagStatus({ soort: "ok" });
        } catch (error) {
          // Niet (her)gooien: `bewaar` draait los van de UI. De status-balk in `Layout` toont
          // de fout; de wijziging blijft lokaal staan en `bewaar` probeert het bij de volgende
          // wijziging opnieuw.
          console.error("Firestore batch-schrijffout:", error);
          zetOpslagStatus(duidOpslagFout(error));
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
        vestigingen: undefined,
        rubriekCursussen: undefined,
        rubriekLijst: undefined,
        evaluaties: undefined,
        // De twee vorige schooljaren (een graad = 2, soms 3 schooljaren) — voor de
        // kleur-overname. Leeg als er geen is.
        evaluatiesVorig1: undefined,
        evaluatiesVorig2: undefined,
      };

      // Bij het opstarten vuren ~12 luisteraars vlak na elkaar, en een write geeft 1-2 echo-
      // snapshots. Debounce zodat zo'n burst tot één herbouw van de store leidt.
      let emitTimer: ReturnType<typeof setTimeout> | null = null;
      // Eenmalig: het gedenormaliseerde `vestiging`-veld op oudere evaluatie-docs bijwerken
      // (nodig sinds de vestiging-afscherming). Alleen een volle-toegang-account doet dit.
      let vestigingGebackfild = false;

      const emitNu = () => {
        if (Object.values(bron).some((f) => f === undefined)) return;
        const docs: DocMap = new Map();
        for (const frag of Object.values(bron)) {
          if (frag) for (const [pad, data] of frag) docs.set(pad, data);
        }
        if (!vestigingGebackfild && huidigBereik().alles && auth.currentUser) {
          vestigingGebackfild = true;
          void backfillEvalVestiging(docs);
        }
        // Een `onSnapshot` vuurt ook voor onze eigen writes (optimistisch + na server-ack). Is de
        // stand identiek aan wat de store al heeft, sla het door — anders herbouwt de hele app
        // zich voor niks bij elke kleurklik.
        if (vorigeDocs) {
          const { schrijf, verwijder } = diffDocs(vorigeDocs, docs);
          if (schrijf.size === 0 && verwijder.length === 0) {
            vorigeDocs = docs;
            vorigeDocsSchooljaar = actiefSchooljaar;
            return;
          }
        }
        vorigeDocs = docs;
        vorigeDocsSchooljaar = actiefSchooljaar;
        const rauw = docsNaarStore(docs);
        bewaarCache(rauw);
        luister(rauw);
      };

      const emit = () => {
        if (emitTimer) clearTimeout(emitTimer);
        emitTimer = setTimeout(emitNu, 60);
      };

      const collectieLuisteraar = (
        naam: string,
        bron_: GescoopteBron,
        padVoor: (id: string) => string,
      ): Unsubscribe => {
        // "wacht" = bereik nog onbekend → bron undefined laten (emitNu wacht, geen wipe).
        if (bron_.modus === "wacht") return () => {};
        if (bron_.modus === "leeg") {
          bron[naam] = new Map();
          emit();
          return () => {};
        }
        return onSnapshot(
          bron_.ref,
          (snap) => {
            const frag: DocMap = new Map();
            snap.forEach((d) => frag.set(padVoor(d.id), zonderMeta(d.data())));
            bron[naam] = frag;
            emit();
          },
          (err) => console.warn(`Firestore ${naam}:`, err.message),
        );
      };

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

      // Rubrieken staan in dezelfde vorm als het curriculum: rubrieken/{stroom}/cursussen/{c}/
      // lijst/{r}. "cursussen" is een collectionGroup-naam die het curriculum ook gebruikt —
      // vandaar de eigen `rubrieken/`-padfilter (zelfde patroon als hierboven).
      const rubriekenGroepLuisteraar = (naam: "cursussen" | "lijst"): Unsubscribe =>
        onSnapshot(
          collectionGroup(db, naam),
          (snap) => {
            const frag: DocMap = new Map();
            snap.forEach((d) => {
              const pad = d.ref.path.replace(/^.*?\/documents\//, "");
              if (pad.startsWith("rubrieken/")) frag.set(pad, zonderMeta(d.data()));
            });
            bron[naam === "cursussen" ? "rubriekCursussen" : "rubriekLijst"] = frag;
            emit();
          },
          (err) => console.warn(`Firestore rubrieken/${naam}:`, err.message),
        );

      let unsubs: Unsubscribe[] = [];
      let unsubEvals: Unsubscribe[] = [];

      const luisterEvaluatieJaar = (jaar: string, sleutel: string) => {
        const bron_ = gescoopte(["evaluaties", jaar, "leerlingen"]);
        if (bron_.modus === "wacht") return;
        if (bron_.modus === "leeg") {
          bron[sleutel] = new Map();
          emit();
          return;
        }
        bron[sleutel] = undefined;
        unsubEvals.push(
          onSnapshot(
            bron_.ref,
            (snap) => {
              const frag: DocMap = new Map();
              snap.forEach((d) =>
                frag.set(`evaluaties/${jaar}/leerlingen/${d.id}`, zonderMeta(d.data())),
              );
              bron[sleutel] = frag;
              emit();
            },
            (err) => console.warn(`Firestore evaluaties/${jaar}:`, err.message),
          ),
        );
      };

      // Het actieve schooljaar + tot 2 jaar terug (een graad loopt over 2, soms 3 schooljaren)
      // — nodig voor de kleur-overname binnen een graad.
      const startEvaluaties = (sj: string) => {
        unsubEvals.forEach((u) => u());
        unsubEvals = [];
        // Bereik nog onbekend → wacht (bronnen blijven undefined, emitNu doet niets).
        if (!huidigBereik().bekend) return;
        luisterEvaluatieJaar(sj, "evaluaties");
        const vorige = eerdereSchooljaren(sj).slice(0, 2);
        bron.evaluatiesVorig1 = new Map();
        bron.evaluatiesVorig2 = new Map();
        if (vorige[0]) luisterEvaluatieJaar(vorige[0], "evaluatiesVorig1");
        if (vorige[1]) luisterEvaluatieJaar(vorige[1], "evaluatiesVorig2");
      };
      herabonneerEvaluaties = startEvaluaties;

      const stopAlles = () => {
        if (emitTimer) clearTimeout(emitTimer);
        unsubs.forEach((u) => u());
        unsubs = [];
        unsubEvals.forEach((u) => u());
        unsubEvals = [];
        for (const k of Object.keys(bron)) bron[k] = undefined;
      };

      const alle = (pad: string): GescoopteBron => ({ modus: "ref", ref: collection(db, pad) });
      const startAlles = () => {
        stopAlles();
        actiefSchooljaar = laatsteStore?.schooljaar ?? HUIDIG_SCHOOLJAAR;
        unsubs = [
          // Vestiging-afgeschermd (regels + query-filter):
          collectieLuisteraar("leerlingen", gescoopte(["leerlingen"]), (id) => `leerlingen/${id}`),
          collectieLuisteraar("deelbadges", gescoopte(["deelbadges"]), (id) => `deelbadges/${id}`),
          // Personeel-breed:
          collectieLuisteraar("mentoren", alle("mentoren"), (id) => `mentoren/${id}`),
          collectieLuisteraar("groepen", alle("groepen"), (id) => `groepen/${id}`),
          collectieLuisteraar("meldingen", alle("meldingen"), (id) => `meldingen/${id}`),
          collectieLuisteraar("instellingen", alle("instellingen"), (id) => `instellingen/${id}`),
          collectieLuisteraar("vestigingen", alle("vestigingen"), (id) => `vestigingen/${id}`),
          curriculumGroepLuisteraar("cursussen"),
          curriculumGroepLuisteraar("badges"),
          rubriekenGroepLuisteraar("cursussen"),
          rubriekenGroepLuisteraar("lijst"),
        ];
        startEvaluaties(actiefSchooljaar);
      };

      const unsubAuth = auth.onAuthStateChanged((user) => {
        if (user) startAlles();
        else stopAlles();
      });
      // Herabonneren zodra het vestiging-bereik bekend wordt of wijzigt (login, rolwissel).
      const unsubBereik = opBereikWissel(() => {
        if (auth.currentUser) startAlles();
      });

      return () => {
        unsubAuth();
        unsubBereik();
        stopAlles();
        herabonneerEvaluaties = null;
      };
    },
  };
}
