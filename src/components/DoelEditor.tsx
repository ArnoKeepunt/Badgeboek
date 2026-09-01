import { useState } from "react";
import {
  type DoelSoort,
  type Minimumdoel,
  SOORT_LABEL,
  competentieKort,
} from "../lib/minimumdoelen";
import { wijzigDoel } from "../lib/store";

const SOORTEN: DoelSoort[] = ["standaard", "basisgeletterdheid", "uitbreiding", "freinet"];

/** Inline formulier om één minimumdoel te bewerken. Code, nummer en competentie liggen vast. */
export function DoelEditor({
  doel,
  onSluit,
}: {
  doel: Minimumdoel;
  onSluit: () => void;
}) {
  const [soort, setSoort] = useState<DoelSoort>(doel.soort);
  const [omschrijving, setOmschrijving] = useState(doel.omschrijving);
  const [uitleg, setUitleg] = useState(doel.uitleg);
  const [opmerking, setOpmerking] = useState(doel.opmerking ?? "");

  const opslaan = () => {
    wijzigDoel(doel.code, {
      soort,
      omschrijving: omschrijving.trim(),
      uitleg: uitleg.trim(),
      opmerking: opmerking.trim() || undefined,
    });
    onSluit();
  };

  return (
    <div className="doel-editor">
      <div className="doel-editor-meta">
        {doel.stroom} · {doel.nummer} · {doel.code} · {competentieKort(doel.competentie)}
      </div>

      <label className="doel-editor-veld">
        <span>Soort</span>
        <select value={soort} onChange={(e) => setSoort(e.target.value as DoelSoort)}>
          {SOORTEN.map((s) => (
            <option key={s} value={s}>
              {SOORT_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="doel-editor-veld">
        <span>Omschrijving</span>
        <textarea
          rows={2}
          value={omschrijving}
          onChange={(e) => setOmschrijving(e.target.value)}
        />
      </label>

      <label className="doel-editor-veld">
        <span>Verdere uitleg</span>
        <textarea rows={6} value={uitleg} onChange={(e) => setUitleg(e.target.value)} />
      </label>

      <label className="doel-editor-veld">
        <span>Opmerking</span>
        <textarea
          rows={2}
          value={opmerking}
          onChange={(e) => setOpmerking(e.target.value)}
        />
      </label>

      <div className="doel-editor-acties">
        <button type="button" className="knop-primair" onClick={opslaan}>
          Opslaan
        </button>
        <button type="button" className="linkknop" onClick={onSluit}>
          Annuleren
        </button>
      </div>
    </div>
  );
}
