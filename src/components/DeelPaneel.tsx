import { useState } from "react";
import { BulkKnop } from "./BulkKnop";
import { DeelevaluatieEditor } from "./DeelevaluatieEditor";
import { Modal } from "./Modal";
import { NotitieVeld } from "./NotitieVeld";
import { RatingCell } from "./RatingCell";
import { alleLeerdoelen, cursusVanLeerdoel } from "../lib/curriculum";
import { deelevaluatiesVoorBadge, kapstokCursusVoorBadgeCursus } from "../lib/deelevaluaties";
import { useAangemeld } from "../lib/sessie";
import {
  getDeelKleur,
  getDeelNotitie,
  setDeelKleur,
  setDeelKleurBulk,
  useStore,
  zetDeelNotitie,
} from "../lib/store";
import { deelSleutel } from "../lib/types";
import type { Deelevaluatie, Student } from "../lib/types";
import {
  useDeelevaluatieWijzigingLabel,
  useGeschiedenis,
  useWijzigingLabel,
} from "../lib/wijzigingslog";

function PotloodIcoon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.5 2.5l3 3L6 13l-3.5.5L3 10z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Zijpaneel bij de badgematrix: de deelevaluaties die aan de gekozen badge gekoppeld zijn, als
 * mini-matrix (leerlingen als kolommen, bewerkbaar). Blijft bewust apart van de badge zelf —
 * een deelevaluatie is een tussenstap en kan aan meerdere badges hangen. De badge-kleur zet je
 * in de matrix links. Je kunt hier ook meteen een nieuwe deelevaluatie aanmaken, al voorzien
 * van deze badge als koppeling.
 */
export function DeelPaneel({
  leerdoelId,
  leerlingen,
  schooljaar,
  cursusFilter,
  vergrendeld,
  onSluit,
  scrollRef,
}: {
  leerdoelId: string;
  leerlingen: Student[];
  schooljaar: string;
  cursusFilter: string;
  vergrendeld: boolean;
  onSluit: () => void;
  /** Koppelt het scroll-kader aan de gesynchroniseerde horizontale scroll met de badgematrix. */
  scrollRef?: (el: HTMLDivElement | null) => void;
}) {
  const { deelevaluaties, deelKleuren, deelNotities } = useStore();
  const wijzigingLabel = useWijzigingLabel();
  const geschiedenis = useGeschiedenis();
  const deelWijzigingLabel = useDeelevaluatieWijzigingLabel();
  const aangemeld = useAangemeld();
  const mentorId = aangemeld?.rol === "mentor" ? aangemeld.mentor.id : undefined;
  // `null` = dicht; `{}` = nieuwe deelbadge; `{ bestaand }` = die deelbadge bewerken.
  const [editor, setEditor] = useState<{ bestaand?: Deelevaluatie } | null>(null);

  const doel = alleLeerdoelen().find((l) => l.id === leerdoelId);
  const cursus = cursusVanLeerdoel(leerdoelId);
  // Deelbadges zijn vestiging-gebonden: toon enkel die van de vestiging(en) van de zichtbare
  // leerlingen (+ overkoepelende). Zijn er meerdere vestigingen in beeld (bv. beheerder), dan
  // kiest de editor-overlay er zelf één (verplicht veld).
  const vestigingen = [...new Set(leerlingen.map((s) => s.vestiging))].filter(Boolean);
  const paneelVestiging = vestigingen.length === 1 ? vestigingen[0] : "";
  const rijen = deelevaluatiesVoorBadge(
    deelevaluaties,
    leerdoelId,
    schooljaar,
    cursusFilter,
  ).filter((d) => d.vestiging === "" || vestigingen.includes(d.vestiging));
  const alleIds = leerlingen.map((s) => s.id);

  return (
    <aside className="badges-deelpaneel">
      <div className="badges-deelpaneel-kop">
        <div>
          <span className="badges-deelpaneel-label">Deelbadges</span>
          <h2>{doel?.omschrijving ?? "Badge"}</h2>
          {cursus && <p className="badges-deelpaneel-cursus">{cursus.naam}</p>}
        </div>
        <button
          type="button"
          className="knop-icoon knop-icoon-klein"
          title="Paneel sluiten"
          aria-label="Deelbadge-paneel sluiten"
          onClick={onSluit}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {!vergrendeld && cursus && vestigingen.length > 0 && (
        <button
          type="button"
          className="knop-secundair badges-deelpaneel-nieuw"
          onClick={() => setEditor({})}
        >
          + Nieuwe deelbadge voor deze badge
        </button>
      )}

      {rijen.length === 0 ? (
        <p className="lege-staat">
          {cursusFilter
            ? `Geen deelbadges voor deze badge binnen "${cursusFilter}".`
            : "Nog geen deelbadges gekoppeld aan deze badge."}
        </p>
      ) : (
        <div className="grid-wrap" ref={scrollRef}>
          <table className="grid">
            <thead>
              <tr>
                <th className="grid-col-doel">Deelbadge</th>
                {leerlingen.map((s) => (
                  <th key={s.id} className="grid-col-leerling" title={`${s.firstName} ${s.lastName}`}>
                    {s.firstName}
                    <span className="grid-col-leerling-sub">
                      {s.lastName} · {s.leerjaar}e · {s.klasgroep}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rijen.map((d) => (
                <tr key={d.id}>
                  <td
                    className="grid-col-doel grid-doel grid-doel-n1"
                    title={deelWijzigingLabel(d) ?? undefined}
                  >
                    <div className="grid-doel-rij">
                      <span className="grid-deel-tekst">
                        <span className="grid-deel-titel">{d.titel}</span>
                        {(d.datum || d.cursus) && (
                          <span className="grid-deel-meta">
                            {[d.datum, d.cursus].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      <BulkKnop
                        aantal={leerlingen.length}
                        disabled={vergrendeld}
                        onKies={(kleur) => setDeelKleurBulk(d.id, alleIds, kleur)}
                      />
                      {!vergrendeld && (
                        <button
                          type="button"
                          className="knop-icoon knop-icoon-klein deelpaneel-bewerk-knop"
                          title="Deelbadge bewerken"
                          aria-label={`"${d.titel}" bewerken`}
                          onClick={() => setEditor({ bestaand: d })}
                        >
                          <PotloodIcoon />
                        </button>
                      )}
                    </div>
                  </td>
                  {leerlingen.map((s) => {
                    const kleur = getDeelKleur(deelKleuren, d.id, s.id);
                    const sleutel = deelSleutel(d.id, s.id);
                    const wLabel = wijzigingLabel(sleutel) ?? undefined;
                    const anderVestiging = d.vestiging !== "" && s.vestiging !== d.vestiging;
                    return (
                      <td
                        key={s.id}
                        className="grid-cel"
                        title={anderVestiging ? `Deelbadge van vestiging ${d.vestiging}` : wLabel}
                      >
                        <div className={`grid-cel-inhoud rating-${kleur ?? "empty"}`}>
                          <RatingCell
                            label={`${s.firstName} — ${d.titel}`}
                            readonly={vergrendeld || anderVestiging}
                            value={kleur}
                            geschiedenis={geschiedenis(sleutel)}
                            onChange={(next) => setDeelKleur(d.id, s.id, next)}
                          />
                          <NotitieVeld
                            notitie={getDeelNotitie(deelNotities, d.id, s.id)}
                            onSave={(patch) => zetDeelNotitie(d.id, s.id, patch)}
                            readonly={vergrendeld}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editor && cursus && (
        <Modal
          label={editor.bestaand ? "Deelbadge bewerken" : "Nieuwe deelbadge"}
          onClose={() => setEditor(null)}
        >
          <DeelevaluatieEditor
            stroom={editor.bestaand?.stroom ?? cursus.stroom}
            schooljaar={schooljaar}
            vestiging={paneelVestiging}
            vestigingOpties={vestigingen}
            mentorId={mentorId}
            bestaand={editor.bestaand}
            voorinvulling={
              editor.bestaand
                ? undefined
                : {
                    cursus: kapstokCursusVoorBadgeCursus(cursus.stroom, cursus.naam),
                    typeId: null,
                    leerdoelIds: [leerdoelId],
                  }
            }
            onSluit={() => setEditor(null)}
          />
        </Modal>
      )}
    </aside>
  );
}
