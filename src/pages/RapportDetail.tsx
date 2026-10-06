import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ColorBar } from "../components/ColorBar";
import { usePopover } from "../lib/popover";
import { NotitieVeld } from "../components/NotitieVeld";
import { RapportOpmerkingVeld } from "../components/RapportOpmerkingVeld";
import { RatingCell } from "../components/RatingCell";
import { cursussenVoorStroom, leerdoelenVoorCursus } from "../lib/curriculum";
import { deelevaluatiesVoorBadge } from "../lib/deelevaluaties";
import { groepLeden } from "../lib/groepen";
import { aantalBehaald, telKleuren } from "../lib/kleurstats";
import {
  GRAAD_LABEL,
  graadVan,
  filterLeerlingen,
  isIngeschreven,
  leerjaarInSchooljaar,
  stroomVan,
  useLeerlingFilter,
} from "../lib/leerlingen";
import { RATING_EMPTY_LABEL, RATING_KORT, RATING_LABEL } from "../lib/ratings";
import { magLeerlingZien, useBereik, useZichtbareLeerlingen } from "../lib/rechten";
import { KLEUR_KEY, KLEUREN, rubriekenVoorCursus } from "../lib/rubrieken";
import { useEffectieveRol } from "../lib/sessie";
import {
  getDeelKleur,
  getDeelNotitie,
  getDoelKleur,
  getNotitie,
  getRapportCursusOpmerking,
  getRapportItem,
  heropenRapport,
  rapportenVoorStudent,
  rondRapportAf,
  rubriekenLijst,
  useStore,
  verwijderRapport,
  zetRapportAlgemeneOpmerking,
  zetRapportCursusOpmerking,
  zetRapportRubriekKleur,
} from "../lib/store";
import type { Rapport } from "../lib/types";
import { rapportItemSleutel } from "../lib/types";
import { useGeschiedenis, useWijzigingLabel } from "../lib/wijzigingslog";

// `fold` = de UITGEKLAPTE cursus-id's (net als op Badges.tsx) — de rest staat standaard dicht,
// dat scheelt véél render-werk zolang je niet elke cursus tegelijk nodig hebt.
const FOLD_KEY = "keerpunt-badgeboek:rapport-fold:v2";

function loadFold(): string[] {
  try {
    const raw = localStorage.getItem(FOLD_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

const zonder = (arr: string[], id: string) => arr.filter((x) => x !== id);
const met = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id]);

// Zelfde stijl/spec als de PotloodIcoon e.a. in `RijIcoontjes.tsx` (16×16, strokeWidth 1.4,
// ronde lijnuiteinden) — hier lokaal, net zoals meerdere andere pagina's hun eigen PotloodIcoon
// hebben i.p.v. te importeren.
const svgBasis = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function PrinterIcoon() {
  return (
    <svg {...svgBasis}>
      <path d="M4.5 6V2h7v4M5 9.5h6v4H5z" />
      <path d="M4.5 6h-1A1.5 1.5 0 0 0 2 7.5V11h2.5M11.5 6h1A1.5 1.5 0 0 1 14 7.5V11h-2.5" />
    </svg>
  );
}

function PdfIcoon() {
  return (
    <svg {...svgBasis}>
      <path d="M4.5 2h4l3 3v8.5a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5V2.5a.5.5 0 0 1 .5-.5z" />
      <path d="M8.5 2v3h3" />
      <path d="M6 8.5v3.7M4.3 10.5l1.7 1.7 1.7-1.7" />
    </svg>
  );
}

function PijlIcoon({ richting }: { richting: "links" | "rechts" }) {
  return (
    <svg {...svgBasis}>
      <path d={richting === "links" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"} />
    </svg>
  );
}

/**
 * Klik op een rubric-criterium = meteen die kleur kiezen. Enkel als de klik het einde is van
 * tekst selecteren (slepen), kiezen we niets — zo blijft de tekst kopieerbaar.
 */
function kiesNaKlik(kies: () => void) {
  if (window.getSelection()?.toString()) return;
  kies();
}

/**
 * Het vak "Algemene opmerking". Gecontroleerd i.p.v. `defaultValue`: zo verschijnt een
 * opmerking die een andere mentor intussen bewaarde ook hier (zolang je zelf niet aan het typen
 * bent), en overschrijf je die niet met een verouderde tekst. Bewaart bij blur én bij het
 * verlaten van de pagina/rapport — een klik op een link geeft in Safari geen blur-event.
 */
function AlgemeneOpmerkingVeld({
  opmerking,
  onSave,
  readonly,
  title,
}: {
  opmerking: string;
  onSave: (tekst: string) => void;
  readonly: boolean;
  title?: string;
}) {
  const [tekst, setTekst] = useState(opmerking);
  const [bezig, setBezig] = useState(false);
  const [gezien, setGezien] = useState(opmerking);
  // Een wijziging van elders overnemen, maar niet terwijl de gebruiker zelf typt.
  if (opmerking !== gezien && !bezig) {
    setGezien(opmerking);
    setTekst(opmerking);
  }

  const laatste = useRef({ tekst, opmerking, readonly, onSave });
  useEffect(() => {
    laatste.current = { tekst, opmerking, readonly, onSave };
  });

  // Bij het weggaan (andere pagina of ander rapport) nog niet bewaarde tekst wegschrijven.
  useEffect(
    () => () => {
      const l = laatste.current;
      if (!l.readonly && l.tekst !== l.opmerking) l.onSave(l.tekst);
    },
    [],
  );

  return (
    <textarea
      rows={4}
      readOnly={readonly}
      value={tekst}
      title={title}
      onFocus={() => setBezig(true)}
      onChange={(e) => setTekst(e.target.value)}
      onBlur={() => {
        setBezig(false);
        if (!readonly && tekst !== opmerking) onSave(tekst);
      }}
    />
  );
}

/**
 * Rapport voor één leerling: links het rapport zelf, rechts een alleen-lezen naslagpaneel met
 * alle badges van de leerling — zodat de mentor bij het kiezen van een rubric-kleur meteen de
 * onderliggende badges (en, enkel hier, de deelbadges erachter) kan bekijken, zonder naar een
 * andere pagina te moeten springen. De bestaande opmerking (`NotitieVeld`) bij een badge/deelbadge
 * is daar ook zichtbaar (alleen-lezen, achter hetzelfde bubbel-knopje als op de badgematrix) —
 * dat schrijf je nog altijd aan op `/badges`/`/deelevaluaties` zelf.
 *
 * Links staan per cursus de uitgeschreven rubrics (dezelfde als op de Rubrics-pagina, zie
 * `lib/rubrieken.ts` — een aanpassing daar werkt hier automatisch door): de mentor leest de
 * criteria per kleur en kiest per **rubric** blauw/groen/geel/rood, volledig handmatig (geen
 * afleiding uit de badges). Zolang er geen kleur gekozen is, staan alle 4 criteria erbij om uit
 * te kiezen; eens gekozen blijft enkel die ene criteriumtekst nog staan (de rest is dan niet
 * meer relevant). De opmerking staat bewust per **cursus** (niet per rubric, dat werd als te
 * fijnmazig ervaren) — in de cursuskop, naast de rubrics. Een cursus zonder uitgeschreven rubric
 * toont dat expliciet i.p.v. een kleur te laten kiezen. De cursusfilter bovenaan filtert beide
 * panelen.
 *
 * Een rapport is per rapportmoment (bv. "Rapport 1") en kan afgewerkt/vergrendeld worden. Naar
 * buiten brengen gebeurt via het browser-printvenster op de printweergave-node (`.rapport-print`,
 * onderaan — enkel zichtbaar bij het afdrukken, `@media print` in `index.css`): "Printen" en
 * "Opslaan als pdf" openen allebei dat venster (bij de tweede kiest de mentor daar "Opslaan als
 * pdf" als bestemming). Een eigen pdf-generator (jspdf/html2canvas) werkte niet betrouwbaar. Beide
 * tonen standaard enkel de rubrics die effectief een kleur hebben — een nog niet
 * ingevulde/gekozen rubric staat er niet bij (op het scherm zelf blijft die gewoon zichtbaar).
 */
export function RapportDetail() {
  const { studentId } = useParams();
  const {
    students,
    groepen,
    kleuren,
    notities,
    rapporten,
    schooljaar,
    deelevaluaties,
    deelKleuren,
    deelNotities,
    rubriekenOverride,
    rubriekWijzigingen,
  } = useStore();
  // rubriekenLijst() leest de store (bundel + overrides/patches); herbereken als die wijzigen —
  // zelfde patroon als op de Rubrics-pagina, zodat een aanpassing daar hier automatisch doorwerkt.
  const alleRubrieken = useMemo(
    () => rubriekenLijst(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rubriekenOverride, rubriekWijzigingen],
  );
  const bereik = useBereik();
  const rol = useEffectieveRol();
  const wijzigingLabel = useWijzigingLabel();
  const geschiedenis = useGeschiedenis();
  const navigate = useNavigate();
  const location = useLocation();
  const kanTerug = location.key !== "default";
  const terug = () => (kanTerug ? navigate(-1) : navigate("/rapport"));

  const student = students.find((s) => s.id === studentId);
  const geenToegang = Boolean(student && !magLeerlingZien(bereik, student));

  const [fold, setFold] = useState<string[]>(loadFold);
  // Uitgeklapte deelbadges (leerdoel-id's) in het naslagpaneel rechts — enkel hier in het rapport
  // is een badge uitklapbaar tot zijn deelbadges; niet bewaard (net als bv. `doelOpen` op
  // Rubrics.tsx), telkens dicht bij het openen van de pagina.
  const [deelOpen, setDeelOpen] = useState<Set<string>>(new Set());
  const [gekozenId, setGekozenId] = useState<string | null>(null);
  // Cursusfilter — zelfde idee als op Badges/Deelevaluaties, maar hier lokaal (niet de gedeelde
  // `matrixCursus`): dit is een enkele-leerling-pagina, geen matrix over meerdere leerlingen.
  // Blijft wel gewoon staan bij "vorige"/"volgende" (React Router hermonteert de pagina niet bij
  // een param-wissel binnen dezelfde route), precies zoals gevraagd.
  const [cursusFilter, setCursusFilter] = useState("");
  // Leerlingkiezer (popover, geopend vanaf het middenblok van de vorige/volgende-balk).
  const [kiesOpen, setKiesOpen] = useState(false);
  const [kiesZoek, setKiesZoek] = useState("");
  const kiesTrigger = useRef<HTMLButtonElement>(null);
  const kiesPaneel = useRef<HTMLDivElement>(null);
  const kiesPos = usePopover(kiesOpen, kiesTrigger, () => setKiesOpen(false), {
    breedte: 300,
    hoogte: 360,
    uitlijn: "midden",
    paneel: kiesPaneel,
  });

  useEffect(() => {
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify(fold));
    } catch {
      // opslag niet beschikbaar — stand blijft enkel voor deze sessie
    }
  }, [fold]);

  const mijnRapporten = useMemo(
    () => (student ? rapportenVoorStudent(rapporten, student.id, schooljaar) : []),
    [rapporten, student, schooljaar],
  );

  // Bij het openen (of als de gekozen id verdwenen is, bv. na verwijderen): het nieuwste rapport.
  useEffect(() => {
    if (gekozenId && mijnRapporten.some((r) => r.id === gekozenId)) return;
    setGekozenId(mijnRapporten[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mijnRapporten]);

  // "Vorige"/"volgende leerling": dezelfde (gedeelde, per-browser bewaarde) leerlingfilter als
  // op /rapport (klas/graad/vestiging/groep/zoeken) bepaalt door wie je bladert — zo hoef je niet
  // telkens terug naar de volledige lijst en blijft de gekozen klas/graad vanzelf behouden.
  const zichtbareLeerlingen = useZichtbareLeerlingen();
  const [leerlingFilter] = useLeerlingFilter();
  const navigeerbareLeerlingen = useMemo(() => {
    const leden = groepLeden(leerlingFilter.groepId, zichtbareLeerlingen, groepen);
    return filterLeerlingen(zichtbareLeerlingen, leerlingFilter, leden);
  }, [zichtbareLeerlingen, groepen, leerlingFilter]);

  if (!student) {
    return (
      <section>
        <h1>Leerling niet gevonden</h1>
        <Link to="/rapport">Terug naar rapport</Link>
      </section>
    );
  }

  if (geenToegang) {
    return (
      <section>
        <h1>Geen toegang</h1>
        <p className="lege-staat">
          Deze leerling zit in een andere vestiging. Je kunt enkel de leerlingen van je eigen
          vestiging bekijken — vraag een beheerder om toegang.
        </p>
        <Link to="/rapport">Terug naar rapport</Link>
      </section>
    );
  }

  const ingeschreven = isIngeschreven(student, schooljaar);
  const stroom = stroomVan(student, schooljaar);
  const graadDitJaar = graadVan(leerjaarInSchooljaar(student, schooljaar));
  const cursussen = cursussenVoorStroom(stroom);
  const cursusOpties = cursussen.map((c) => c.naam);
  const gekozenCursusFilter = cursusOpties.includes(cursusFilter) ? cursusFilter : "";
  // Enkel de twee schermweergaven (editor + naslagpaneel) filteren — de printweergave toont
  // altijd het volledige rapport, ongeacht wat er net op het scherm gefilterd staat.
  const cursussenGefilterd = gekozenCursusFilter
    ? cursussen.filter((c) => c.naam === gekozenCursusFilter)
    : cursussen;
  const gekozen: Rapport | undefined = mijnRapporten.find((r) => r.id === gekozenId);
  const vergrendeld = gekozen?.status === "afgewerkt";
  const magHeropenen = rol === "beheerder";
  // Verwijderen is beheerder-only (ook in de Firestore-regels), zowel concept als afgewerkt.
  const magVerwijderen = rol === "beheerder";

  // Printweergave: enkel de rubrics die effectief een kleur hebben — een leeg/niet-gekozen
  // rubric staat er standaard niet bij (dat is ballast op een rapport dat de deur uit gaat; het
  // volledige overzicht incl. lege rubrics blijft gewoon op het scherm staan).
  const printRijen = gekozen
    ? cursussen.flatMap((cursus) =>
        rubriekenVoorCursus(alleRubrieken, stroom, cursus.naam, cursus.id)
          .map((r) => ({ cursus, r, item: getRapportItem(gekozen, r.id) }))
          .filter(({ item }) => item.kleur !== null),
      )
    : [];

  // Positie van deze leerling binnen de gefilterde lijst (-1 = buiten de huidige filter, bv. via
  // een rechtstreekse link geopend — dan tonen we geen vorige/volgende).
  const huidigeIndex = navigeerbareLeerlingen.findIndex((s) => s.id === student.id);
  const vorigeLeerling = huidigeIndex > 0 ? navigeerbareLeerlingen[huidigeIndex - 1] : null;
  const volgendeLeerling =
    huidigeIndex >= 0 && huidigeIndex < navigeerbareLeerlingen.length - 1
      ? navigeerbareLeerlingen[huidigeIndex + 1]
      : null;
  const gaNaar = (id: string) => {
    setKiesOpen(false);
    navigate(`/rapport/${id}`);
  };

  const kiesZoekTrim = kiesZoek.trim().toLowerCase();
  const kiesLijst = kiesZoekTrim
    ? navigeerbareLeerlingen.filter((s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(kiesZoekTrim),
      )
    : navigeerbareLeerlingen;

  const toggleCursus = (id: string) =>
    setFold((f) => (f.includes(id) ? zonder(f, id) : met(f, id)));
  const allesDicht = () => setFold([]);
  const allesOpen = () => setFold(cursussen.map((c) => c.id));
  // Filter je op één cursus, dan staat die sowieso open (zelfde gedrag als de cursusfilter op
  // Badges/Deelevaluaties) — geldt voor beide panelen, ze groeperen allebei per cursus.
  const cursusOpen = (cursusId: string) => Boolean(gekozenCursusFilter) || fold.includes(cursusId);
  const toggleDeel = (leerdoelId: string) =>
    setDeelOpen((prev) => {
      const next = new Set(prev);
      if (next.has(leerdoelId)) next.delete(leerdoelId);
      else next.add(leerdoelId);
      return next;
    });

  // Bestandsnaam voor "Opslaan als pdf": "naamRapport-vestiging-schooljaar-voornaamNaam" (zonder
  // ".pdf" — de browser voegt die zelf toe aan `document.title` bij "Opslaan als pdf"; zet je die
  // erbij, dan krijg je "….pdf.pdf"). Filenaam-onveilige tekens (bv. "/" in een vrij getypte
  // rapportnaam) eruit gefilterd.
  const veiligVoorBestandsnaam = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();
  const downloadBestandsnaam = (rapport: Rapport): string => {
    const naamRapport = veiligVoorBestandsnaam(rapport.naam) || "Rapport";
    const vestiging = veiligVoorBestandsnaam(student.vestiging) || "onbekend";
    const voornaamNaam =
      veiligVoorBestandsnaam(`${student.firstName}${student.lastName}`) || "leerling";
    return `${naamRapport}-${vestiging}-${rapport.schooljaar}-${voornaamNaam}`;
  };
  // Het printvenster gebruikt `document.title` als voorgestelde bestandsnaam (bv. kiest de
  // mentor daar zelf "Opslaan als pdf" als bestemming) — tijdelijk wisselen, en terugzetten
  // zodra het venster weer sluit (`afterprint`, vuurt zowel bij printen als annuleren).
  const printen = () => {
    if (!gekozen) return;
    const vorigeTitel = document.title;
    document.title = downloadBestandsnaam(gekozen);
    const herstelTitel = () => {
      document.title = vorigeTitel;
      window.removeEventListener("afterprint", herstelTitel);
    };
    window.addEventListener("afterprint", herstelTitel);
    window.print();
  };

  // De metaregel van de printweergave onderaan (`.rapport-print-meta`).
  const rapportMetaTekst = `${student.firstName} ${student.lastName} · ${student.vestiging} · ${GRAAD_LABEL[graadDitJaar]} · ${student.leerjaar}e jaar · groep ${student.klasgroep} · schooljaar ${schooljaar}`;

  return (
    <section>
      <div className="detail-terug no-print">
        <button type="button" className="linkknop" onClick={terug}>
          &larr; Terug
        </button>
        <Link to="/rapport">Alle rapporten</Link>
      </div>

      <div className="rapport-leerling-nav no-print">
        <button
          type="button"
          className="knop-secundair rapport-icoonknop"
          disabled={!vorigeLeerling}
          title={
            vorigeLeerling
              ? `Vorige: ${vorigeLeerling.firstName} ${vorigeLeerling.lastName}`
              : "Eerste leerling in deze filter"
          }
          onClick={() => vorigeLeerling && gaNaar(vorigeLeerling.id)}
        >
          <PijlIcoon richting="links" />
          Vorige
        </button>

        <button
          ref={kiesTrigger}
          type="button"
          className="knop-secundair rapport-leerling-kies-knop"
          aria-haspopup="listbox"
          aria-expanded={kiesOpen}
          title="Kies een specifieke leerling"
          onClick={() => {
            setKiesZoek("");
            setKiesOpen((o) => !o);
          }}
        >
          <span className="rapport-leerling-nav-naam">
            {student.firstName} {student.lastName}
          </span>
          <span className="rapport-leerling-nav-meta">
            {GRAAD_LABEL[graadDitJaar]} · {student.leerjaar}e jaar · groep {student.klasgroep} ·{" "}
            {student.vestiging} · badgeboek {stroom}
            {huidigeIndex >= 0 && navigeerbareLeerlingen.length > 1 && (
              <>
                {" "}
                · {huidigeIndex + 1} / {navigeerbareLeerlingen.length}
              </>
            )}
          </span>
        </button>

        {kiesOpen &&
          kiesPos &&
          createPortal(
            <>
              <button
                type="button"
                className="rating-cell-backdrop"
                aria-label="Sluiten"
                onClick={() => setKiesOpen(false)}
              />
              <div
                ref={kiesPaneel}
                className="rapport-leerling-picker zwevend-menu"
                role="listbox"
                style={{ top: kiesPos.top, left: kiesPos.left }}
              >
                <input
                  type="text"
                  className="rapport-leerling-picker-zoek"
                  placeholder="Zoek een leerling…"
                  value={kiesZoek}
                  onChange={(e) => setKiesZoek(e.target.value)}
                  autoFocus
                />
                <div className="rapport-leerling-picker-lijst">
                  {kiesLijst.length === 0 ? (
                    <p className="lege-staat" style={{ margin: 8 }}>
                      Geen leerling gevonden.
                    </p>
                  ) : (
                    kiesLijst.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={s.id === student.id}
                        className={`rapport-leerling-picker-item${
                          s.id === student.id ? " is-huidig" : ""
                        }`}
                        onClick={() => gaNaar(s.id)}
                      >
                        <span className="rapport-leerling-picker-naam">
                          {s.firstName} {s.lastName}
                        </span>
                        <span className="rapport-leerling-picker-meta">
                          {GRAAD_LABEL[graadVan(s.leerjaar)]} · {s.leerjaar}e jaar · groep{" "}
                          {s.klasgroep}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>,
            document.body,
          )}

        <button
          type="button"
          className="knop-secundair rapport-icoonknop"
          disabled={!volgendeLeerling}
          title={
            volgendeLeerling
              ? `Volgende: ${volgendeLeerling.firstName} ${volgendeLeerling.lastName}`
              : "Laatste leerling in deze filter"
          }
          onClick={() => volgendeLeerling && gaNaar(volgendeLeerling.id)}
        >
          Volgende
          <PijlIcoon richting="rechts" />
        </button>
      </div>

      {!ingeschreven ? (
        <p className="lege-staat no-print" style={{ marginTop: 16 }}>
          Deze leerling zat in <strong>{schooljaar}</strong> nog niet op school. Kies een later
          schooljaar bovenaan.
        </p>
      ) : (
        <>
          <div className="rapport-paneel no-print">
            <div className="rapport-toolbar">
              {mijnRapporten.length > 0 && (
                <label className="rapport-toolbar-kies">
                  <span>Rapportmoment</span>
                  <select
                    value={gekozenId ?? ""}
                    onChange={(e) => setGekozenId(e.target.value || null)}
                  >
                    {mijnRapporten.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.naam} {r.status === "afgewerkt" ? "— afgewerkt" : "— concept"}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="rapport-toolbar-kies">
                <span>Cursus</span>
                <select
                  value={gekozenCursusFilter}
                  onChange={(e) => setCursusFilter(e.target.value)}
                >
                  <option value="">Alle cursussen</option>
                  {cursusOpties.map((naam) => (
                    <option key={naam} value={naam}>
                      {naam}
                    </option>
                  ))}
                </select>
              </label>

              <span style={{ flex: 1 }} />

              {/* Altijd uiterst rechts boven en in een vaste volgorde, zodat de knoppen niet
                  verspringen naargelang de status: wat er al dan niet is (Verwijderen) staat
                  links, de afwerk-knop staat altijd op de laatste plek met een vaste breedte —
                  ook als er niets meer af te werken valt (dan uitgeschakeld). */}
              {gekozen && (
                <div className="rapport-acties">
                  {magVerwijderen && (
                    <button
                      type="button"
                      className="linkknop linkknop-gevaar"
                      onClick={() => {
                        if (confirm(`Rapport "${gekozen.naam}" definitief verwijderen?`)) {
                          verwijderRapport(gekozen.id);
                        }
                      }}
                    >
                      Verwijderen
                    </button>
                  )}
                  <div className="rapport-knopgroep">
                    <button
                      type="button"
                      className="knop-secundair rapport-icoonknop"
                      onClick={printen}
                    >
                      <PrinterIcoon />
                      Printen
                    </button>
                    <button
                      type="button"
                      className="knop-secundair rapport-icoonknop"
                      title='Opent het printvenster — kies daar "Opslaan als pdf" als bestemming.'
                      onClick={printen}
                    >
                      <PdfIcoon />
                      Opslaan als pdf
                    </button>
                  </div>
                  <div className="rapport-knopgroep">
                    {!vergrendeld ? (
                      <button
                        type="button"
                        className="knop-secundair rapport-afwerk-knop"
                        onClick={() => {
                          if (confirm(`Rapport "${gekozen.naam}" afwerken? Het staat dan vast.`)) {
                            rondRapportAf(gekozen.id);
                          }
                        }}
                      >
                        Rapport afwerken
                      </button>
                    ) : magHeropenen ? (
                      <button
                        type="button"
                        className="knop-secundair rapport-afwerk-knop"
                        onClick={() => heropenRapport(gekozen.id)}
                      >
                        Heropenen
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="knop-secundair rapport-afwerk-knop"
                        disabled
                        title="Enkel een beheerder kan een afgewerkt rapport heropenen."
                      >
                        Afgewerkt
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {gekozen && (
              <div className="rapport-status-balk">
                <span className={`rapport-status-chip is-${gekozen.status}`}>
                  {gekozen.status === "afgewerkt" ? "Afgewerkt" : "Concept"}
                </span>
                {vergrendeld && (
                  <span className="jaar-melding jaar-melding-slot" style={{ margin: 0 }}>
                    🔒 Dit rapport is afgewerkt en staat vast.
                    {magHeropenen && " Enkel een beheerder kan het heropenen."}
                  </span>
                )}
                {/* De bestemming in het printvenster kan een website niet zelf kiezen — Chrome/
                    Edge onthouden wel de laatste keuze, dus meestal is dit eenmalig per toestel. */}
                <span className="rapport-pdf-tip">
                  Pdf nodig? Kies in het printvenster bij <strong>Bestemming</strong> de optie{" "}
                  <strong>Opslaan als PDF</strong>.
                </span>
              </div>
            )}
          </div>

          {gekozen ? (
            <>
              <div className="sd-split rapport-split">
                <div className="sd-badges no-print">
                  <div className="badges-deelpaneel-kop">
                    <div>
                      <span className="badges-deelpaneel-label">Rapport</span>
                      <h2>{gekozen.naam}</h2>
                    </div>
                  </div>

                  {cursussenGefilterd.map((cursus) => {
                    const rubrieken = rubriekenVoorCursus(alleRubrieken, stroom, cursus.naam, cursus.id);
                    const open = cursusOpen(cursus.id);
                    const t = telKleuren(
                      rubrieken.map((r) => getRapportItem(gekozen, r.id).kleur),
                    );
                    const cursusOpmerking = getRapportCursusOpmerking(gekozen, cursus.id);
                    const opmerkingSleutel = rapportItemSleutel(gekozen.id, cursus.id);
                    return (
                      <div key={cursus.id} className="doel-comp">
                        <div className="rapport-cursus-kop">
                          <button
                            type="button"
                            className="rapport-cursus-toggle"
                            onClick={() => toggleCursus(cursus.id)}
                          >
                            <span className="grid-caret">{open ? "▾" : "▸"}</span>
                            {cursus.naam}
                          </button>
                          <span className="rapport-cursus-samenvatting-wrap">
                            {rubrieken.length === 0 ? (
                              <span className="rapport-geen-rubrics-tag">geen rubric</span>
                            ) : (
                              <>
                                <span className="grid-count">{rubrieken.length}</span>
                                <span className="rapport-cursus-balk">
                                  <ColorBar telling={t} />
                                </span>
                              </>
                            )}
                          </span>
                          <span title={wijzigingLabel(opmerkingSleutel) ?? undefined}>
                            <RapportOpmerkingVeld
                              label={`Opmerking bij ${cursus.naam}`}
                              opmerking={cursusOpmerking}
                              readonly={vergrendeld}
                              onSave={(tekst) =>
                                zetRapportCursusOpmerking(gekozen.id, cursus.id, tekst)
                              }
                            />
                          </span>
                        </div>

                        {cursusOpmerking && (
                          <p className="rapport-opmerking-tekst">{cursusOpmerking}</p>
                        )}

                        {open &&
                          (rubrieken.length === 0 ? (
                            <p className="lege-staat rapport-geen-rubrics">
                              Nog geen rubric uitgeschreven voor {cursus.naam} — zodra die er is
                              (via de Rubrics-pagina), kies je hier de kleur.
                            </p>
                          ) : (
                            <div className="rubriek-lijst">
                              {rubrieken.map((r) => {
                                const item = getRapportItem(gekozen, r.id);
                                const sleutel = rapportItemSleutel(gekozen.id, r.id);
                                const wLabel = wijzigingLabel(sleutel) ?? undefined;
                                // Nog geen (kleur)keuze: alle 4 criteria tonen om uit te kiezen.
                                // Eens een kleur gekozen is: enkel die ene criteriumtekst nog
                                // tonen — de rest is dan niet meer relevant voor dit rapport.
                                const kleurGekozen =
                                  item.kleur !== null &&
                                  (KLEUREN as readonly string[]).includes(item.kleur);
                                const teTonenKleuren = kleurGekozen
                                  ? [item.kleur as (typeof KLEUREN)[number]]
                                  : KLEUREN;
                                return (
                                  <article key={r.id} className="rubriek" title={wLabel}>
                                    <div className="rubriek-kop rapport-rubriek-kop">
                                      <h3 className="rubriek-naam">{r.naam}</h3>
                                      <RatingCell
                                        label={`${cursus.naam} — ${r.naam}`}
                                        readonly={vergrendeld}
                                        value={item.kleur}
                                        geschiedenis={geschiedenis(sleutel)}
                                        onChange={(next) =>
                                          zetRapportRubriekKleur(gekozen.id, r.id, next)
                                        }
                                      />
                                    </div>

                                    <dl className="rubriek-criteria">
                                      {teTonenKleuren.map((kleur) => {
                                        // Zolang er nog geen kleur gekozen is, kies je ook
                                        // rechtstreeks door op een criterium te klikken
                                        // (sneller dan via de kleurknop).
                                        const klikbaar = !kleurGekozen && !vergrendeld;
                                        const kies = () =>
                                          zetRapportRubriekKleur(gekozen.id, r.id, kleur);
                                        return (
                                          <div
                                            key={kleur}
                                            className={`rubriek-criterium rating-${kleur}${
                                              klikbaar ? " is-klikbaar" : ""
                                            }`}
                                            {...(klikbaar && {
                                              role: "button",
                                              tabIndex: 0,
                                              title: `Kies ${RATING_LABEL[kleur].toLowerCase()}`,
                                              onClick: () => kiesNaKlik(kies),
                                              onKeyDown: (e: React.KeyboardEvent) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  e.preventDefault();
                                                  kies();
                                                }
                                              },
                                            })}
                                          >
                                            <dt className="rubriek-criterium-kleur">
                                              {RATING_LABEL[kleur]}
                                            </dt>
                                            <dd className="rubriek-criterium-tekst">
                                              {r.criteria[KLEUR_KEY[kleur]] || "—"}
                                            </dd>
                                          </div>
                                        );
                                      })}
                                    </dl>
                                  </article>
                                );
                              })}
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>

                <aside className="badges-deelpaneel no-print">
                  <div className="badges-deelpaneel-kop">
                    <div>
                      <span className="badges-deelpaneel-label">Badgeboek — ter referentie</span>
                      <h2>Badges van {student.firstName}</h2>
                    </div>
                    <div className="matrix-acties">
                      <button type="button" className="linkknop" onClick={allesOpen}>
                        Alles uitklappen
                      </button>
                      <button type="button" className="linkknop" onClick={allesDicht}>
                        Alles inklappen
                      </button>
                    </div>
                  </div>

                  <div className="grid-wrap">
                    <table className="grid grid--rustig">
                      <thead>
                        <tr>
                          <th className="grid-col-doel">Badge</th>
                          <th className="grid-col-kleur">Kleur</th>
                        </tr>
                      </thead>
                      {cursussenGefilterd.map((cursus) => {
                        const open = cursusOpen(cursus.id);
                        const cursusDoelen = leerdoelenVoorCursus(cursus.id);
                        const t = telKleuren(
                          cursusDoelen.map((d) =>
                            getDoelKleur(kleuren, schooljaar, student.id, d.id),
                          ),
                        );
                        return (
                          <tbody key={cursus.id}>
                            <tr className="grid-cursus">
                              <th className="grid-col-doel">
                                <button
                                  type="button"
                                  className="grid-toggle"
                                  onClick={() => toggleCursus(cursus.id)}
                                >
                                  <span className="grid-caret">{open ? "▼" : "▶"}</span>
                                  {cursus.naam}
                                  <span className="grid-count">{cursusDoelen.length}</span>
                                </button>
                              </th>
                              <td
                                className="grid-cel grid-cel-cursus"
                                title={`${aantalBehaald(t)} van ${cursusDoelen.length} badges behaald`}
                              >
                                <div className="grid-cursus-samenvatting">
                                  <span>
                                    {aantalBehaald(t)}/{cursusDoelen.length}
                                  </span>
                                  <ColorBar telling={t} />
                                </div>
                              </td>
                            </tr>
                            {open &&
                              cursusDoelen.map((d) => {
                                const kleur = getDoelKleur(kleuren, schooljaar, student.id, d.id);
                                // Deelbadges: enkel in dit rapport-naslagpaneel uitklapbaar onder
                                // hun badge (niet op Badges.tsx) — een aparte, alleen-lezen lijst
                                // met de deelbadge-titel + kleur van deze leerling.
                                const deel = deelevaluatiesVoorBadge(
                                  deelevaluaties,
                                  d.id,
                                  schooljaar,
                                  cursus.naam,
                                  student.vestiging,
                                );
                                const deelUitgeklapt = deelOpen.has(d.id);
                                return (
                                  <Fragment key={d.id}>
                                    <tr>
                                      <td className="grid-col-doel grid-doel grid-doel-n1">
                                        {deel.length > 0 ? (
                                          <button
                                            type="button"
                                            className="grid-toggle rapport-deel-toggle"
                                            aria-expanded={deelUitgeklapt}
                                            onClick={() => toggleDeel(d.id)}
                                          >
                                            <span className="grid-caret">
                                              {deelUitgeklapt ? "▾" : "▸"}
                                            </span>
                                            <span className="grid-doel-tekst">
                                              {d.omschrijving}
                                            </span>
                                            <span className="grid-count">{deel.length}</span>
                                          </button>
                                        ) : (
                                          <span className="grid-doel-tekst">{d.omschrijving}</span>
                                        )}
                                      </td>
                                      <td
                                        className="grid-cel"
                                        title={kleur ? RATING_LABEL[kleur] : RATING_EMPTY_LABEL}
                                      >
                                        <div className={`grid-cel-inhoud rating-${kleur ?? "empty"}`}>
                                          <span
                                            className={`rating-cell-btn rating-${kleur ?? "empty"} is-readonly`}
                                          >
                                            {kleur ? RATING_KORT[kleur] : "–"}
                                          </span>
                                          <NotitieVeld
                                            notitie={getNotitie(notities, schooljaar, student.id, d.id)}
                                            onSave={() => {}}
                                            readonly
                                          />
                                        </div>
                                      </td>
                                    </tr>
                                    {deelUitgeklapt &&
                                      deel.map((dv) => {
                                        const dKleur = getDeelKleur(deelKleuren, dv.id, student.id);
                                        return (
                                          <tr key={dv.id} className="rapport-deel-rij">
                                            <td className="grid-col-doel grid-doel grid-doel-n2">
                                              <span className="grid-doel-tekst">{dv.titel}</span>
                                            </td>
                                            <td
                                              className="grid-cel"
                                              title={
                                                dKleur ? RATING_LABEL[dKleur] : RATING_EMPTY_LABEL
                                              }
                                            >
                                              <div
                                                className={`grid-cel-inhoud rating-${dKleur ?? "empty"}`}
                                              >
                                                <span
                                                  className={`rating-cell-btn rating-${dKleur ?? "empty"} is-readonly`}
                                                >
                                                  {dKleur ? RATING_KORT[dKleur] : "–"}
                                                </span>
                                                <NotitieVeld
                                                  notitie={getDeelNotitie(
                                                    deelNotities,
                                                    dv.id,
                                                    student.id,
                                                  )}
                                                  onSave={() => {}}
                                                  readonly
                                                />
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                  </Fragment>
                                );
                              })}
                          </tbody>
                        );
                      })}
                    </table>
                  </div>
                </aside>
              </div>

              {/* Buiten de split-layout (niet in `.sd-badges`): zo blijft dit veld altijd
                  bereikbaar, ook als het naslagpaneel rechts (bv. bij "alles uitklappen") veel
                  langer wordt dan de rapport-editor links. */}
              <label className="rapport-algemeen no-print">
                <span>Algemene opmerking</span>
                <AlgemeneOpmerkingVeld
                  key={gekozen.id}
                  opmerking={gekozen.algemeneOpmerking}
                  readonly={vergrendeld}
                  title={wijzigingLabel(rapportItemSleutel(gekozen.id, "algemeen")) ?? undefined}
                  onSave={(tekst) => zetRapportAlgemeneOpmerking(gekozen.id, tekst)}
                />
              </label>

              {/* Printweergave: enkel zichtbaar bij het afdrukken (zie @media print in index.css).
                  Statische, opgeruimde weergave — geen popovers/knoppen die toch niet printen. */}
              <div className="rapport-print">
                <h1>{gekozen.naam}</h1>
                <p className="rapport-print-meta">{rapportMetaTekst}</p>
                <table className="rapport-print-tabel">
                  <thead>
                    <tr>
                      <th>Cursus</th>
                      <th>Rubric</th>
                      <th>Kleur</th>
                      <th>Betekenis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printRijen.length === 0 ? (
                      <tr>
                        <td colSpan={4}>Nog geen enkele rubric ingevuld voor dit rapport.</td>
                      </tr>
                    ) : (
                      printRijen.map(({ cursus, r, item }) => (
                        <tr key={r.id}>
                          <td>{cursus.naam}</td>
                          <td>{r.naam}</td>
                          <td>
                            <span className={`rating rating-${item.kleur ?? "empty"}`}>
                              {item.kleur ? RATING_LABEL[item.kleur] : "—"}
                            </span>
                          </td>
                          {/* De rubric-tekst bij de gekozen kleur — enkel de 4 kleuren hebben er
                              een, een witte status (bv. vrijgesteld) niet. */}
                          <td className="rapport-print-betekenis">
                            {item.kleur && item.kleur in KLEUR_KEY
                              ? r.criteria[KLEUR_KEY[item.kleur as keyof typeof KLEUR_KEY]] || "—"
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {cursussen.some((c) => getRapportCursusOpmerking(gekozen, c.id)) && (
                  <div className="rapport-print-algemeen">
                    <h2>Opmerkingen per cursus</h2>
                    {cursussen
                      .filter((c) => getRapportCursusOpmerking(gekozen, c.id))
                      .map((c) => (
                        <p key={c.id}>
                          <strong>{c.naam}:</strong> {getRapportCursusOpmerking(gekozen, c.id)}
                        </p>
                      ))}
                  </div>
                )}
                {gekozen.algemeneOpmerking && (
                  <div className="rapport-print-algemeen">
                    <h2>Algemene opmerking</h2>
                    <p>{gekozen.algemeneOpmerking}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="lege-staat">
              Nog geen rapport voor {student.firstName}. Rapportmomenten maak je aan op{" "}
              <Link to="/rapport">de rapportenlijst</Link> — daar in één keer voor alle
              leerlingen van je filter, zodat iedereen dezelfde rapportmomenten heeft.
            </p>
          )}
        </>
      )}
    </section>
  );
}
