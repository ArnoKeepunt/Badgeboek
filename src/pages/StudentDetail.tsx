import { Fragment, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { NotitieVeld } from "../components/NotitieVeld";
import { RatingCell } from "../components/RatingCell";
import {
  cursussenVoorStroom,
  leerdoelenVoorCursus,
  leerdoelenVoorRubric,
  rubricsVoorCursus,
  subgroepenVoorRubric,
} from "../lib/curriculum";
import { GRAAD_LABEL, graadVan, stroomVan } from "../lib/leerlingen";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "../lib/schooljaar";
import { getDoelKleur, getNotitie, setDoelKleur, useStore, zetNotitie } from "../lib/store";
import type { Leerdoel } from "../lib/types";

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
  const { students, kleuren, notities, schooljaar } = useStore();
  const [fold, setFold] = useState<Fold>(loadFold);
  const student = students.find((s) => s.id === studentId);
  const vergrendeld = isAfgesloten(schooljaar);
  const archief = !vergrendeld && schooljaar !== HUIDIG_SCHOOLJAAR;

  const navigate = useNavigate();
  const location = useLocation();
  // "Terug" gaat naar de vorige pagina (bv. de matrix), of naar de leerlingenlijst als er
  // geen geschiedenis is (rechtstreeks geopende link).
  const kanTerug = location.key !== "default";
  const terug = () => (kanTerug ? navigate(-1) : navigate("/students"));

  useEffect(() => {
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify(fold));
    } catch {
      // opslag niet beschikbaar — stand blijft enkel voor deze sessie
    }
  }, [fold]);

  if (!student) {
    return (
      <section>
        <h1>Leerling niet gevonden</h1>
        <Link to="/students">Terug naar leerlingen</Link>
      </section>
    );
  }

  const stroom = stroomVan(student);
  const cursussen = cursussenVoorStroom(stroom);

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
    return (
      <td className="grid-cel">
        <div className={`grid-cel-inhoud rating-${kleur ?? "empty"}`}>
          <RatingCell
            label={naam}
            readonly={vergrendeld}
            value={kleur}
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

  const doelRij = (doel: Leerdoel, niveau: 1 | 2 | 3) => (
    <tr key={doel.id}>
      <td className={`grid-col-doel grid-doel grid-doel-n${niveau}`}>
        <span className="grid-doel-tekst">{doel.omschrijving}</span>
      </td>
      {kleurCel(doel.id, doel.omschrijving)}
    </tr>
  );

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
    </section>
  );
}
