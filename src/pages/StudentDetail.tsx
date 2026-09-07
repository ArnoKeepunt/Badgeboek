import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { NotitieVeld } from "../components/NotitieVeld";
import { RatingCell } from "../components/RatingCell";
import {
  cursussenVoorStroom,
  leerdoelenVoorCursus,
  leerdoelenVoorRubric,
  leerdoelenVoorStroom,
  rubricsVoorCursus,
  subgroepenVoorRubric,
} from "../lib/curriculum";
import { deelevaluatiesVoor, typeById } from "../lib/deelevaluaties";
import { GRAAD_LABEL, graadVan, stroomVan } from "../lib/leerlingen";
import { magLeerlingZien } from "../lib/rechten";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "../lib/schooljaar";
import { useAangemeld } from "../lib/sessie";
import {
  getDeelKleur,
  getDeelNotitie,
  getDoelKleur,
  getNotitie,
  setDeelKleur,
  setDoelKleur,
  useStore,
  zetDeelNotitie,
  zetNotitie,
} from "../lib/store";
import { deelSleutel, doelSleutel } from "../lib/types";
import type { Leerdoel } from "../lib/types";
import {
  useDeelevaluatieWijzigingLabel,
  useGeschiedenis,
  useWijzigingLabel,
} from "../lib/wijzigingslog";

/**
 * Leerlingdetail: dezelfde badges als in de badgematrix (`Badges.tsx`), maar voor één leerling
 * met één kleurkolom en een notitieveld per badge. Cursussen, rubrics en subgroepen krijgen —
 * net als in de matrix — een eigen kleur (graadsbadge) en zijn in- en uitklapbaar. De koprij
 * en de eerste kolom blijven leesbaar staan bij het scrollen.
 */

const FOLD_KEY = "keerpunt-badgeboek:student-fold";

interface Fold {
  cursus: string[];
  rubric: string[];
  subgroep: string[];
}

function loadFold(): Fold {
  try {
    const raw = localStorage.getItem(FOLD_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Fold>;
      return { cursus: p.cursus ?? [], rubric: p.rubric ?? [], subgroep: p.subgroep ?? [] };
    }
  } catch {
    // geen opgeslagen stand — begin volledig uitgeklapt
  }
  return { cursus: [], rubric: [], subgroep: [] };
}

const zonder = (arr: string[], id: string) => arr.filter((x) => x !== id);
const met = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id]);
const subgroepSleutel = (rubricId: string, naam: string) => `${rubricId}|${naam}`;

export function StudentDetail() {
  const { studentId } = useParams();
  const { students, kleuren, notities, deelevaluaties, deelKleuren, deelNotities, schooljaar } =
    useStore();
  const [fold, setFold] = useState<Fold>(loadFold);
  // Aangeduide badge: de gekoppelde deelevaluaties lichten op in het paneel rechts.
  const [gekozenBadge, setGekozenBadge] = useState<string | null>(null);
  const wijzigingLabel = useWijzigingLabel();
  const geschiedenis = useGeschiedenis();
  const deelWijzigingLabel = useDeelevaluatieWijzigingLabel();
  const aangemeld = useAangemeld();
  const student = students.find((s) => s.id === studentId);
  const geenToegang = Boolean(student && !magLeerlingZien(aangemeld, student));
  const vergrendeld = isAfgesloten(schooljaar);
  const archief = !vergrendeld && schooljaar !== HUIDIG_SCHOOLJAAR;

  const navigate = useNavigate();
  const location = useLocation();
  // "Terug" gaat naar de vorige pagina (bv. de matrix), of naar de leerlingenlijst als er
  // geen geschiedenis is (rechtstreeks geopende link).
  const kanTerug = location.key !== "default";
  const terug = () => (kanTerug ? navigate(-1) : navigate("/students"));

  const mijnDeel = useMemo(
    () => (student ? deelevaluatiesVoor(deelevaluaties, stroomVan(student), schooljaar) : []),
    [deelevaluaties, student, schooljaar],
  );

  useEffect(() => {
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify(fold));
    } catch {
      // opslag niet beschikbaar — stand blijft enkel voor deze sessie
    }
  }, [fold]);

  // Bij het aanduiden van een badge: spring naar de eerste gekoppelde deelevaluatie in het
  // paneel, ook als die verderop staat dan wat nu in beeld is.
  useEffect(() => {
    if (!gekozenBadge) return;
    const eerste = mijnDeel.find((d) => d.leerdoelIds.includes(gekozenBadge));
    if (!eerste) return;
    document
      .getElementById(`sd-deel-${eerste.id}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [gekozenBadge, mijnDeel]);

  if (!student) {
    return (
      <section>
        <h1>Leerling niet gevonden</h1>
        <Link to="/students">Terug naar leerlingen</Link>
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
        <Link to="/students">Terug naar leerlingen</Link>
      </section>
    );
  }

  const stroom = stroomVan(student);
  const cursussen = cursussenVoorStroom(stroom);
  const badgeTekst = new Map(leerdoelenVoorStroom(stroom).map((d) => [d.id, d.omschrijving]));

  const toggleCursus = (id: string) =>
    setFold((f) => ({
      ...f,
      cursus: f.cursus.includes(id) ? zonder(f.cursus, id) : met(f.cursus, id),
    }));
  const toggleRubric = (id: string) =>
    setFold((f) => ({
      ...f,
      rubric: f.rubric.includes(id) ? zonder(f.rubric, id) : met(f.rubric, id),
    }));
  const toggleSubgroep = (key: string) =>
    setFold((f) => ({
      ...f,
      subgroep: f.subgroep.includes(key) ? zonder(f.subgroep, key) : met(f.subgroep, key),
    }));

  const allesDicht = () => {
    const cursusIds = cursussen.map((c) => c.id);
    const rubricIds = cursusIds.flatMap((id) => rubricsVoorCursus(id).map((r) => r.id));
    const subgroepKeys = rubricIds.flatMap((rid) =>
      subgroepenVoorRubric(rid)
        .filter((g) => g.naam)
        .map((g) => `${rid}|${g.naam}`),
    );
    setFold({ cursus: cursusIds, rubric: rubricIds, subgroep: subgroepKeys });
  };
  const allesOpen = () => setFold({ cursus: [], rubric: [], subgroep: [] });

  /** De ene kleurcel voor één node (badge, cursus, rubric of subgroep). */
  const kleurCel = (nodeId: string, naam: string) => {
    const kleur = getDoelKleur(kleuren, schooljaar, student.id, nodeId);
    const sleutel = doelSleutel(schooljaar, student.id, nodeId);
    const wLabel = wijzigingLabel(sleutel) ?? undefined;
    return (
      <td className="grid-cel" title={wLabel}>
        <div className={`grid-cel-inhoud rating-${kleur ?? "empty"}`}>
          <RatingCell
            label={naam}
            readonly={vergrendeld}
            value={kleur}
            geschiedenis={geschiedenis(sleutel)}
            onChange={(next) => setDoelKleur(schooljaar, student.id, nodeId, next)}
          />
          <NotitieVeld
            notitie={getNotitie(notities, schooljaar, student.id, nodeId)}
            onSave={(patch) => zetNotitie(schooljaar, student.id, nodeId, patch)}
            readonly={vergrendeld}
          />
        </div>
      </td>
    );
  };

  /** De eerste kolom van een cursus-/rubric-/subgroep-rij. */
  const nodeKop = (naam: string, aantal: number, dicht: boolean, onToggle: () => void) => (
    <th className="grid-col-doel">
      <button type="button" className="grid-toggle" onClick={onToggle}>
        <span className="grid-caret">{dicht ? "▶" : "▼"}</span>
        {naam}
        <span className="grid-count">{aantal}</span>
      </button>
    </th>
  );

  const doelRij = (doel: Leerdoel, niveau: 1 | 2 | 3) => {
    const aantalDeel = mijnDeel.filter((d) => d.leerdoelIds.includes(doel.id)).length;
    const gekozen = gekozenBadge === doel.id;
    return (
      <tr key={doel.id} className={gekozen ? "is-gekozen" : undefined}>
        <td className={`grid-col-doel grid-doel grid-doel-n${niveau}`}>
          <div className="grid-doel-rij">
            <span className="grid-doel-tekst">{doel.omschrijving}</span>
            {aantalDeel > 0 && (
              <button
                type="button"
                className={`grid-deel-chip${gekozen ? " is-actief" : ""}`}
                title={`${aantalDeel} gekoppelde deelbadge${aantalDeel === 1 ? "" : "s"} — duid aan om ze rechts te laten opvallen`}
                aria-pressed={gekozen}
                onClick={() => setGekozenBadge((cur) => (cur === doel.id ? null : doel.id))}
              >
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M5 2.5h6M4 4.5h8v9H4zM6.5 7.5h5M6.5 10h5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {aantalDeel}
              </button>
            )}
          </div>
        </td>
        {kleurCel(doel.id, doel.omschrijving)}
      </tr>
    );
  };

  return (
    <section>
      <div className="detail-terug">
        <button type="button" className="linkknop" onClick={terug}>
          &larr; Terug
        </button>
        <Link to="/students">Alle leerlingen</Link>
      </div>
      <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
        {student.vestiging} · {GRAAD_LABEL[graadVan(student.leerjaar)]} · {student.leerjaar}e jaar
        · groep {student.klasgroep} · badgeboek {stroom}
      </p>

      {vergrendeld && (
        <p className="jaar-melding jaar-melding-slot">
          🔒 Schooljaar <strong>{schooljaar}</strong> is afgesloten — de evaluaties staan vast.
        </p>
      )}
      {archief && (
        <p className="jaar-melding">
          Je bekijkt schooljaar <strong>{schooljaar}</strong> (niet het lopende schooljaar).
        </p>
      )}

      <div className="sd-split">
        <div className="sd-badges">
          <div className="matrix-acties">
            <button type="button" className="linkknop" onClick={allesOpen}>
              Alles uitklappen
            </button>
            <button type="button" className="linkknop" onClick={allesDicht}>
              Alles inklappen
            </button>
          </div>

          <div className="grid-wrap">
            <table className="grid grid--rustig">
              <thead>
                <tr>
                  <th className="grid-col-doel">Badge</th>
                  <th className="grid-col-kleur">Kleur</th>
                </tr>
              </thead>

              {cursussen.map((cursus) => {
                const cursusDicht = fold.cursus.includes(cursus.id);
                const cursusDoelen = leerdoelenVoorCursus(cursus.id);
                const cursusRubrics = rubricsVoorCursus(cursus.id);
                // Eén rubriek = overbodig tussenniveau: badges meteen onder de cursus.
                const enkeleRubriek = cursusRubrics.length === 1;
                return (
                  <tbody key={cursus.id}>
                    <tr className="grid-cursus">
                      {nodeKop(cursus.naam, cursusDoelen.length, cursusDicht, () =>
                        toggleCursus(cursus.id),
                      )}
                      {kleurCel(cursus.id, cursus.naam)}
                    </tr>

                    {!cursusDicht &&
                      cursusRubrics.map((rubric) => {
                        const rubricDicht = !enkeleRubriek && fold.rubric.includes(rubric.id);
                        const doelen = leerdoelenVoorRubric(rubric.id);
                        const subgroepen = subgroepenVoorRubric(rubric.id);
                        return (
                          <Fragment key={rubric.id}>
                            {!enkeleRubriek && (
                              <tr className="grid-group">
                                {nodeKop(rubric.naam, doelen.length, rubricDicht, () =>
                                  toggleRubric(rubric.id),
                                )}
                                {kleurCel(rubric.id, rubric.naam)}
                              </tr>
                            )}

                            {!rubricDicht &&
                              subgroepen.map((groep) => {
                                if (!groep.naam) {
                                  const losNiveau = enkeleRubriek ? 1 : 2;
                                  return (
                                    <Fragment key={`${rubric.id}|los`}>
                                      {groep.leerdoelen.map((d) => doelRij(d, losNiveau))}
                                    </Fragment>
                                  );
                                }
                                const sgKey = subgroepSleutel(rubric.id, groep.naam);
                                const sgDicht = fold.subgroep.includes(sgKey);
                                return (
                                  <Fragment key={sgKey}>
                                    <tr className="grid-group grid-subgroep">
                                      {nodeKop(groep.naam, groep.leerdoelen.length, sgDicht, () =>
                                        toggleSubgroep(sgKey),
                                      )}
                                      {kleurCel(sgKey, groep.naam)}
                                    </tr>
                                    {!sgDicht && groep.leerdoelen.map((d) => doelRij(d, 3))}
                                  </Fragment>
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
        </div>

        <aside className="badges-deelpaneel">
          <div className="badges-deelpaneel-kop">
            <div>
              <span className="badges-deelpaneel-label">Deelbadges</span>
              <h2>Alle deelbadges van {student.firstName}</h2>
            </div>
          </div>
          {mijnDeel.length === 0 ? (
            <p className="lege-staat">Nog geen deelbadges voor {student.firstName}.</p>
          ) : (
            <div className="grid-wrap">
              <table className="grid grid--rustig">
                <thead>
                  <tr>
                    <th className="grid-col-doel">Deelbadge</th>
                    <th className="sd-deel-badges-kop">Gekoppelde badges</th>
                    <th className="grid-col-kleur">Kleur</th>
                  </tr>
                </thead>
                <tbody>
                  {mijnDeel.map((d) => {
                    const type = typeById(d.typeId);
                    const kleur = getDeelKleur(deelKleuren, d.id, student.id);
                    const deelKleurSleutel = deelSleutel(d.id, student.id);
                    const wLabel = wijzigingLabel(deelKleurSleutel) ?? undefined;
                    const gekoppeld = gekozenBadge != null && d.leerdoelIds.includes(gekozenBadge);
                    const rijKlasse = gekozenBadge ? (gekoppeld ? "is-gekoppeld" : "is-gedimd") : undefined;
                    return (
                      <tr key={d.id} id={`sd-deel-${d.id}`} className={rijKlasse}>
                        <td
                          className="grid-col-doel grid-doel"
                          title={deelWijzigingLabel(d) ?? undefined}
                        >
                          <span className="grid-deel-tekst">
                            <span className="grid-deel-titel">{d.titel}</span>
                            {(d.datum || d.cursus || type) && (
                              <span className="grid-deel-meta">
                                {[d.datum, d.cursus, type?.naam].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="sd-deel-badges">
                          {d.leerdoelIds.length === 0 ? (
                            <span className="sd-deel-geen">—</span>
                          ) : (
                            d.leerdoelIds.map((id) => (
                              <span key={id} className="de-badge-chip" title={badgeTekst.get(id)}>
                                {badgeTekst.get(id) ?? "badge"}
                              </span>
                            ))
                          )}
                        </td>
                        <td className="grid-cel" title={wLabel}>
                          <div className={`grid-cel-inhoud rating-${kleur ?? "empty"}`}>
                            <RatingCell
                              label={`${student.firstName} — ${d.titel}`}
                              readonly={vergrendeld}
                              value={kleur}
                              geschiedenis={geschiedenis(deelKleurSleutel)}
                              onChange={(next) => setDeelKleur(d.id, student.id, next)}
                            />
                            <NotitieVeld
                              notitie={getDeelNotitie(deelNotities, d.id, student.id)}
                              onSave={(patch) => zetDeelNotitie(d.id, student.id, patch)}
                              readonly={vergrendeld}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
