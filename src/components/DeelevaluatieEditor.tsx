import { useMemo, useState } from "react";
import { cursusNamenVoorStroom, koppelbareBadges, typesVoorCursus } from "../lib/deelevaluaties";
import { maakDeelevaluatie, verwijderDeelevaluatie, wijzigDeelevaluatie } from "../lib/store";
import type { Deelevaluatie, Stroom } from "../lib/types";
import { useDeelevaluatieWijzigingLabel } from "../lib/wijzigingslog";

/**
 * Formulier om een deelevaluatie (toets/opdracht) aan te maken of te bewerken: een titel,
 * de cursus, optioneel een type uit de kapstok, een datum, en de badges die eraan gekoppeld
 * zijn. Het aanduiden van kleuren gebeurt daarna in de lijst.
 */
const TITEL_MAX = 50;
const TOELICHTING_MAX = 200;
export function DeelevaluatieEditor({
  stroom,
  schooljaar,
  vestiging,
  vestigingOpties,
  mentorId,
  bestaand,
  voorinvulling,
  onSluit,
}: {
  stroom: Stroom;
  schooljaar: string;
  /**
   * De vestiging waarvoor de deelbadge geldt. `""` = de gebruiker mag/moet er zelf één kiezen
   * (coördinator/beheerder). Een gewone mentor krijgt hier zijn eigen vestiging en ziet het veld
   * niet — het is dan al ingevuld.
   */
  vestiging: string;
  /** Alle vestigingen om uit te kiezen wanneer `vestiging === ""`. */
  vestigingOpties: string[];
  mentorId?: string;
  bestaand?: Deelevaluatie;
  voorinvulling?: { cursus: string; typeId: string | null; leerdoelIds?: string[] };
  onSluit: () => void;
}) {
  const cursussen = useMemo(() => cursusNamenVoorStroom(stroom), [stroom]);
  const deelWijzigingLabel = useDeelevaluatieWijzigingLabel();
  const wijzigingTekst = bestaand ? deelWijzigingLabel(bestaand) : null;

  const [titel, setTitel] = useState(bestaand?.titel ?? "");
  const [cursus, setCursus] = useState(
    bestaand?.cursus ?? voorinvulling?.cursus ?? cursussen[0] ?? "",
  );
  const [typeId, setTypeId] = useState<string | null>(
    bestaand?.typeId ?? voorinvulling?.typeId ?? null,
  );
  const [datum, setDatum] = useState(bestaand?.datum ?? "");
  const [toelichting, setToelichting] = useState(bestaand?.toelichting ?? "");
  // Vestiging: alleen-lezen voor een mentor (die zit op zijn eigen vestiging). Een coördinator/
  // beheerder kiest — ook bij het bewerken kan die de vestiging aanpassen of op "Alle
  // vestigingen" zetten.
  const ALLE_VESTIGINGEN = "__alle__";
  const vestigingVast = vestiging || null;
  const [vestigingKeuze, setVestigingKeuze] = useState(
    vestiging || (bestaand ? bestaand.vestiging || ALLE_VESTIGINGEN : ""),
  );
  const [leerdoelIds, setLeerdoelIds] = useState<Set<string>>(
    () => new Set(bestaand?.leerdoelIds ?? voorinvulling?.leerdoelIds ?? []),
  );

  const types = useMemo(() => typesVoorCursus(stroom, cursus), [stroom, cursus]);
  const badgeGroepen = useMemo(() => koppelbareBadges(stroom, cursus), [stroom, cursus]);
  const [openGroep, setOpenGroep] = useState<string | null>(
    () => badgeGroepen.find((g) => g.voorgesteld)?.cursusId ?? null,
  );

  const gekozenType = types.find((t) => t.id === typeId);

  const toggleDoel = (id: string) =>
    setLeerdoelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const kanBewaren = vestigingKeuze !== "";

  const bewaar = () => {
    if (!kanBewaren) return;
    const data: Omit<Deelevaluatie, "id"> = {
      schooljaar,
      stroom,
      vestiging: vestigingKeuze === ALLE_VESTIGINGEN ? "" : vestigingKeuze,
      cursus,
      typeId,
      titel: titel.trim() || gekozenType?.naam || "Naamloze deelbadge",
      datum,
      leerdoelIds: [...leerdoelIds],
      toelichting: toelichting.trim(),
      mentorId: bestaand?.mentorId ?? mentorId,
    };
    if (bestaand) wijzigDeelevaluatie(bestaand.id, data);
    else maakDeelevaluatie(data);
    onSluit();
  };

  return (
    <div className="de-editor">
      <h2>{bestaand ? "Deelbadge bewerken" : "Nieuwe deelbadge"}</h2>
      {vestigingVast ? (
        <p className="de-editor-vestiging">
          Vestiging: <strong>{vestigingVast}</strong>
        </p>
      ) : (
        <label className="de-veld">
          <span>Vestiging *</span>
          <select
            value={vestigingKeuze}
            onChange={(e) => setVestigingKeuze(e.target.value)}
          >
            <option value="">— kies een vestiging —</option>
            <option value={ALLE_VESTIGINGEN}>Alle vestigingen</option>
            {vestigingOpties.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
      {wijzigingTekst && <p className="de-editor-wijziging">{wijzigingTekst}</p>}

      <label className="de-veld">
        <span>
          Titel
          <span className="de-veld-tel">
            {titel.length}/{TITEL_MAX}
          </span>
        </span>
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          maxLength={TITEL_MAX}
          value={titel}
          placeholder={gekozenType?.naam ?? "bv. Toets breuken, Actuaronde verkiezingen…"}
          onChange={(e) => setTitel(e.target.value)}
        />
      </label>

      <div className="de-veld-rij">
        <label className="de-veld">
          <span>Cursus</span>
          <select
            value={cursus}
            onChange={(e) => {
              setCursus(e.target.value);
              setTypeId(null);
            }}
          >
            {cursussen.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="de-veld">
          <span>Type (optioneel)</span>
          <select value={typeId ?? ""} onChange={(e) => setTypeId(e.target.value || null)}>
            <option value="">Geen type</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.naam} ({t.richtaantal})
              </option>
            ))}
          </select>
        </label>

        <label className="de-veld de-veld-datum">
          <span>Datum</span>
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </label>
      </div>

      {gekozenType && (
        <p className="de-type-hint">
          {gekozenType.naam}: <strong>{gekozenType.richtaantal}</strong> badges in deze groep.
        </p>
      )}

      <p className="de-editor-info">
        Wil je verschillende cursussen apart als evaluatie beoordelen? Maak dan telkens een
        nieuwe deelbadge aan.
      </p>

      <div className="de-veld">
        <span>Gekoppelde badges · {leerdoelIds.size} gekozen</span>
        <div className="de-badges">
          {badgeGroepen.map((g) => {
            const open = openGroep === g.cursusId;
            const gekozenInGroep = g.leerdoelen.filter((d) => leerdoelIds.has(d.id)).length;
            return (
              <div key={g.cursusId} className="de-badge-groep">
                <button
                  type="button"
                  className="de-badge-groep-kop"
                  onClick={() => setOpenGroep(open ? null : g.cursusId)}
                >
                  <span className="grid-caret">{open ? "▾" : "▸"}</span>
                  {g.cursusNaam}
                  {g.voorgesteld && <span className="de-badge-tip">voorgesteld</span>}
                  <span className="grid-count">
                    {gekozenInGroep > 0 ? `${gekozenInGroep}/` : ""}
                    {g.leerdoelen.length}
                  </span>
                </button>
                {open && (
                  <div className="de-badge-lijst">
                    {g.leerdoelen.map((d) => (
                      <label key={d.id} className="de-badge-item">
                        <input
                          type="checkbox"
                          checked={leerdoelIds.has(d.id)}
                          onChange={() => toggleDoel(d.id)}
                        />
                        <span>{d.omschrijving}</span>
                      </label>
                    ))}
                    {g.leerdoelen.length === 0 && (
                      <p className="de-badge-leeg">Geen badges in deze cursus.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <label className="de-veld">
        <span>
          Toelichting (optioneel)
          <span className="de-veld-tel">
            {toelichting.length}/{TOELICHTING_MAX}
          </span>
        </span>
        <textarea
          rows={2}
          maxLength={TOELICHTING_MAX}
          value={toelichting}
          onChange={(e) => setToelichting(e.target.value)}
        />
      </label>

      <div className="de-editor-acties">
        <button
          type="button"
          className="knop-primair"
          onClick={bewaar}
          disabled={!kanBewaren}
          title={kanBewaren ? undefined : "Kies eerst een vestiging"}
        >
          {bestaand ? "Opslaan" : "Aanmaken"}
        </button>
        <button type="button" className="linkknop" onClick={onSluit}>
          Annuleren
        </button>
        {bestaand && (
          <button
            type="button"
            className="linkknop linkknop-gevaar de-editor-verwijder"
            onClick={() => {
              if (confirm(`Deelbadge "${bestaand.titel}" verwijderen?`)) {
                verwijderDeelevaluatie(bestaand.id);
                onSluit();
              }
            }}
          >
            Deelbadge verwijderen
          </button>
        )}
      </div>
    </div>
  );
}
