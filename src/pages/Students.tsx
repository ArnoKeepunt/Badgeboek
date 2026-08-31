import { Link } from "react-router-dom";
import { leerdoelen } from "../lib/curriculum";
import { getDoelKleur, useStore } from "../lib/store";

export function Students() {
  const { students, kleuren } = useStore();
  const totaal = leerdoelen.length;

  return (
    <section>
      <h1>Leerlingen</h1>
      <p style={{ color: "var(--text-muted)" }}>
        "Op schema" telt de leerdoelen met een groene of blauwe kleur. Kleuren invullen doe je
        via <Link to="/doelen">Doelen</Link> of per leerling hieronder.
      </p>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        <table>
          <thead>
            <tr>
              <th>Naam</th>
              <th>Vestiging</th>
              <th>Jaar</th>
              <th>Op schema</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const opSchema = leerdoelen.filter((d) => {
                const k = getDoelKleur(kleuren, s.id, d.id);
                return k === "green" || k === "blue";
              }).length;
              return (
                <tr key={s.id}>
                  <td>
                    {s.firstName} {s.lastName}
                  </td>
                  <td>{s.vestiging}</td>
                  <td>{s.leerjaar}e</td>
                  <td>
                    {opSchema} / {totaal}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link to={`/students/${s.id}`}>Details</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
