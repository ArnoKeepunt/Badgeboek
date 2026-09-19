import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ColorBar } from "../components/ColorBar";
import { usePopover } from "../lib/popover";
import { RapportOpmerkingVeld } from "../components/RapportOpmerkingVeld";
import { RatingCell } from "../components/RatingCell";
import { cursussenVoorStroom, leerdoelenVoorCursus } from "../lib/curriculum";
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
import { useEffectieveRol } from "../lib/sessie";
import {
  getDoelKleur,
  getRapportItem,
  heropenRapport,
  rapportenVoorStudent,
  rondRapportAf,
  useStore,
  verwijderRapport,
  wijzigRapportItem,
  zetRapportAlgemeneOpmerking,
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
 * Rapport voor één leerling: links het rapport zelf (kleur + opmerking per **cursus**, volledig
 * handmatig), rechts een alleen-lezen naslagpaneel met alle badges van de leerling — zodat de
 * mentor bij het kiezen van een cursuskleur meteen de onderliggende badges kan bekijken, zonder
 * naar een andere pagina te moeten springen. Een rapport is per rapportmoment (bv. "Rapport 1")
 * en kan afgewerkt/vergrendeld worden; een `printweergave` (enkel zichtbaar bij het afdrukken)
 * maakt er een printbaar/pdf-baar document van via de browser (Ctrl/Cmd+P → "Opslaan als pdf").
 */
export function RapportDetail() {
  const { studentId } = useParams();
  const { students, groepen, kleuren, rapporten, schooljaar } = useStore();
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

              <span style={{ flex: 1 }} />

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
                <span style={{ flex: 1 }} />

                <div className="rapport-knopgroep">
                  <button
                    type="button"
                    className="knop-secundair rapport-icoonknop"
                    onClick={() => window.print()}
                  >
                    <PrinterIcoon />
                    Printen
                  </button>
                  <button
                    type="button"
                    className="knop-secundair rapport-icoonknop"
                    title="Opent het printvenster — kies daar 'Opslaan als pdf' als bestemming."
                    onClick={() => window.print()}
                  >
                    <PdfIcoon />
                    Opslaan als pdf
                  </button>
                </div>

                {(!vergrendeld || magHeropenen) && (
                  <div className="rapport-knopgroep">
                    {!vergrendeld && (
                      <button
                        type="button"
                        className="knop-secundair"
                        onClick={() => {
                          if (confirm(`Rapport "${gekozen.naam}" afwerken? Het staat dan vast.`)) {
                            rondRapportAf(gekozen.id);
                          }
                        }}
                      >
                        Rapport afwerken
                      </button>
                    )}
                    {vergrendeld && magHeropenen && (
                      <button
                        type="button"
                        className="knop-secundair"
                        onClick={() => heropenRapport(gekozen.id)}
                      >
                        Heropenen
                      </button>
                    )}
                  </div>
                )}

                {(!vergrendeld || magHeropenen) && (
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

                  <div className="grid-wrap">
                    <table className="grid grid--rustig">
                      <thead>
                        <tr>
                          <th className="grid-col-doel">Cursus</th>
                          <th className="grid-col-kleur">Kleur</th>
                          <th className="rapport-col-opmerking">Opmerking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cursussenGefilterd.map((cursus) => {
                          const item = getRapportItem(gekozen, cursus.id);
                          const sleutel = rapportItemSleutel(gekozen.id, cursus.id);
                          const wLabel = wijzigingLabel(sleutel) ?? undefined;
                          return (
                            <tr key={cursus.id}>
                              <td className="grid-col-doel grid-doel" style={{ fontWeight: 600 }}>
                                {cursus.naam}
                              </td>
                              <td className="grid-cel" title={wLabel}>
                                <div className={`grid-cel-inhoud rating-${item.kleur ?? "empty"}`}>
                                  <RatingCell
                                    label={`${cursus.naam} — rapportkleur`}
                                    readonly={vergrendeld}
                                    value={item.kleur}
                                    geschiedenis={geschiedenis(sleutel)}
                                    onChange={(next) =>
                                      wijzigRapportItem(gekozen.id, cursus.id, { kleur: next })
                                    }
                                  />
                                  <RapportOpmerkingVeld
                                    label={`Opmerking bij ${cursus.naam}`}
                                    opmerking={item.opmerking}
                                    readonly={vergrendeld}
                                    onSave={(tekst) =>
                                      wijzigRapportItem(gekozen.id, cursus.id, {
                                        opmerking: tekst,
                                      })
                                    }
                                  />
                                </div>
                              </td>
                              <td className="rapport-col-opmerking-tekst">
                                {item.opmerking || (
                                  <span className="sd-deel-geen">— geen opmerking —</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
                        // Filter je op één cursus, dan staat die sowieso open (zelfde gedrag als
                        // de cursusfilter op Badges/Deelevaluaties).
                        const cursusDicht = !gekozenCursusFilter && !fold.includes(cursus.id);
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
                                  <span className="grid-caret">{cursusDicht ? "▶" : "▼"}</span>
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
                            {!cursusDicht &&
                              cursusDoelen.map((d) => {
                                const kleur = getDoelKleur(kleuren, schooljaar, student.id, d.id);
                                return (
                                  <tr key={d.id}>
                                    <td className="grid-col-doel grid-doel grid-doel-n1">
                                      <span className="grid-doel-tekst">{d.omschrijving}</span>
                                    </td>
                                    <td
                                      className="grid-cel"
                                      title={kleur ? RATING_LABEL[kleur] : RATING_EMPTY_LABEL}
                                    >
                                      <span
                                        className={`rating-cell-btn rating-${kleur ?? "empty"} is-readonly`}
                                      >
                                        {kleur ? RATING_KORT[kleur] : "–"}
                                      </span>
                                    </td>
                                  </tr>
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
                <textarea
                  rows={4}
                  readOnly={vergrendeld}
                  defaultValue={gekozen.algemeneOpmerking}
                  title={wijzigingLabel(rapportItemSleutel(gekozen.id, "algemeen")) ?? undefined}
                  onBlur={(e) => zetRapportAlgemeneOpmerking(gekozen.id, e.target.value)}
                />
              </label>

              {/* Printweergave: enkel zichtbaar bij het afdrukken (zie @media print in index.css).
                  Statische, opgeruimde weergave — geen popovers/knoppen die toch niet printen. */}
              <div className="rapport-print">
                <h1>{gekozen.naam}</h1>
                <p className="rapport-print-meta">
                  {student.firstName} {student.lastName} · {student.vestiging} ·{" "}
                  {GRAAD_LABEL[graadDitJaar]} · {student.leerjaar}e jaar · groep {student.klasgroep}{" "}
                  · schooljaar {schooljaar}
                </p>
                <table className="rapport-print-tabel">
                  <thead>
                    <tr>
                      <th>Cursus</th>
                      <th>Kleur</th>
                      <th>Opmerking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cursussen.map((cursus) => {
                      const item = getRapportItem(gekozen, cursus.id);
                      return (
                        <tr key={cursus.id}>
                          <td>{cursus.naam}</td>
                          <td>
                            <span className={`rating rating-${item.kleur ?? "empty"}`}>
                              {item.kleur ? RATING_LABEL[item.kleur] : "—"}
                            </span>
                          </td>
                          <td>{item.opmerking}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
