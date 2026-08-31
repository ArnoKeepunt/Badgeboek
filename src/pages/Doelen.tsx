import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { RatingPicker } from "../components/RatingPicker";
import {
  cursussen,
  leerdoelenVoorRubric,
  rubricsVoorCursus,
} from "../lib/curriculum";
import { getDoelKleur, setDoelKleur, useStore } from "../lib/store";

/**
 * Doelenmatrix: per cursus krijgt elke leerling een kleur per leerdoel.
 * Rijen = leerdoelen (gegroepeerd per rubric), kolommen = leerlingen.
 */
export function Doelen() {
  const { students, kleuren } = useStore();
  const [cursusId, setCursusId] = useState(cursussen[0]?.id ?? "");
  const rubrieken = rubricsVoorCursus(cursusId);

  return (
    <section>
      <h1>Doelen</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Klik in een cel een kleur aan om die voor de leerling in te vullen. Klik de kleur
        opnieuw aan om terug op "niet aangeboden" te zetten. Aanpassingen worden lokaal bewaard.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        {cursussen.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip${c.id === cursusId ? " is-active" : ""}`}
            onClick={() => setCursusId(c.id)}
          >
            {c.naam}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="matrix">
          <thead>
            <tr>
              <th className="matrix-doel-kop">Leerdoel</th>
              {students.map((s) => (
                <th key={s.id} className="matrix-leerling-kop">
                  <Link to={`/students/${s.id}`}>{s.firstName}</Link>
                  <span className="matrix-leerling-sub">
                    {s.lastName} · {s.leerjaar}e jaar
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rubrieken.map((rubric) => {
              const doelen = leerdoelenVoorRubric(rubric.id);
              return (
                <Fragment key={rubric.id}>
                  <tr className="matrix-rubric-rij">
                    <th colSpan={students.length + 1}>{rubric.naam}</th>
                  </tr>
                  {doelen.map((doel) => (
                    <tr key={doel.id}>
                      <td className="matrix-doel">{doel.omschrijving}</td>
                      {students.map((s) => (
                        <td key={s.id} className="matrix-cel">
                          <RatingPicker
                            compact
                            value={getDoelKleur(kleuren, s.id, doel.id)}
                            onChange={(next) => setDoelKleur(s.id, doel.id, next)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
