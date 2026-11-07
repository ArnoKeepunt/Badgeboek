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
  Rapport,
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
 *   rapporten/{id}             (= Rapport, handmatig ingevuld, `vestiging` gedenormaliseerd)
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

/** Een rapport-item-sleutel (`rapport:${rapportId}:${rubriekId}`, zie `rapportItemSleutel`). */
const isRapportSleutel = (k: string) => k.startsWith("rapport:");

interface EvalDoc {
  kleuren: Record<string, Rating>;
  notities: Record<string, Notitie>;
  gewist: string[];
  auditLog: Record<string, AuditRegel[]>;
  /**
   * Badge-id → `true` = "te laat ingediend" (naast de kleur). Enkel aanwezig als er minstens
   * één is: zo ziet de diff bestaande docs (zonder dit veld) niet als gewijzigd — anders zou elke
   * save ze allemaal herschrijven.
   */
  teLaat?: Record<string, true>;
  /** Gedenormaliseerd van de leerling — nodig om de regels per vestiging te laten afschermen. */
  vestiging: string;
}

interface DeelbadgeDoc extends Deelevaluatie {
  scores: Record<string, Rating>;
  scoreNotities: Record<string, Notitie>;
  scoreAudit: Record<string, AuditRegel[]>;
  /**
   * Leerling-id → `true` = "te laat ingediend". Enkel aanwezig als er minstens één is (zelfde
   * reden als bij `EvalDoc.teLaat`: een deelbadge van een afgesloten jaar mag niet herschreven
   * worden, Firestore zou de hele batch weigeren).
   */
  teLaat?: Record<string, true>;
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

  // Gedenormaliseerd van de leerling — nodig om `deelbadges`/`rapporten` per vestiging af te
  // schermen (zelfde reden als bij de evaluatie-docs verderop).
  const vestigingVanLeerling = new Map(s.students.map((l) => [l.id, l.vestiging ?? ""]));

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
    for (const k of Object.keys(s.teLaat ?? {})) {
      if (!isDeelSleutel(k)) continue;
      const i = k.lastIndexOf(":");
      if (k.slice(0, i) === d.id) (doc.teLaat ??= {})[k.slice(i + 1)] = true;
    }
    m.set(`deelbadges/${d.id}`, doc as unknown as DocData);
  }

  // rapporten: volledig doc, plus het gedenormaliseerde vestiging-veld en de geschiedenis per
  // rubric-item (kleur + opmerking delen een sleutel, zie `rapportItemSleutel`).
  for (const r of s.rapporten) {
    const itemAudit: Record<string, AuditRegel[]> = {};
    const voorvoegsel = `rapport:${r.id}:`;
    for (const [k, v] of Object.entries(s.auditLog)) {
      if (k.startsWith(voorvoegsel)) itemAudit[k] = v;
    }
    m.set(`rapporten/${r.id}`, {
      ...r,
      // Leerling (nog) niet geladen → de vestiging van het doc zelf behouden; "" zou de regels
      // laten weigeren (en daarmee de hele gebundelde save van deze gebruiker).
      vestiging:
        vestigingVanLeerling.get(r.studentId) ??
        (r as Rapport & { vestiging?: string }).vestiging ??
        "",
      itemAudit,
    } as unknown as DocData);
  }

  // evaluaties per (schooljaar, leerling)
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
  for (const k of Object.keys(s.teLaat ?? {})) {
    if (isDeelSleutel(k)) continue; // hoort bij een deelbadge-doc
    const [sj, sid, ...rest] = k.split(":");
    if (rest.length && neemJaar(sj)) (evalDoc(sj, sid).teLaat ??= {})[rest.join(":")] = true;
  }
  for (const k of s.gewist) {
    if (isDeelSleutel(k)) continue; // deelbadge: afwezigheid = gewist
    const [sj, sid, ...rest] = k.split(":");
    if (rest.length && neemJaar(sj)) evalDoc(sj, sid).gewist.push(rest.join(":"));
  }
  for (const [k, v] of Object.entries(s.auditLog)) {
    if (isDeelSleutel(k)) continue; // hoort bij een deelbadge-doc
    if (isRapportSleutel(k)) continue; // hoort bij een rapport-doc
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

  // Let op: de stroom-/cursusfilter van de matrix-pagina's (`matrixStromen`/`matrixCursus`) én
  // het **bekeken** schooljaar (de `SchooljaarKiezer`) rijden hier bewust NIET mee — dat zijn
  // per-browser UI-voorkeuren, geen personeel-brede instelling. Anders bepaalt de laatste klik
  // van de ene mentor wat een ander live te zien krijgt (bv. iedereen die mee terugspringt naar
  // een archiefjaar zodra één mentor dat even bekijkt). `s.schooljaar` blijft wel gewoon op
  // `PersistedStore` staan — `bewaar()` in `firebasePersistentie.ts` heeft dat intern nodig om te
  // weten op welk schooljaar de `evaluaties/…`-luisteraar moet draaien — het wordt hier alleen
  // niet mee weggeschreven naar dit gedeelde document.
  m.set("instellingen/app", {
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
  const rapporten: Rapport[] = [];
  const kleuren: Record<string, Rating> = {};
  const notities: Record<string, Notitie> = {};
  const deelKleuren: Record<string, Rating> = {};
  const deelNotities: Record<string, Notitie> = {};
  const auditLog: Record<string, AuditRegel[]> = {};
  const teLaat: Record<string, true> = {};
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
        const { scores, scoreNotities, scoreAudit, teLaat: laat, ...def } =
          data as unknown as DeelbadgeDoc;
        deelevaluaties.push(def as Deelevaluatie);
        for (const [sid, v] of Object.entries(scores ?? {})) deelKleuren[`${def.id}:${sid}`] = v;
        for (const [sid, v] of Object.entries(scoreNotities ?? {}))
          deelNotities[`${def.id}:${sid}`] = v;
        for (const [k, v] of Object.entries(scoreAudit ?? {})) auditLog[k] = v;
        for (const sid of Object.keys(laat ?? {})) teLaat[`${def.id}:${sid}`] = true;
        break;
      }
      case "rapporten": {
        // Het doc draagt ook `vestiging` (enkel voor de regels, geen veld op `Rapport` zelf) —
        // `storeNaarDocs` overschrijft dat bij elke save opnieuw, dus laten staan is onschadelijk.
        const r = data as unknown as Rapport & { itemAudit?: Record<string, AuditRegel[]> };
        rapporten.push(r as Rapport);
        for (const [k, v] of Object.entries(r.itemAudit ?? {})) auditLog[k] = v;
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
        for (const b of Object.keys(d.teLaat ?? {})) teLaat[`${sj}:${sid}:${b}`] = true;
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
          // Geen `r.schooljaar` hier: dat is een per-browser voorkeur en rijdt bewust niet mee
          // in dit gedeelde document, zie de comment bij `storeNaarDocs` hierboven.
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
  r.rapporten = rapporten;
  r.kleuren = kleuren;
  r.notities = notities;
  r.deelKleuren = deelKleuren;
  r.deelNotities = deelNotities;
  r.auditLog = auditLog;
  r.teLaat = teLaat;
  r.gewist = gewist;
  r.meldingen = meldingen;
  r.meldingGezien = meldingGezien;
  return r;
}

// --- diff -------------------------------------------------------------------

/**
 * Een rapport-doc zoals de server het geeft, aangevuld met dezelfde standaardvelden die
 * `verwerkRauw` (store.ts) op elk rapport zet. Zonder dit ziet de diff in `bewaar()` élk ouder
 * rapport (bv. zonder `cursusKleuren`, sinds 2026-10-19) als gewijzigd en schrijft het mee —
 * ook een afgewerkt rapport, dat een mentor niet mag wijzigen. Firestore weigert dan de hele
 * batch, dus ook de eigenlijke wijziging van de mentor.
 */
export function normaliseerRapportDoc(d: DocData): DocData {
  return {
    ...d,
    rubriekItems: d.rubriekItems ?? {},
    cursusKleuren: d.cursusKleuren ?? {},
    cursusOpmerkingen: d.cursusOpmerkingen ?? {},
    klassenraadCommentaar: d.klassenraadCommentaar ?? "",
  };
}

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

export const zelfde = (a: unknown, b: unknown) => stabielJson(a) === stabielJson(b);

/**
 * Top-level velden die `storeNaarDocs` weglaat zolang ze leeg zijn (zie `EvalDoc.teLaat`). Staan
 * ze op de server maar niet meer in het nieuwe doc, dan moeten ze echt gewist worden.
 */
const WEGLAATBARE_VELDEN = new Set(["teLaat"]);

const isMap = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);

/**
 * Firestore schrijft met `merge: true` (zodat gelijktijdige wijzigingen van collega's in hetzelfde
 * doc niet verloren gaan). Gevolg: een sleutel die je lokaal uit een map haalt — een notitie die
 * je wist, een "te laat"-vinkje dat je weghaalt — blijft op de server staan en komt via de
 * volgende snapshot terug. Deze functie zet daarom op elke plek waar `oud` (de serverstand) iets
 * had dat `nieuw` niet meer heeft een wis-markering (`wis()` = `deleteField()`), recursief door
 * geneste maps. Top-level enkel voor `WEGLAATBARE_VELDEN` en velden die expliciet `undefined`
 * zijn — onbekende velden (bv. van een nieuwere app-versie) blijven zo ongemoeid.
 */
export function metWissingen(
  oud: DocData | undefined,
  nieuw: DocData,
  wis: () => unknown,
): DocData {
  if (!oud) return nieuw;
  const uit: DocData = { ...nieuw };
  for (const [k, oudeWaarde] of Object.entries(oud)) {
    const n = nieuw[k];
    if (n === undefined) {
      if (WEGLAATBARE_VELDEN.has(k) || k in nieuw) uit[k] = wis();
    } else if (isMap(oudeWaarde) && isMap(n)) {
      uit[k] = mapMetWissingen(oudeWaarde, n, wis);
    }
  }
  return uit;
}

function mapMetWissingen(
  oud: Record<string, unknown>,
  nieuw: Record<string, unknown>,
  wis: () => unknown,
): Record<string, unknown> {
  const uit: Record<string, unknown> = { ...nieuw };
  for (const [k, oudeWaarde] of Object.entries(oud)) {
    const n = nieuw[k];
    if (n === undefined) uit[k] = wis();
    else if (isMap(oudeWaarde) && isMap(n)) uit[k] = mapMetWissingen(oudeWaarde, n, wis);
  }
  return uit;
}

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

// --- gerichte wijzigingen -----------------------------------------------------

/**
 * Markering in een patch: "dit veld heeft de gebruiker gewist" (bij het schrijven `deleteField()`).
 * Een gewone string, zodat een patch JSON-veilig en zonder Firestore-SDK te testen blijft.
 */
export const WEG = "__keerpunt_weg__";

/** Enkel de velden die een gebruiker wijzigde; `null` = het hele document verwijderen. */
export interface DocWijziging {
  patch: DocData | null;
  /** Het volledige doc, voor als het op de server (nog) niet bestaat. `null` = dan niets doen. */
  volledig: DocData | null;
}
export type Wijzigingen = Map<string, DocWijziging>;

function verschil(
  basis: Record<string, unknown>,
  nieuw: Record<string, unknown>,
  bovenaan: boolean,
): Record<string, unknown> {
  const uit: Record<string, unknown> = {};
  for (const [k, n] of Object.entries(nieuw)) {
    const b = basis[k];
    if (n === undefined) {
      if (b !== undefined) uit[k] = WEG;
    } else if (isMap(n) && (b === undefined || isMap(b))) {
      // Nooit een hele map meesturen: een `merge` vervangt de map op de server als ze leeg is, en
      // zo blijven ook sleutels van collega's in dezelfde map ongemoeid.
      const sub = verschil((b as Record<string, unknown>) ?? {}, n, false);
      if (Object.keys(sub).length > 0) uit[k] = sub;
    } else if (!zelfde(b, n)) {
      uit[k] = n;
    }
  }
  for (const [k, b] of Object.entries(basis)) {
    if (k in nieuw || b === undefined) continue;
    if (bovenaan && isMap(b)) {
      // Een weggelaten veld bovenaan (`teLaat`): enkel de sleutels wissen die de gebruiker kende.
      const sub = Object.fromEntries(Object.keys(b).map((s) => [s, WEG]));
      if (Object.keys(sub).length > 0) uit[k] = sub;
    } else {
      uit[k] = WEG;
    }
  }
  return uit;
}

/** Wat veranderde er tussen `basis` en `nieuw`? Enkel de gewijzigde bladeren, nooit een lege map. */
export function verschilTussenDocs(basis: DocData, nieuw: DocData): DocData {
  return verschil(basis, nieuw, true);
}

/** Past een patch toe op een document, zonder het origineel te wijzigen. */
export function pasPatchToe(doc: DocData, patch: DocData): DocData {
  const uit: DocData = { ...doc };
  for (const [k, v] of Object.entries(patch)) {
    if (v === WEG) delete uit[k];
    else if (isMap(v)) uit[k] = pasPatchToe(isMap(uit[k]) ? uit[k] : {}, v);
    else uit[k] = v;
  }
  return uit;
}

function combineerPatches(oud: DocData, nieuw: DocData): DocData {
  const uit: DocData = { ...oud };
  for (const [k, v] of Object.entries(nieuw)) {
    const o = uit[k];
    uit[k] = isMap(v) && isMap(o) ? combineerPatches(o, v) : v;
  }
  return uit;
}

/** Vervangt de `WEG`-markeringen door de echte wis-waarde (`deleteField()`). */
export function vervangWeg(patch: DocData, wis: () => unknown): DocData {
  const uit: DocData = {};
  for (const [k, v] of Object.entries(patch)) {
    uit[k] = v === WEG ? wis() : isMap(v) ? vervangWeg(v, wis) : v;
  }
  return uit;
}

/**
 * Voegt toe wat de gebruiker wijzigde tussen twee stoorstanden (`basis` → `nu`). Dit is de enige
 * bron van wat er geschreven wordt: wat de gebruiker niet aanraakte, kan zo nooit verdwijnen, hoe
 * oud deze browserstand ook is.
 */
export function voegWijzigingenToe(lopend: Wijzigingen, basis: DocMap, nu: DocMap): void {
  for (const [pad, doc] of nu) {
    const b = basis.get(pad);
    const volledig = verschilTussenDocs({}, doc);
    if (!b) {
      lopend.set(pad, { patch: volledig, volledig });
      continue;
    }
    const patch = verschilTussenDocs(b, doc);
    const eerder = lopend.get(pad);
    if (Object.keys(patch).length === 0) {
      if (eerder) lopend.set(pad, { ...eerder, volledig });
      continue;
    }
    lopend.set(pad, {
      patch: eerder?.patch ? combineerPatches(eerder.patch, patch) : eerder ? volledig : patch,
      volledig,
    });
  }
  for (const [pad, b] of basis) {
    if (nu.has(pad)) continue;
    if (pad.startsWith("evaluaties/")) {
      // Een evaluatie-doc bestaat enkel zolang er iets in staat: "weg" betekent hier dat deze
      // gebruiker niets meer ziet, niet dat ook wat een collega intussen toevoegde weg moet.
      const leeg: DocData = { kleuren: {}, notities: {}, gewist: [], auditLog: {} };
      const patch = verschilTussenDocs(b, { ...leeg, vestiging: b.vestiging });
      lopend.set(pad, { patch, volledig: null });
    } else {
      lopend.set(pad, { patch: null, volledig: null });
    }
  }
}

/** De serverstand met de openstaande wijzigingen erover: wat de gebruiker hoort te zien. */
export function pasWijzigingenToe(docs: DocMap, lopend: Wijzigingen): DocMap {
  const uit: DocMap = new Map(docs);
  for (const [pad, w] of lopend) {
    const op = uit.get(pad);
    if (w.patch === null) uit.delete(pad);
    else if (op) uit.set(pad, pasPatchToe(op, w.patch));
    else if (w.volledig) uit.set(pad, w.volledig);
  }
  return uit;
}

/**
 * Wat er nu echt naar de server moet: `patches` om te versturen, `resultaat` = het volledige doc
 * erna (voor de back-up). Wat er intussen al staat of al weg is, valt af.
 */
export function planSchrijfactie(
  lopend: Wijzigingen,
  server: DocMap,
): { patches: DocMap; resultaat: DocMap; verwijder: string[] } {
  const patches: DocMap = new Map();
  const resultaat: DocMap = new Map();
  const verwijder: string[] = [];
  for (const [pad, w] of lopend) {
    const op = server.get(pad);
    if (w.patch === null) {
      if (op) verwijder.push(pad);
    } else if (!op) {
      if (w.volledig) {
        patches.set(pad, w.volledig);
        resultaat.set(pad, w.volledig);
      }
    } else {
      const na = pasPatchToe(op, w.patch);
      if (!zelfde(na, op)) {
        patches.set(pad, w.patch);
        resultaat.set(pad, na);
      }
    }
  }
  return { patches, resultaat, verwijder };
}
