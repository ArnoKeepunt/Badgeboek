import { Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { RatingPicker } from "../components/RatingPicker";
import {
  cursussen,
  leerdoelenVoorRubric,
  rubricsVoorCursus,
} from "../lib/curriculum";
import { getDoelKleur, setDoelKleur, useStore } from "../lib/store";

export function StudentDetail() {
  const { studentId } = useParams();
  const { students, kleuren } = useStore();
  const student = students.find((s) => s.id === studentId);

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
        {student.vestiging} · {student.leerjaar}e jaar
      </p>

      {cursussen.map((cursus) => (
        <div key={cursus.id} style={{ marginTop: 24 }}>
          <h2>{cursus.naam}</h2>
          {rubricsVoorCursus(cursus.id).map((rubric) => (
            <Fragment key={rubric.id}>
              <h3 style={{ margin: "16px 0 4px", fontSize: 14, color: "var(--text-muted)" }}>
                {rubric.naam}
              </h3>
              {leerdoelenVoorRubric(rubric.id).map((doel) => (
                <div
                  key={doel.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ flex: "1 1 260px" }}>{doel.omschrijving}</span>
                  <RatingPicker
                    value={getDoelKleur(kleuren, student.id, doel.id)}
                    onChange={(next) => setDoelKleur(student.id, doel.id, next)}
                  />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      ))}
    </section>
  );
}
