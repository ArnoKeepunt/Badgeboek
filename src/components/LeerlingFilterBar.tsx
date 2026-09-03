import {
  GRAAD_LABEL,
  graadVan,
  type LeerlingFilter,
  LEEG_FILTER,
  unieke,
} from "../lib/leerlingen";
import { SOORT_LABEL, SYSTEEM_SOORTEN, type GroepDef, type GroepSoort } from "../lib/groepen";
import type { Student } from "../lib/types";

/**
 * Filterbalk voor leerlingen: een groepskeuze (eigen of standaard) + zoeken op naam en
 * keuzelijsten voor vestiging, graad, leerjaar en klasgroep. Opties komen uit `alle`.
 *
 * `verbergVelden` laat toe graad en/of klasgroep te verbergen op pagina's waar de stroomkeuze
 * die as al bepaalt (badgematrix, deelevaluaties) — zo is er geen dubbel systeem.
 */
export function LeerlingFilterBar({
  alle,
  zichtbaar,
  groepen,
  filter,
  onChange,
  verbergVelden = [],
}: {
  alle: Student[];
  zichtbaar: number;
  groepen: GroepDef[];
  filter: LeerlingFilter;
  onChange: (next: LeerlingFilter) => void;
  verbergVelden?: ("graad" | "klasgroep")[];
}) {
  const toon = (veld: "graad" | "klasgroep") => !verbergVelden.includes(veld);
  const vestigingen = unieke(alle.map((s) => s.vestiging));
  const graden = unieke(alle.map((s) => graadVan(s.leerjaar)));
  const jaren = unieke(alle.map((s) => s.leerjaar));
  const klasgroepen = unieke(alle.map((s) => s.klasgroep));

  const zet = (veld: keyof LeerlingFilter, waarde: string) =>
    onChange({ ...filter, [veld]: waarde });

  // Graad en leerjaar mogen niet tegenstrijdig zijn: een nieuwe graad wist een leerjaar dat
  // er niet bij past; een nieuw leerjaar zet de graad mee. Alle keuzes blijven bruikbaar.
  const zetGraad = (waarde: string) => {
    const next = { ...filter, graad: waarde };
    if (waarde && next.leerjaar && String(graadVan(Number(next.leerjaar))) !== waarde) {
      next.leerjaar = "";
    }
    onChange(next);
  };

  const zetLeerjaar = (waarde: string) => {
    const next = { ...filter, leerjaar: waarde };
    if (waarde) next.graad = String(graadVan(Number(waarde)));
    onChange(next);
  };

  const soortenMetGroepen: GroepSoort[] = ["eigen", ...SYSTEEM_SOORTEN];

  // "Wis filter" toont enkel wanneer een zichtbaar veld actief is.
  const heeftActieveFilter =
    Boolean(filter.zoek || filter.vestiging || filter.leerjaar || filter.groepId) ||
    (toon("graad") && Boolean(filter.graad)) ||
    (toon("klasgroep") && Boolean(filter.klasgroep));

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

      {toon("graad") && (
        <select value={filter.graad} onChange={(e) => zetGraad(e.target.value)}>
          <option value="">Alle graden</option>
          {graden.map((g) => (
            <option key={g} value={String(g)}>
              {GRAAD_LABEL[g] ?? `${g}e graad`}
            </option>
          ))}
        </select>
      )}

      <select value={filter.leerjaar} onChange={(e) => zetLeerjaar(e.target.value)}>
        <option value="">
          {filter.graad && toon("graad") ? "Alle jaren van deze graad" : "Alle leerjaren"}
        </option>
        {jaren.map((j) => (
          <option key={j} value={String(j)}>
            {j}e jaar
          </option>
        ))}
      </select>

      {toon("klasgroep") && (
        <select value={filter.klasgroep} onChange={(e) => zet("klasgroep", e.target.value)}>
          <option value="">Alle klasgroepen</option>
          {klasgroepen.map((k) => (
            <option key={k} value={k}>
              Groep {k}
            </option>
          ))}
        </select>
      )}

      <span className="filterbar-telling">
        {zichtbaar} / {alle.length} leerlingen
      </span>

      {heeftActieveFilter && (
        <button type="button" className="linkknop" onClick={() => onChange(LEEG_FILTER)}>
          Wis filter
        </button>
      )}
    </div>
  );
}
