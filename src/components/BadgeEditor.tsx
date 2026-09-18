import { useState } from "react";
import type { BadgeRuw } from "../lib/curriculum";
import { SOORT_LABEL } from "../lib/minimumdoelen";
import { maakBadge, verwijderBadge, wijzigBadge } from "../lib/store";
import type { DoelCategorie } from "../lib/types";

const CATEGORIEEN: DoelCategorie[] = ["standaard", "basisgeletterdheid", "uitbreiding", "freinet"];

/**
 * Formulier om één echte badge (leerdoel) te maken of te bewerken — het beheerder-only
 * tegenhanger van `DeelevaluatieEditor` (die de deelbadges/toetsen van mentoren bewerkt). Schrijft
 * naar de curriculum-database-versie (`maakBadge`/`wijzigBadge`/`verwijderBadge` in `store.ts`),
 * dezelfde weg als "Zet de ingebouwde badges in de database". Zit altijd in een `<Modal>` — dus
 * `.de-editor` (geen eigen rand, zie `DeelevaluatieEditor`/`RubriekEditor`), niet `.doel-editor`
 * (die is voor de inline weergave op /doelen en zou een dubbele rand geven).
 */
export function BadgeEditor({
  cursusId,
  bestaand,
  onSluit,
}: {
  cursusId: string;
  bestaand?: BadgeRuw;
  onSluit: () => void;
}) {
  const [omschrijving, setOmschrijving] = useState(bestaand?.omschrijving ?? "");
  const [groep, setGroep] = useState(bestaand?.groep ?? "");
  const [categorie, setCategorie] = useState<DoelCategorie>(bestaand?.categorie ?? "standaard");

  const opslaan = () => {
    const veld = { omschrijving: omschrijving.trim(), groep: groep.trim(), categorie };
    if (bestaand) wijzigBadge(bestaand.id, veld);
    else maakBadge(cursusId, veld);
    onSluit();
  };

  return (
    <div className="de-editor">
      <h2>{bestaand ? "Badge bewerken" : "Nieuwe badge"}</h2>

      <label className="de-veld">
        <span>Omschrijving</span>
        <textarea
          rows={2}
          autoFocus
          value={omschrijving}
          onChange={(e) => setOmschrijving(e.target.value)}
        />
      </label>

      <label className="de-veld">
        <span>Badge-groep</span>
        <input
          value={groep}
          placeholder="bv. Leerwandelingen & uitstappen"
          onChange={(e) => setGroep(e.target.value)}
        />
      </label>
      <p className="de-type-hint">
        Badges met dezelfde groep binnen deze cursus vormen samen één deelbadge-type.
      </p>

      <label className="de-veld">
        <span>Categorie</span>
        <select value={categorie} onChange={(e) => setCategorie(e.target.value as DoelCategorie)}>
          {CATEGORIEEN.map((c) => (
            <option key={c} value={c}>
              {SOORT_LABEL[c]}
            </option>
          ))}
        </select>
      </label>

      <div className="de-editor-acties">
        <button
          type="button"
          className="knop-primair"
          onClick={opslaan}
          disabled={!omschrijving.trim() || !groep.trim()}
        >
          Opslaan
        </button>
        <button type="button" className="linkknop" onClick={onSluit}>
          Annuleren
        </button>
        {bestaand && (
          <button
            type="button"
            className="linkknop linkknop-gevaar de-editor-verwijder"
            onClick={() => {
              if (confirm(`Badge "${bestaand.omschrijving}" verwijderen?`)) {
                verwijderBadge(bestaand.id);
                onSluit();
              }
            }}
          >
            Badge verwijderen
          </button>
        )}
      </div>
    </div>
  );
}
