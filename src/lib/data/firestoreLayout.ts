import type { BadgeRuw, CursusRuw, CurriculumRuw } from "../curriculum";
import type { Vestiging } from "../vestigingen";
import type {
  AuditRegel,
  Deelevaluatie,
  Groep,
  Kleurcriteria,
  Melding,
  Mentor,
  Notitie,
  Rating,
  Rubriek,
  Stroom,
  Student,
} from "../types";
import type { PersistedStore, RauweStore } from "./persistentie";

/**
 * Vertaalpaar tussen de platte `PersistedStore` (wat de app-store verwacht) en de
 * Firestore-documentstructuur (één collectie per concept). `store → docs → store` moet een
 * identiteit zijn.
 *
 * Collecties:
 *   leerlingen/{id}            mentoren/{id}            groepen/{id}
 *   deelbadges/{id}            (= Deelevaluatie + per-leerling scores/notities/audit)
 *   evaluaties/{schooljaar}/leerlingen/{leerlingId}   (= badge-kleuren/notities/gewist/audit)
 *   meldingen/{leerlingId}     instellingen/app        instellingen/overlays
 *   curriculum/{stroom}/cursussen/{cursusId}/badges/{badgeId}
 *                             (apart geschreven via schrijfCurriculum; hier NIET in storeNaarDocs)
 *   rubrieken/{stroom}/cursussen/{cursusId}/lijst/{rubriekId}
 *                             (zelfde vorm als curriculum: cursus-id's komen overeen)
 */

export type DocData = Record<string, unknown>;
export type DocMap = Map<string, DocData>;

const EVAL_PAD = (sj: string, sid: string) => `evaluaties/${sj}/leerlingen/${sid}`;

/** Splits een audit-/gewist-sleutel. `a:b` = deelbadge (deId:sid); `a:b:c` = badge (sj:sid:badgeId). */
const isDeelSleutel = (k: string) => k.split(":").length === 2;

interface EvalDoc {
  kleuren: Record<string, Rating>;
  notities: Record<string, Notitie>;
  gewist: string[];
  auditLog: Record<string, AuditRegel[]>;
  /** Gedenormaliseerd van de leerling — nodig om de regels per vestiging te laten afschermen. */
  vestiging: string;
}

interface DeelbadgeDoc extends Deelevaluatie {
  scores: Record<string, Rating>;
  scoreNotities: Record<string, Notitie>;
  scoreAudit: Record<string, AuditRegel[]>;
}

interface MeldingDoc {
  meldingen: Melding[];
  gezienOp: number | null;
}

// --- store → docs --------------------------------------------------------------

/**
 * Zet de store om in een `pad → documentinhoud`-map. Zonder `updatedAt`/`updatedBy` (die komen
 * er bij het schrijven bij) en zonder de curriculum-docs (die gaan via `schrijfCurriculum`).
 *
 * `alleenSchooljaar`: enkel `evaluaties/{dat jaar}/leerlingen/*` meenemen. De store houdt kleuren
 * van meerdere schooljaren tegelijk (seed + wat je bekeek); bij een gewone save mag `bewaar`
 * enkel het actieve jaar aanraken, anders overschrijf je andere jaren met stale data.
 */
export function storeNaarDocs(s: PersistedStore, alleenSchooljaar?: string): DocMap {
  const m: DocMap = new Map();

  for (const l of s.students) m.set(`leerlingen/${l.id}`, { ...l });
  for (const mn of s.mentoren) m.set(`mentoren/${mn.id}`, { ...mn });
  for (const g of s.groepen) m.set(`groepen/${g.id}`, { ...g });
  // Vestigingen: alleen wegschrijven als er een database-versie is (`null` = de bundel).
  if (s.vestigingen) {
    for (const v of s.vestigingen) {
      m.set(`vestigingen/${v.id}`, { naam: v.naam, actief: v.actief, volgorde: v.volgorde });
    }
  }
  // Rubrics: alleen wegschrijven als er een database-versie is (`null` = de bundel). Zelfde
  // structuur als het curriculum: cursus-id's komen overeen (bv. "1A-cultuur"), de rubric-id
  // is `${cursusId}-r${n}` — stabiel, niet op de rij-positie in het bronbestand gebouwd.
  if (s.rubriekenOverride) {
    const cursussen = new Map<string, { stroom: string; naam: string }>();
    for (const r of s.rubriekenOverride) {
      const cursusId = r.id.replace(/-r\d+$/, "");
      if (!cursussen.has(cursusId)) cursussen.set(cursusId, { stroom: r.stroom, naam: r.cursus });
      m.set(`rubrieken/${r.stroom}/cursussen/${cursusId}/lijst/${r.id}`, {
        naam: r.naam,
        doelen: r.doelen,
        criteria: r.criteria,
        leerlijn: r.leerlijn,
        volgorde: r.volgorde,
      });
    }
    const volgordePerStroom = new Map<string, number>();
    for (const [cursusId, c] of cursussen) {
      m.set(`rubrieken/${c.stroom}`, {}); // node-marker, browsebaar in de console
      const volgorde = volgordePerStroom.get(c.stroom) ?? 0;
      volgordePerStroom.set(c.stroom, volgorde + 1);
      m.set(`rubrieken/${c.stroom}/cursussen/${cursusId}`, { naam: c.naam, volgorde });
    }
  }

  // deelbadges: definitie + per-leerling scores
  for (const d of s.deelevaluaties) {
    const doc: DeelbadgeDoc = { ...d, scores: {}, scoreNotities: {}, scoreAudit: {} };
    for (const [k, v] of Object.entries(s.deelKleuren)) {
      const i = k.lastIndexOf(":");
      if (k.slice(0, i) === d.id) doc.scores[k.slice(i + 1)] = v;
    }
    for (const [k, v] of Object.entries(s.deelNotities)) {
      const i = k.lastIndexOf(":");
      if (k.slice(0, i) === d.id) doc.scoreNotities[k.slice(i + 1)] = v;
    }
    for (const [k, v] of Object.entries(s.auditLog)) {
      if (isDeelSleutel(k) && k.slice(0, k.lastIndexOf(":")) === d.id) doc.scoreAudit[k] = v;
    }
    m.set(`deelbadges/${d.id}`, doc as unknown as DocData);
  }

  // evaluaties per (schooljaar, leerling)
  const vestigingVanLeerling = new Map(s.students.map((l) => [l.id, l.vestiging ?? ""]));
  const evalDocs = new Map<string, EvalDoc>();
  const evalDoc = (sj: string, sid: string): EvalDoc => {
    const p = EVAL_PAD(sj, sid);
    let d = evalDocs.get(p);
    if (!d) {
      d = {
        kleuren: {},
        notities: {},
        gewist: [],
        auditLog: {},
        vestiging: vestigingVanLeerling.get(sid) ?? "",
      };
      evalDocs.set(p, d);
    }
    return d;
  };
  const neemJaar = (sj: string) => !alleenSchooljaar || sj === alleenSchooljaar;
  for (const [k, v] of Object.entries(s.kleuren)) {
    const [sj, sid, ...rest] = k.split(":");
    if (rest.length && neemJaar(sj)) evalDoc(sj, sid).kleuren[rest.join(":")] = v;
  }
  for (const [k, v] of Object.entries(s.notities)) {
    const [sj, sid, ...rest] = k.split(":");
    if (rest.length && neemJaar(sj)) evalDoc(sj, sid).notities[rest.join(":")] = v;
  }
  for (const k of s.gewist) {
    if (isDeelSleutel(k)) continue; // deelbadge: afwezigheid = gewist
    const [sj, sid, ...rest] = k.split(":");
    if (rest.length && neemJaar(sj)) evalDoc(sj, sid).gewist.push(rest.join(":"));
  }
  for (const [k, v] of Object.entries(s.auditLog)) {
    if (isDeelSleutel(k)) continue; // hoort bij een deelbadge-doc
    const [sj, sid] = k.split(":");
    if (sj && sid && neemJaar(sj)) evalDoc(sj, sid).auditLog[k] = v;
  }
  for (const [p, d] of evalDocs) m.set(p, d as unknown as DocData);

  // meldingen per leerling
  const meldDocs = new Map<string, MeldingDoc>();
  for (const mel of s.meldingen) {
    const p = `meldingen/${mel.studentId}`;
    let d = meldDocs.get(p);
    if (!d) {
      d = { meldingen: [], gezienOp: s.meldingGezien[mel.studentId] ?? null };
      meldDocs.set(p, d);
    }
    d.meldingen.push(mel);
  }
  for (const [sid, ts] of Object.entries(s.meldingGezien)) {
    const p = `meldingen/${sid}`;
    if (!meldDocs.has(p)) meldDocs.set(p, { meldingen: [], gezienOp: ts });
  }
  for (const [p, d] of meldDocs) m.set(p, d as unknown as DocData);

  m.set("instellingen/app", {
    schooljaar: s.schooljaar,
    matrixStromen: s.matrixStromen,
    matrixCursus: s.matrixCursus,
    afgeslotenSchooljaren: s.afgeslotenSchooljaren ?? null,
  });
  m.set("instellingen/overlays", overlaysNaarDoc(s));

  return m;
}

/** De doelen-/rubriek-overlays als los document. Beheerder-only, aparte schrijfweg in firebase-modus. */
export function overlaysNaarDoc(s: {
  doelWijzigingen: PersistedStore["doelWijzigingen"];
  doelenImport: PersistedStore["doelenImport"];
  rubriekWijzigingen: PersistedStore["rubriekWijzigingen"];
}): DocData {
  return {
    doelWijzigingen: s.doelWijzigingen,
    doelenImport: s.doelenImport,
    rubriekWijzigingen: s.rubriekWijzigingen,
  };
}

/**
 * De ruwe curriculum-set → de subcollectie-documenten (voor `schrijfCurriculum`):
 *   curriculum/{stroom}                                   (leeg marker-doc)
 *   curriculum/{stroom}/cursussen/{cursusId}              { naam, volgorde }
 *   curriculum/{stroom}/cursussen/{cursusId}/badges/{id}  { groep, omschrijving, volgorde, categorie }
 */
export function curriculumNaarDocs(ruw: CurriculumRuw): DocMap {
  const m: DocMap = new Map();
  const stroomVanCursus = new Map(ruw.cursussen.map((c) => [c.id, c.stroom]));
  for (const c of ruw.cursussen) {
    m.set(`curriculum/${c.stroom}`, {});
    m.set(`curriculum/${c.stroom}/cursussen/${c.id}`, {
      naam: c.naam,
      volgorde: c.volgorde,
    });
  }
  for (const b of ruw.badges) {
    const stroom = stroomVanCursus.get(b.cursusId);
    if (!stroom) continue;
    m.set(`curriculum/${stroom}/cursussen/${b.cursusId}/badges/${b.id}`, {
      groep: b.groep,
      omschrijving: b.omschrijving,
      volgorde: b.volgorde,
      categorie: b.categorie,
    });
  }
  return m;
}

// --- docs → store ------------------------------------------------------------

/**
 * Zet de (mogelijk gedeeltelijke) verzameling documenten terug in een `RauweStore`.
 *
 * Als de database nog niet geïnitialiseerd is (geen `instellingen/app`), geven we alleen de
 * curriculum-override terug en laten we de rest ongezet, zodat de store de gebundelde seed
 * behoudt (i.p.v. te vervangen door lege lijsten). De migratie / het eerste echte gebruik
 * vult de collecties.
 */
export function docsNaarStore(docs: DocMap): RauweStore {
  const geinitialiseerd = docs.has("instellingen/app");
  const r: RauweStore = {};
  const students: Student[] = [];
  const mentoren: Mentor[] = [];
  const groepen: Groep[] = [];
  const deelevaluaties: Deelevaluatie[] = [];
  const kleuren: Record<string, Rating> = {};
  const notities: Record<string, Notitie> = {};
  const deelKleuren: Record<string, Rating> = {};
  const deelNotities: Record<string, Notitie> = {};
  const auditLog: Record<string, AuditRegel[]> = {};
  const gewist: string[] = [];
  const meldingen: Melding[] = [];
  const meldingGezien: Record<string, number> = {};

  const currCursussen: CursusRuw[] = [];
  const currBadges: BadgeRuw[] = [];
  let heeftCurriculum = false;

  const vestigingen: Vestiging[] = [];
  let heeftVestigingen = false;

  // Rubrieken: zelfde tweetraps-aanpak als curriculum — cursusnaam en rubric-doc apart
  // verzameld (kunnen in andere volgorde binnenkomen), na de loop samengevoegd op cursus-id.
  const rubriekCursusNamen = new Map<string, string>(); // cursusId -> naam
  const rubriekRuw: Array<{
    id: string;
    stroom: Stroom;
    cursusId: string;
    naam: string;
    doelen: string[];
    criteria: Kleurcriteria;
    leerlijn: string;
    volgorde: number;
  }> = [];
  let heeftRubrieken = false;

  for (const [pad, data] of docs) {
    const seg = pad.split("/");
    switch (seg[0]) {
      case "leerlingen":
        students.push(data as unknown as Student);
        break;
      case "mentoren":
        mentoren.push(data as unknown as Mentor);
        break;
      case "groepen":
        groepen.push(data as unknown as Groep);
        break;
      case "vestigingen":
        heeftVestigingen = true;
        vestigingen.push({
          id: seg[1],
          naam: (data.naam as string) ?? seg[1],
          actief: data.actief !== false,
          volgorde: (data.volgorde as number) ?? 0,
        });
        break;
      case "rubrieken": {
        // rubrieken/{stroom} (marker, genegeerd) | .../cursussen/{c} | .../cursussen/{c}/lijst/{r}
        const stroom = seg[1] as Stroom;
        if (seg[2] === "cursussen" && seg[4] === "lijst") {
          heeftRubrieken = true;
          rubriekRuw.push({
            id: seg[5],
            stroom,
            cursusId: seg[3],
            naam: (data.naam as string) ?? "",
            doelen: (data.doelen as string[]) ?? [],
            criteria: (data.criteria as Kleurcriteria) ?? { blauw: "", groen: "", geel: "", rood: "" },
            leerlijn: (data.leerlijn as string) ?? "",
            volgorde: (data.volgorde as number) ?? 0,
          });
        } else if (seg[2] === "cursussen") {
          heeftRubrieken = true;
          rubriekCursusNamen.set(seg[3], (data.naam as string) ?? seg[3]);
        }
        break;
      }
      case "curriculum": {
        // curriculum/{stroom}  |  .../cursussen/{c}  |  .../cursussen/{c}/badges/{b}
        const stroom = seg[1] as Stroom;
        if (seg[2] === "cursussen" && seg[4] === "badges") {
          heeftCurriculum = true;
          currBadges.push({
            id: seg[5],
            cursusId: seg[3],
            groep: (data.groep as string) ?? (data.omschrijving as string) ?? "",
            omschrijving: (data.omschrijving as string) ?? "",
            volgorde: (data.volgorde as number) ?? 0,
            categorie: (data.categorie as BadgeRuw["categorie"]) ?? "standaard",
          });
        } else if (seg[2] === "cursussen") {
          heeftCurriculum = true;
          currCursussen.push({
            id: seg[3],
            stroom,
            naam: (data.naam as string) ?? seg[3],
            volgorde: (data.volgorde as number) ?? 0,
          });
        }
        break;
      }
      case "deelbadges": {
        const { scores, scoreNotities, scoreAudit, ...def } = data as unknown as DeelbadgeDoc;
        deelevaluaties.push(def as Deelevaluatie);
        for (const [sid, v] of Object.entries(scores ?? {})) deelKleuren[`${def.id}:${sid}`] = v;
        for (const [sid, v] of Object.entries(scoreNotities ?? {}))
          deelNotities[`${def.id}:${sid}`] = v;
        for (const [k, v] of Object.entries(scoreAudit ?? {})) auditLog[k] = v;
        break;
      }
      case "evaluaties": {
        // evaluaties/{sj}/leerlingen/{sid}
        const sj = seg[1];
        const sid = seg[3];
        const d = data as unknown as EvalDoc;
        for (const [b, v] of Object.entries(d.kleuren ?? {})) kleuren[`${sj}:${sid}:${b}`] = v;
        for (const [b, v] of Object.entries(d.notities ?? {})) notities[`${sj}:${sid}:${b}`] = v;
        for (const b of d.gewist ?? []) gewist.push(`${sj}:${sid}:${b}`);
        for (const [k, v] of Object.entries(d.auditLog ?? {})) auditLog[k] = v;
        break;
      }
      case "meldingen": {
        const sid = seg[1];
        const d = data as unknown as MeldingDoc;
        meldingen.push(...(d.meldingen ?? []));
        if (typeof d.gezienOp === "number") meldingGezien[sid] = d.gezienOp;
        break;
      }
      case "instellingen": {
        if (seg[1] === "app") {
          r.schooljaar = data.schooljaar as string;
          r.matrixStromen = data.matrixStromen as Stroom[];
          r.matrixCursus = data.matrixCursus as string;
          r.afgeslotenSchooljaren = (data.afgeslotenSchooljaren as string[] | null) ?? null;
        } else if (seg[1] === "overlays") {
          r.doelWijzigingen = data.doelWijzigingen as RauweStore["doelWijzigingen"];
          r.doelenImport = data.doelenImport as RauweStore["doelenImport"];
          r.rubriekWijzigingen = data.rubriekWijzigingen as RauweStore["rubriekWijzigingen"];
        }
        break;
      }
    }
  }

  r.curriculumOverride =
    heeftCurriculum && currBadges.length > 0
      ? { cursussen: currCursussen, badges: currBadges }
      : null;
  r.vestigingen = heeftVestigingen ? vestigingen : null;
  const rubriekenArr: Rubriek[] = rubriekRuw
    .map((x) => ({
      id: x.id,
      stroom: x.stroom,
      cursus: rubriekCursusNamen.get(x.cursusId) ?? x.cursusId,
      naam: x.naam,
      doelen: x.doelen,
      criteria: x.criteria,
      leerlijn: x.leerlijn,
      volgorde: x.volgorde,
    }))
    .sort(
      (a, b) =>
        a.stroom.localeCompare(b.stroom) ||
        a.cursus.localeCompare(b.cursus, "nl") ||
        a.volgorde - b.volgorde,
    );
  r.rubriekenOverride = heeftRubrieken && rubriekenArr.length > 0 ? rubriekenArr : null;

  if (!geinitialiseerd) return r; // enkel de curriculum-/vestiging-/rubriek-override; de rest = seed behouden

  r.students = students;
  r.mentoren = mentoren;
  r.groepen = groepen;
  r.deelevaluaties = deelevaluaties;
  r.kleuren = kleuren;
  r.notities = notities;
  r.deelKleuren = deelKleuren;
  r.deelNotities = deelNotities;
  r.auditLog = auditLog;
  r.gewist = gewist;
  r.meldingen = meldingen;
  r.meldingGezien = meldingGezien;
  return r;
}

// --- diff -------------------------------------------------------------------

/**
 * Stabiele JSON: objectsleutels gesorteerd. Firestore geeft map-sleutels in een andere volgorde
 * terug dan wij ze schrijven; zonder deze normalisatie ziet de diff dat als een wijziging (→
 * overbodige writes bij `bewaar`, en de app herbouwt bij elke echo-snapshot).
 */
function stabielJson(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stabielJson).join(",")}]`;
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stabielJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(x) ?? "null";
}

const zelfde = (a: unknown, b: unknown) => stabielJson(a) === stabielJson(b);

/** De documenten die veranderd/nieuw zijn, en de paden die verdwenen. */
export function diffDocs(oud: DocMap, nieuw: DocMap): { schrijf: DocMap; verwijder: string[] } {
  const schrijf: DocMap = new Map();
  for (const [pad, data] of nieuw) {
    if (!zelfde(oud.get(pad), data)) schrijf.set(pad, data);
  }
  const verwijder: string[] = [];
  for (const pad of oud.keys()) if (!nieuw.has(pad)) verwijder.push(pad);
  return { schrijf, verwijder };
}
