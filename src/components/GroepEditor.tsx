import { useMemo, useState } from "react";
import { SOORT_LABEL, alleGroepDefs } from "../lib/groepen";
import { GRAAD_LABEL, graadVan, unieke } from "../lib/leerlingen";
import { maakGroep, useStore, wijzigGroep } from "../lib/store";
import type { Groep } from "../lib/types";

const SNEL_SOORTEN = ["eigen", "graad", "leerjaar", "vestiging", "klasgroep"] as const;

/**
 * Formulier om een groep te maken of te bewerken: een naam + een zelfgekozen verzameling
 * leerlingen. Je kan filteren op vestiging en jaar, en in één keer een bestaande groep
 * (bv. "3e jaar") toevoegen.
 */
export function GroepEditor({
  groep,
  mentorId,
  onSluit,
}: {
  groep?: Groep;
  /** Nieuwe groepen worden aan deze mentor gekoppeld (indien aangemeld als mentor). */
  mentorId?: string;
  onSluit: () => void;
}) {
  const { students, groepen } = useStore();
  const [naam, setNaam] = useState(groep?.naam ?? "");
  const [zoek, setZoek] = useState("");
  const [vestiging, setVestiging] = useState("");
  const [graad, setGraad] = useState("");
  const [leerjaar, setLeerjaar] = useState("");
  const [gekozen, setGekozen] = useState<Set<string>>(
    () => new Set(groep?.leerlingIds ?? []),
  );

  const vestigingen = useMemo(() => unieke(students.map((s) => s.vestiging)), [students]);
  const graden = useMemo(
    () => unieke(students.map((s) => graadVan(s.leerjaar))),
    [students],
  );
  const jaren = useMemo(() => unieke(students.map((s) => s.leerjaar)), [students]);
  const groepDefs = useMemo(
    () => alleGroepDefs(students, groepen).filter((d) => d.leerlingIds.length > 0),
    [students, groepen],
  );

  const zichtbaar = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return students.filter(
      (s) =>
        (!q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)) &&
        (!vestiging || s.vestiging === vestiging) &&
        (!graad || String(graadVan(s.leerjaar)) === graad) &&
        (!leerjaar || String(s.leerjaar) === leerjaar),
    );
  }, [students, zoek, vestiging, graad, leerjaar]);

  const toggle = (id: string) =>
    setGekozen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const voegToe = (ids: string[]) => setGekozen((prev) => new Set([...prev, ...ids]));
  const kiesZichtbare = () => voegToe(zichtbaar.map((s) => s.id));
  const wisSelectie = () => setGekozen(new Set());

  const opslaan = () => {
    const ids = [...gekozen];
    const naamOk = naam.trim() || "Naamloze groep";
    if (groep) wijzigGroep(groep.id, { naam: naamOk, leerlingIds: ids });
    else maakGroep(naamOk, ids, mentorId);
    onSluit();
  };

  return (
    <div className="groep-editor">
      <h2>{groep ? "Groep bewerken" : "Nieuwe groep"}</h2>

      <div className="groep-editor-rij">
        <input
          className="groep-editor-naam"
          placeholder="Groepsnaam"
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
        />
      </div>

      <div className="groep-editor-rij">
        <select
          value=""
          onChange={(e) => {
            const def = groepDefs.find((d) => d.id === e.target.value);
            if (def) voegToe(def.leerlingIds);
            e.target.value = "";
          }}
        >
          <option value="">+ Bestaande groep toevoegen…</option>
          {SNEL_SOORTEN.map((soort) => {
            const rijen = groepDefs.filter((d) => d.soort === soort);
            if (rijen.length === 0) return null;
            return (
              <optgroup key={soort} label={SOORT_LABEL[soort]}>
                {rijen.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.naam} ({d.leerlingIds.length})
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      <div className="groep-editor-rij">
        <input
          type="search"
          placeholder="Zoek leerling…"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <select value={vestiging} onChange={(e) => setVestiging(e.target.value)}>
          <option value="">Alle vestigingen</option>
          {vestigingen.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select value={graad} onChange={(e) => setGraad(e.target.value)}>
          <option value="">Alle graden</option>
          {graden.map((g) => (
            <option key={g} value={String(g)}>
              {GRAAD_LABEL[g] ?? `${g}e graad`}
            </option>
          ))}
        </select>
        <select value={leerjaar} onChange={(e) => setLeerjaar(e.target.value)}>
          <option value="">Alle jaren</option>
          {jaren.map((j) => (
            <option key={j} value={String(j)}>
              {j}e jaar
            </option>
          ))}
        </select>
      </div>

      <div className="groep-editor-meta">
        <span>{gekozen.size} leerling(en) gekozen</span>
        <button type="button" className="linkknop" onClick={kiesZichtbare}>
          Alle zichtbare toevoegen ({zichtbaar.length})
        </button>
        <button type="button" className="linkknop" onClick={wisSelectie}>
          Selectie wissen
        </button>
      </div>

      <div className="groep-editor-lijst">
        {zichtbaar.map((s) => (
          <label key={s.id} className="groep-editor-item">
            <input
              type="checkbox"
              checked={gekozen.has(s.id)}
              onChange={() => toggle(s.id)}
            />
            <span>
              {s.firstName} {s.lastName}
            </span>
            <span className="groep-editor-item-meta">
              {GRAAD_LABEL[graadVan(s.leerjaar)]} · {s.leerjaar}e · groep {s.klasgroep} ·{" "}
              {s.vestiging}
            </span>
          </label>
        ))}
        {zichtbaar.length === 0 && (
          <p className="groep-editor-item-meta" style={{ padding: 12 }}>
            Geen leerlingen voor deze filter.
          </p>
        )}
      </div>

      <div className="groep-editor-acties">
        <button
          type="button"
          className="knop-primair"
          onClick={opslaan}
          disabled={gekozen.size === 0}
        >
          Opslaan
        </button>
        <button type="button" className="linkknop" onClick={onSluit}>
          Annuleren
        </button>
      </div>
    </div>
  );
}
