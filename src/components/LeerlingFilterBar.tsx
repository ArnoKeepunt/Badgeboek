import {
  GRAAD_LABEL,
  graadVan,
  type LeerlingFilter,
  LEEG_FILTER,
  filterActief,
  unieke,
} from "../lib/leerlingen";
import { SOORT_LABEL, SYSTEEM_SOORTEN, type GroepDef, type GroepSoort } from "../lib/groepen";
import type { Student } from "../lib/types";

/**
 * Filterbalk voor leerlingen: een groepskeuze (eigen of standaard) + zoeken op naam en
 * keuzelijsten voor vestiging, graad, leerjaar en klasgroep. Opties komen uit de volledige lijst.
 */
export function LeerlingFilterBar({
  alle,
  zichtbaar,
  groepen,
  filter,
  onChange,
}: {
  alle: Student[];
  zichtbaar: number;
  groepen: GroepDef[];
  filter: LeerlingFilter;
  onChange: (next: LeerlingFilter) => void;
}) {
  const vestigingen = unieke(alle.map((s) => s.vestiging));
  const graden = unieke(alle.map((s) => graadVan(s.leerjaar)));
  const jaren = unieke(alle.map((s) => s.leerjaar));
  const klasgroepen = unieke(alle.map((s) => s.klasgroep));

  const zet = (veld: keyof LeerlingFilter, waarde: string) =>
    onChange({ ...filter, [veld]: waarde });

  const soortenMetGroepen: GroepSoort[] = ["eigen", ...SYSTEEM_SOORTEN];

  return (
    <div className="filterbar">
      <select
        className="filterbar-groep"
        value={filter.groepId}
        onChange={(e) => zet("groepId", e.target.value)}
      >
        <option value="">Alle leerlingen</option>
        {soortenMetGroepen.map((soort) => {
          const rijen = groepen.filter((g) => g.soort === soort);
          if (rijen.length === 0) return null;
          return (
            <optgroup key={soort} label={SOORT_LABEL[soort]}>
              {rijen.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.naam} ({g.leerlingIds.length})
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>

      <input
        type="search"
        className="filterbar-zoek"
        placeholder="Zoek op naam…"
        value={filter.zoek}
        onChange={(e) => zet("zoek", e.target.value)}
      />

      <select value={filter.vestiging} onChange={(e) => zet("vestiging", e.target.value)}>
        <option value="">Alle vestigingen</option>
        {vestigingen.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>

      <select value={filter.graad} onChange={(e) => zet("graad", e.target.value)}>
        <option value="">Alle graden</option>
        {graden.map((g) => (
          <option key={g} value={String(g)}>
            {GRAAD_LABEL[g] ?? `${g}e graad`}
          </option>
        ))}
      </select>

      <select value={filter.leerjaar} onChange={(e) => zet("leerjaar", e.target.value)}>
        <option value="">Alle leerjaren</option>
        {jaren.map((j) => (
          <option key={j} value={String(j)}>
            {j}e jaar
          </option>
        ))}
      </select>

      <select value={filter.klasgroep} onChange={(e) => zet("klasgroep", e.target.value)}>
        <option value="">Alle klasgroepen</option>
        {klasgroepen.map((k) => (
          <option key={k} value={k}>
            Groep {k}
          </option>
        ))}
      </select>

      <span className="filterbar-telling">
        {zichtbaar} / {alle.length} leerlingen
      </span>

      {filterActief(filter) && (
        <button type="button" className="linkknop" onClick={() => onChange(LEEG_FILTER)}>
          Wis filter
        </button>
      )}
    </div>
  );
}
