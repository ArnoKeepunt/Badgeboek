import { Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { ColorBar } from "../components/ColorBar";
import { RatingCell } from "../components/RatingCell";
import { telKleuren } from "../lib/kleurstats";
import {
  cursussen,
  leerdoelenVoorCursus,
  leerdoelenVoorRubric,
  rubricsVoorCursus,
} from "../lib/curriculum";
import { GRAAD_LABEL, graadVan } from "../lib/leerlingen";
import { ALGEMEEN, PERIODES } from "../lib/periode";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "../lib/schooljaar";
import { getDoelKleur, setDoelKleur, useStore } from "../lib/store";

export function StudentDetail() {
  const { studentId } = useParams();
  const { students, kleuren, schooljaar } = useStore();
  const student = students.find((s) => s.id === studentId);
  const vergrendeld = isAfgesloten(schooljaar);
  const archief = !vergrendeld && schooljaar !== HUIDIG_SCHOOLJAAR;

  if (!student) {
    return (
      <section>
        <h1>Leerling niet gevonden</h1>
        <Link to="/students">Terug naar leerlingen</Link>
      </section>
    );
  }

  return (
    <section>
      <Link to="/students">&larr; Leerlingen</Link>
      <h1>
        {student.firstName} {student.lastName}
      </h1>
      <p style={{ color: "var(--text-muted)" }}>
        {student.vestiging} · {GRAAD_LABEL[graadVan(student.leerjaar)]} · {student.leerjaar}e jaar
        · groep {student.klasgroep}
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

      <p style={{ color: "var(--text-muted)" }}>
        Per badge: een kleur per rapport (R1–R4) en een algemene kleur.
      </p>

      {cursussen.map((cursus) => {
        const cursusDoelen = leerdoelenVoorCursus(cursus.id);
        // De cursussamenvatting kijkt naar de algemene kleur.
        const telling = telKleuren(
          cursusDoelen.map((d) => getDoelKleur(kleuren, schooljaar, ALGEMEEN, student.id, d.id)),
        );
        return (
          <div key={cursus.id} style={{ marginTop: 28 }}>
            <div className="cursus-kop">
              <h2>{cursus.naam}</h2>
              <span className="cursus-kop-meta">
                {cursusDoelen.length - telling.leeg}/{cursusDoelen.length} algemeen ingevuld
              </span>
              <ColorBar telling={telling} />
            </div>

            <div className="grid-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th className="grid-col-doel">Badge</th>
                    {PERIODES.map((p) => (
                      <th key={p.id} className="grid-col-periode" title={p.label}>
                        {p.kort}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rubricsVoorCursus(cursus.id).map((rubric) => (
                    <Fragment key={rubric.id}>
                      <tr className="grid-group">
                        <th className="grid-col-doel" colSpan={PERIODES.length + 1}>
                          {rubric.naam}
                        </th>
                      </tr>
                      {leerdoelenVoorRubric(rubric.id).map((doel) => (
                        <tr key={doel.id}>
                          <td className="grid-col-doel grid-doel">{doel.omschrijving}</td>
                          {PERIODES.map((p) => (
                            <td key={p.id} className="grid-cel">
                              <RatingCell
                                label={`${doel.omschrijving} — ${p.label}`}
                                readonly={vergrendeld}
                                value={getDoelKleur(
                                  kleuren,
                                  schooljaar,
                                  p.id,
                                  student.id,
                                  doel.id,
                                )}
                                onChange={(next) =>
                                  setDoelKleur(schooljaar, p.id, student.id, doel.id, next)
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}
