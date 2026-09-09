import { useEffect, useMemo, useState } from "react";
import { SOORT_LABEL, alleGroepDefs } from "../lib/groepen";
import { GRAAD_LABEL, graadVan, unieke } from "../lib/leerlingen";
import { useBereik, useZichtbareLeerlingen } from "../lib/rechten";
import { maakGroep, useStore, verwijderGroep, wijzigGroep } from "../lib/store";
import type { Groep } from "../lib/types";

const SNEL_SOORTEN = [
  "eigen",
  "graad",
  "leerjaar",
  "vestiging",
  "klasgroep",
  "graad-vestiging",
  "leerjaar-vestiging",
] as const;

/**
 * Formulier om een groep te maken of te bewerken: een naam + een zelfgekozen verzameling
 * leerlingen. Twee manieren om leerlingen erbij te halen: een bestaande groep in één keer,
 * of filteren (vestiging/graad/jaar mag je combineren, bv. "2e graad + Oudenaarde") en dan
 * alle gefilterde leerlingen toevoegen.
 */
export function GroepEditor({
  groep,
  mentorId,
  onSluit,
  onGemaakt,
}: {
  groep?: Groep;
  /** Nieuwe groepen worden aan deze mentor gekoppeld (indien aangemeld als mentor). */
  mentorId?: string;
  onSluit: () => void;
  /** Bij het aanmaken van een nieuwe groep: de id ervan (bv. om 'm meteen te selecteren). */
  onGemaakt?: (id: string) => void;
}) {
  const { groepen } = useStore();
  const students = useZichtbareLeerlingen();
  const scopeVestiging = useBereik().vestiging;
  const [naam, setNaam] = useState(groep?.naam ?? "");
  const [zoek, setZoek] = useState("");
  const [vestiging, setVestiging] = useState("");
  const [graad, setGraad] = useState("");
  const [leerjaar, setLeerjaar] = useState("");
  const [gekozen, setGekozen] = useState<Set<string>>(
    () => new Set(groep?.leerlingIds ?? []),
  );
  const [melding, setMelding] = useState("");

  // De bevestiging na een batch verdwijnt vanzelf.
  useEffect(() => {
    if (!melding) return;
    const t = setTimeout(() => setMelding(""), 4000);
    return () => clearTimeout(t);
  }, [melding]);

  const vestigingen = useMemo(() => unieke(students.map((s) => s.vestiging)), [students]);
  const graden = useMemo(
    () => unieke(students.map((s) => graadVan(s.leerjaar))),
    [students],
  );
  const jaren = useMemo(() => unieke(students.map((s) => s.leerjaar)), [students]);

  // Graad en leerjaar mogen niet tegenstrijdig zijn, maar alle keuzes blijven bruikbaar.
  const kiesGraad = (waarde: string) => {
    setGraad(waarde);
    if (waarde && leerjaar && String(graadVan(Number(leerjaar))) !== waarde) setLeerjaar("");
  };
  const kiesLeerjaar = (waarde: string) => {
    setLeerjaar(waarde);
    if (waarde) setGraad(String(graadVan(Number(waarde))));
  };

  const filterActief = Boolean(zoek.trim() || vestiging || graad || leerjaar);
  const wisFilter = () => {
    setZoek("");
    setVestiging("");
    setGraad("");
    setLeerjaar("");
  };

  const groepDefs = useMemo(
    () => alleGroepDefs(students, groepen).filter((d) => d.leerlingIds.length > 0),
    [students, groepen],
  );

  // Leden die buiten het bereik van deze gebruiker vallen: niet te zien of te wijzigen, maar
  // ze blijven wél bij de groep horen.
  const zichtbareIds = useMemo(() => new Set(students.map((s) => s.id)), [students]);
  const verborgenLeden = [...gekozen].filter((id) => !zichtbareIds.has(id)).length;

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

  const toggle = (id: string) => {
    setMelding("");
    setGekozen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const voegToe = (ids: string[], wat: string) => {
    const nieuw = ids.filter((id) => !gekozen.has(id)).length;
    setGekozen((prev) => new Set([...prev, ...ids]));
    setMelding(
      nieuw > 0
        ? `${nieuw} leerling${nieuw === 1 ? "" : "en"} toegevoegd · ${wat}`
        : `${wat}: die zaten er al in`,
    );
  };
  const wisSelectie = () => {
    // Nooit leerlingen wissen die buiten het bereik vallen (die zie je niet, maar ze blijven
    // bij de groep horen).
    setGekozen((prev) => new Set([...prev].filter((id) => !zichtbareIds.has(id))));
    setMelding("");
  };

  const opslaan = () => {
    const ids = [...gekozen];
    const naamOk = naam.trim() || "Naamloze groep";
    if (groep) {
      wijzigGroep(groep.id, { naam: naamOk, leerlingIds: ids });
    } else {
      onGemaakt?.(maakGroep(naamOk, ids, mentorId));
    }
    onSluit();
  };

  return (
    <div className="groep-editor">
      <h2>{groep ? "Groep bewerken" : "Nieuwe groep"}</h2>

      <input
        className="groep-editor-naam"
        placeholder="Groepsnaam"
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
      />

      <div className="groep-editor-sectie">In één keer een bestaande groep toevoegen</div>
      <select
        className="groep-editor-breed"
        value=""
        onChange={(e) => {
          const def = groepDefs.find((d) => d.id === e.target.value);
          if (def) voegToe(def.leerlingIds, def.naam);
          e.target.value = "";
        }}
      >
        <option value="">Kies een bestaande groep…</option>
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

      <div className="groep-editor-sectie">
        Of filteren en toevoegen — je mag combineren (bv. 2e graad + Oudenaarde)
      </div>
      <div className="groep-editor-rij">
        <input
          type="search"
          placeholder="Zoek leerling…"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        {!scopeVestiging && (
          <select value={vestiging} onChange={(e) => setVestiging(e.target.value)}>
            <option value="">Alle vestigingen</option>
            {vestigingen.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
        <select value={graad} onChange={(e) => kiesGraad(e.target.value)}>
          <option value="">Alle graden</option>
          {graden.map((g) => (
            <option key={g} value={String(g)}>
              {GRAAD_LABEL[g] ?? `${g}e graad`}
            </option>
          ))}
        </select>
        <select value={leerjaar} onChange={(e) => kiesLeerjaar(e.target.value)}>
          <option value="">{graad ? "Alle jaren van deze graad" : "Alle jaren"}</option>
          {jaren.map((j) => (
            <option key={j} value={String(j)}>
              {j}e jaar
            </option>
          ))}
        </select>
        {filterActief && (
          <button type="button" className="linkknop" onClick={wisFilter}>
            Filter wissen
          </button>
        )}
      </div>

      <button
        type="button"
        className="groep-editor-voegtoe"
        onClick={() =>
          voegToe(
            zichtbaar.map((s) => s.id),
            filterActief ? "van deze filter" : "alle leerlingen",
          )
        }
        disabled={zichtbaar.length === 0}
      >
        + Alle {zichtbaar.length} {filterActief ? "gefilterde leerlingen" : "leerlingen"} toevoegen
      </button>

      <div className="groep-editor-samenvatting">
        <div className="groep-editor-samenvatting-kop">
          <span className="groep-editor-aantal">
            <strong>{gekozen.size}</strong> leerling{gekozen.size === 1 ? "" : "en"} in de groep
          </span>
          {gekozen.size > 0 && (
            <button type="button" className="linkknop" onClick={wisSelectie}>
              Alles wissen
            </button>
          )}
        </div>
        {scopeVestiging && verborgenLeden > 0 && (
          <p className="groep-editor-item-meta">
            Waarvan {verborgenLeden} uit een andere vestiging — die zie je hieronder niet, maar
            ze blijven bij de groep en worden niet gewist.
          </p>
        )}
        {melding && <p className="groep-editor-melding">✓ {melding}</p>}
      </div>

      <div className="groep-editor-lijst">
        {zichtbaar.map((s) => {
          const isGekozen = gekozen.has(s.id);
          return (
            <label
              key={s.id}
              className={`groep-editor-item${isGekozen ? " is-gekozen" : ""}`}
            >
              <input type="checkbox" checked={isGekozen} onChange={() => toggle(s.id)} />
              <span>
                {s.firstName} {s.lastName}
              </span>
              <span className="groep-editor-item-meta">
                {GRAAD_LABEL[graadVan(s.leerjaar)]} · {s.leerjaar}e · groep {s.klasgroep} ·{" "}
                {s.vestiging}
              </span>
            </label>
          );
        })}
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
          {groep ? "Opslaan" : "Groep aanmaken"} ({gekozen.size})
        </button>
        <button type="button" className="linkknop" onClick={onSluit}>
          Annuleren
        </button>
        {groep && (
          <button
            type="button"
            className="linkknop linkknop-gevaar de-editor-verwijder"
            onClick={() => {
              if (confirm(`Groep "${groep.naam}" verwijderen?`)) {
                verwijderGroep(groep.id);
                onSluit();
              }
            }}
          >
            Groep verwijderen
          </button>
        )}
      </div>
    </div>
  );
}
