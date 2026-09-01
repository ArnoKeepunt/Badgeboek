import { useMemo, useState } from "react";
import { GRAAD_LABEL, graadVan } from "../lib/leerlingen";
import { maakGroep, useStore, wijzigGroep } from "../lib/store";
import type { Groep } from "../lib/types";

/**
 * Formulier om een groep te maken of te bewerken: een naam + een zelfgekozen
 * verzameling leerlingen (met een zoekveld om de lijst te beperken).
 */
export function GroepEditor({
  groep,
  onSluit,
}: {
  groep?: Groep;
  onSluit: () => void;
}) {
  const { students } = useStore();
  const [naam, setNaam] = useState(groep?.naam ?? "");
  const [zoek, setZoek] = useState("");
  const [gekozen, setGekozen] = useState<Set<string>>(
    () => new Set(groep?.leerlingIds ?? []),
  );

  const zichtbaar = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return students.filter((s) =>
      q ? `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) : true,
    );
  }, [students, zoek]);

  const toggle = (id: string) =>
    setGekozen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const kiesZichtbare = () =>
    setGekozen((prev) => new Set([...prev, ...zichtbaar.map((s) => s.id)]));
  const wisSelectie = () => setGekozen(new Set());

  const opslaan = () => {
    const ids = [...gekozen];
    const naamOk = naam.trim() || "Naamloze groep";
    if (groep) wijzigGroep(groep.id, { naam: naamOk, leerlingIds: ids });
    else maakGroep(naamOk, ids);
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
        <input
          type="search"
          placeholder="Zoek leerling…"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
      </div>

      <div className="groep-editor-meta">
        <span>{gekozen.size} leerling(en) gekozen</span>
        <button type="button" className="linkknop" onClick={kiesZichtbare}>
          Alle zichtbare toevoegen
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
