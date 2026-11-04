import { useEffect, useMemo, useState } from "react";
import { SOORT_LABEL, alleGroepDefs } from "../lib/groepen";
import { GRAAD_LABEL, graadVan, unieke } from "../lib/leerlingen";
import { useCollegas } from "../lib/collegas";
import {
  bereikBeperkt,
  useBereik,
  useHuidigeActorId,
  useZichtbareGroepen,
  useZichtbareLeerlingen,
} from "../lib/rechten";
import { maakGroep, verwijderGroep, wijzigGroep } from "../lib/store";
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
  const groepen = useZichtbareGroepen();
  const students = useZichtbareLeerlingen();
  const bereik = useBereik();
  const beperkt = bereikBeperkt(bereik);
  const actorId = useHuidigeActorId();
  const collegas = useCollegas();
  // De maker blijft altijd mentor van de groep; de mee-mentoren kies je hieronder zelf.
  const maker = groep ? groep.mentorId : mentorId;
  const [meeMentoren, setMeeMentoren] = useState<Set<string>>(
    () => new Set((groep?.mentorIds ?? []).filter((id) => id !== maker)),
  );
  const naamVan = (id: string) => collegas.find((c) => c.id === id)?.naam ?? id;
  // Kiesbaar: actieve collega's van (één van) je eigen vestiging(en) — wie alles ziet, kiest uit
  // iedereen. Wie al mee-mentor is, blijft altijd in de lijst staan (om te kunnen uitvinken).
  const kiesbareMentoren = useMemo(
    () =>
      collegas.filter(
        (c) =>
          c.id !== maker &&
          (meeMentoren.has(c.id) ||
            (c.actief &&
              (!beperkt || c.vestigingen.some((v) => bereik.vestigingen.includes(v))))),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collegas, maker, beperkt, bereik.vestigingen.join(","), meeMentoren],
  );
  // Voor de keuzelijst: wie nog geen mentor van de groep is.
  const toevoegbareMentoren = kiesbareMentoren.filter((c) => !meeMentoren.has(c.id));
  const vestigingenVan = (id: string) =>
    collegas.find((c) => c.id === id)?.vestigingen.join(", ") ?? "";
  const toggleMentor = (id: string) =>
    setMeeMentoren((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    const mentorIds = [...meeMentoren];
    if (groep) {
      wijzigGroep(groep.id, { naam: naamOk, leerlingIds: ids, mentorIds });
    } else {
      // Let op: `onGemaakt?.(maakGroep(...))` zou `maakGroep()` NOOIT aanroepen wanneer
      // `onGemaakt` niet is meegegeven — optional chaining (`a?.(x)`) evalueert het argument `x`
      // niet als `a` nullish is. Groepen.tsx geeft geen `onGemaakt` mee, dus daar zou een groep
      // aanmaken dan stilzwijgend niets doen. Vandaar de aanroep losgetrokken van de callback.
      const id = maakGroep(naamOk, ids, mentorId, mentorIds);
      onGemaakt?.(id);
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

      <div className="groep-editor-sectie">Mentoren van deze groep</div>
      <p className="groep-editor-item-meta">
        Wie je toevoegt, ziet deze groep bij "Mijn groepen" en kan ze mee bewerken — ook als ze
        privé is.
      </p>
      <ul className="groep-editor-mentorlijst">
        {maker && (
          <li>
            <span className="groep-editor-mentornaam">
              {maker === actorId ? `${naamVan(maker)} (jij)` : naamVan(maker)}
            </span>
            <span className="groep-editor-mentorrol">Maker</span>
          </li>
        )}
        {[...meeMentoren].map((id) => (
          <li key={id}>
            <span className="groep-editor-mentornaam">
              {id === actorId ? `${naamVan(id)} (jij)` : naamVan(id)}
            </span>
            <span className="groep-editor-mentorrol">{vestigingenVan(id)}</span>
            <button
              type="button"
              className="linkknop linkknop-gevaar"
              aria-label={`${naamVan(id)} als mentor verwijderen`}
              onClick={() => toggleMentor(id)}
            >
              Verwijderen
            </button>
          </li>
        ))}
        {!maker && meeMentoren.size === 0 && (
          <li className="groep-editor-mentorleeg">Nog geen mentoren gekozen.</li>
        )}
      </ul>
      {toevoegbareMentoren.length > 0 ? (
        <select
          className="groep-editor-breed"
          value=""
          aria-label="Mentor toevoegen"
          onChange={(e) => {
            if (e.target.value) toggleMentor(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="">+ Mentor toevoegen…</option>
          {toevoegbareMentoren.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id === actorId ? `${c.naam} (jij)` : c.naam}
              {c.vestigingen.length > 0 ? ` — ${c.vestigingen.join(", ")}` : ""}
            </option>
          ))}
        </select>
      ) : (
        <p className="groep-editor-item-meta">
          {kiesbareMentoren.length === 0
            ? "Geen collega's van je vestiging gevonden."
            : "Alle collega's van je vestiging zijn al mentor van deze groep."}
        </p>
      )}

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
        {(!beperkt || vestigingen.length > 1) && (
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
        {beperkt && verborgenLeden > 0 && (
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
          title={gekozen.size === 0 ? "Kies hierboven eerst minstens één leerling" : undefined}
        >
          {groep ? "Opslaan" : "Groep aanmaken"} ({gekozen.size})
        </button>
        <button type="button" className="linkknop" onClick={onSluit}>
          Annuleren
        </button>
        {gekozen.size === 0 && (
          <span className="groep-editor-item-meta">
            Kies hierboven eerst minstens één leerling.
          </span>
        )}
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
