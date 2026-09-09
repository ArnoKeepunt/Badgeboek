import type { CurriculumRuw } from "../curriculum";
import type { Minimumdoel } from "../minimumdoelen";
import type { Vestiging } from "../vestigingen";
import type {
  AuditLog,
  DeelKleuren,
  DeelNotities,
  Deelevaluatie,
  DoelKleuren,
  Groep,
  Melding,
  Mentor,
  Notities,
  Rubriek,
  Stroom,
  Student,
} from "../types";

/**
 * De persistentielaag ("seam") tussen de app en waar de data leeft.
 *
 * De rest van de app praat met `src/lib/store.ts` (een in-memory reactieve store); die store
 * praat op zijn beurt enkel met een `BadgeboekPersistentie`. Vandaag is dat `localStorage`;
 * later wordt het Firebase (Firestore) of eventueel Supabase — zonder dat er iets aan de
 * pagina's verandert. Zie `README.md` in deze map.
 *
 * ⚠️ Deze interface is bewust nog grotendeels synchroon: `laadDirect()` levert bij het opstarten
 * meteen data (localStorage kan dat). Een echte backend kan dat niet — die geeft `null` terug
 * en levert de data daarna via `abonneer()`. Het volledig asynchroon maken van de app
 * (laadstates overal) is **stap 2** van de roadmap, niet deze stap.
 */

/** Alles wat bewaard wordt — de State uit store.ts, zonder de per-tab `sessie`. */
export interface PersistedStore {
  students: Student[];
  mentoren: Mentor[];
  /** De vestigingen (campussen). `null` = de ingebouwde bundel; anders de database-versie. */
  vestigingen: Vestiging[] | null;
  kleuren: DoelKleuren;
  notities: Notities;
  groepen: Groep[];
  schooljaar: string;
  /** Schooljaren die de beheerder heeft vastgezet (alleen-lezen). `null` = de standaardlijst. */
  afgeslotenSchooljaren: string[] | null;
  matrixStromen: Stroom[];
  /** Cursusfilter (op naam) voor de matrix-pagina's; `""` = alle. */
  matrixCursus: string;
  doelWijzigingen: Record<string, Partial<Minimumdoel>>;
  doelenImport: Minimumdoel[] | null;
  rubriekWijzigingen: Record<string, Partial<Rubriek>>;
  /**
   * De database-versie van de badges (de ruwe `{ cursussen, badges }`), of `null` = de
   * ingebouwde bundel. De deelbadge-kapstok wordt hieruit afgeleid. Alleen-lezen vanuit de
   * app: `abonneer()` vult dit vanuit de `curriculum/{stroom}/cursussen/{c}/badges/{b}`
   * subcollecties, alleen `schrijfCurriculum()` (beheerder) schrijft ernaar.
   */
  curriculumOverride: CurriculumRuw | null;
  deelevaluaties: Deelevaluatie[];
  deelKleuren: DeelKleuren;
  deelNotities: DeelNotities;
  /** Append-only wijzigingsgeschiedenis per evaluatiecel (kleur of notitie): wie, wanneer, van→naar. */
  auditLog: AuditLog;
  meldingen: Melding[];
  meldingGezien: Record<string, number>;
  gewist: string[];
}

/**
 * Wat er uit de opslag terugkomt: mogelijk onvolledig of van een oudere versie. De store legt
 * hier de seed-data onder en voert migraties uit (bv. `matrixStroom` → `matrixStromen`).
 */
export type RauweStore = Partial<PersistedStore> & { matrixStroom?: Stroom };

export interface BadgeboekPersistentie {
  /** Korte naam voor logging/debug ("localStorage", "firebase"…). */
  readonly naam: string;

  /**
   * Synchroon inlezen bij het opstarten, of `null` als er (nog) niets is. Een backend zonder
   * synchrone lees-API geeft hier `null` en levert de data later via `abonneer()`.
   */
  laadDirect(): RauweStore | null;

  /** De volledige store wegschrijven. Mag asynchroon zijn; de app wacht er niet op. */
  bewaar(store: PersistedStore): void | Promise<void>;

  /**
   * Optioneel: schrijf de database-versie van de badges weg (of wis ze met `null`). Alleen de
   * beheerder-actie `zetCurriculumOverride` roept dit aan. Ontbreekt deze methode (localStorage),
   * dan rijdt `curriculumOverride` gewoon mee in `bewaar()`.
   */
  schrijfCurriculum?(data: CurriculumRuw | null): void | Promise<void>;

  /**
   * Optioneel: reageer op data die elders gewijzigd is (andere browsertab, ander toestel, een
   * realtime backend). Geeft een opzegfunctie terug.
   */
  abonneer?(luister: (store: RauweStore) => void): () => void;
}
