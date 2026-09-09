import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LeerlingFilterBar } from "../components/LeerlingFilterBar";
import { leerdoelenVoorStroom } from "../lib/curriculum";
import { alleGroepDefs, groepLeden } from "../lib/groepen";
import {
  GRAAD_LABEL,
  graadVan,
  filterLeerlingen,
  stroomVan,
  useLeerlingFilter,
} from "../lib/leerlingen";
import { useBereik, useZichtbareLeerlingen } from "../lib/rechten";
import { getDoelKleur, useStore } from "../lib/store";

export function Students() {
  const { kleuren, groepen, schooljaar } = useStore();
  const students = useZichtbareLeerlingen();
  const scopeVestiging = useBereik().vestiging;
  const [filter, setFilter] = useLeerlingFilter();
  const navigate = useNavigate();

  const groepDefs = useMemo(() => alleGroepDefs(students, groepen), [students, groepen]);
  const zichtbaar = useMemo(() => {
    const leden = groepLeden(filter.groepId, students, groepen);
    return filterLeerlingen(students, filter, leden);
  }, [students, groepen, filter]);

  return (
    <section>
      {scopeVestiging && (
        <p className="jaar-melding">
          Je ziet enkel de leerlingen van vestiging <strong>{scopeVestiging}</strong>. Voor
          toegang tot andere vestigingen contacteer je een beheerder.
        </p>
      )}

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
          <table className="leerling-tabel">
            <thead>
              <tr>
                <th>Naam</th>
                <th>Vestiging</th>
                <th>Graad</th>
                <th>Jaar</th>
                <th>Groep</th>
                <th>Ingevuld</th>
              </tr>
            </thead>
            <tbody>
              {zichtbaar.map((s) => {
                const doelen = leerdoelenVoorStroom(stroomVan(s, schooljaar));
                const ingevuld = doelen.filter(
                  (d) => getDoelKleur(kleuren, schooljaar, s.id, d.id) !== null,
                ).length;
                return (
                  <tr
                    key={s.id}
                    className="leerling-rij"
                    onClick={() => navigate(`/students/${s.id}`)}
                  >
                    <td>
                      <Link
                        to={`/students/${s.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="leerling-naam"
                      >
                        {s.firstName} {s.lastName}
                      </Link>
                    </td>
                    <td>{s.vestiging}</td>
                    <td>{GRAAD_LABEL[graadVan(s.leerjaar)]}</td>
                    <td>{s.leerjaar}e</td>
                    <td>{s.klasgroep}</td>
                    <td>
                      {ingevuld} / {doelen.length}
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
