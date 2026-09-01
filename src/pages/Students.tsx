import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LeerlingFilterBar } from "../components/LeerlingFilterBar";
import { leerdoelen } from "../lib/curriculum";
import { alleGroepDefs, groepLeden } from "../lib/groepen";
import { GRAAD_LABEL, graadVan, filterLeerlingen, useLeerlingFilter } from "../lib/leerlingen";
import { ALGEMEEN } from "../lib/periode";
import { getDoelKleur, useStore } from "../lib/store";

export function Students() {
  const { students, kleuren, groepen, schooljaar } = useStore();
  const [filter, setFilter] = useLeerlingFilter();
  const totaal = leerdoelen.length;

  const groepDefs = useMemo(() => alleGroepDefs(students, groepen), [students, groepen]);
  const zichtbaar = useMemo(() => {
    const leden = groepLeden(filter.groepId, students, groepen);
    return filterLeerlingen(students, filter, leden);
  }, [students, groepen, filter]);

  return (
    <section>
      <h1>Leerlingen</h1>
      <p style={{ color: "var(--text-muted)" }}>
        "Ingevuld" telt de badges met een algemene kleur. Kleuren per rapport vul je in via{" "}
        <Link to="/badges">Badges</Link> of per leerling.
      </p>

      <LeerlingFilterBar
        alle={students}
        zichtbaar={zichtbaar.length}
        groepen={groepDefs}
        filter={filter}
        onChange={setFilter}
      />

      {zichtbaar.length === 0 ? (
        <p className="lege-staat">Geen leerlingen voor deze filter.</p>
      ) : (
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
                <th>Graad</th>
                <th>Jaar</th>
                <th>Groep</th>
                <th>Ingevuld</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zichtbaar.map((s) => {
                const ingevuld = leerdoelen.filter(
                  (d) => getDoelKleur(kleuren, schooljaar, ALGEMEEN, s.id, d.id) !== null,
                ).length;
                return (
                  <tr key={s.id}>
                    <td>
                      {s.firstName} {s.lastName}
                    </td>
                    <td>{s.vestiging}</td>
                    <td>{GRAAD_LABEL[graadVan(s.leerjaar)]}</td>
                    <td>{s.leerjaar}e</td>
                    <td>{s.klasgroep}</td>
                    <td>
                      {ingevuld} / {totaal}
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
      )}
    </section>
  );
}
