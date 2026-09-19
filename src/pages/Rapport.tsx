import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LeerlingFilterBar } from "../components/LeerlingFilterBar";
import { Modal } from "../components/Modal";
import { alleGroepDefs, groepLeden } from "../lib/groepen";
import {
  GRAAD_LABEL,
  graadVan,
  filterLeerlingen,
  LEEG_FILTER,
  useLeerlingFilter,
} from "../lib/leerlingen";
import type { LeerlingFilter } from "../lib/leerlingen";
import { bereikBeperkt, useBereik, useZichtbareLeerlingen } from "../lib/rechten";
import { useEffectieveRol } from "../lib/sessie";
import { maakRapportenBulk, rapportenVoorStudent, useStore } from "../lib/store";

/**
 * Rapport: startpunt om een leerling te kiezen (zelfde leerlingenlijst als `/students`, maar
 * elke rij springt naar `/rapport/:studentId` i.p.v. het leerlingdetail). Het rapport zelf
 * (kleur + opmerking per cursus) vul je daar in, één leerling tegelijk.
 */
export function Rapport() {
  const { rapporten, groepen, schooljaar } = useStore();
  const students = useZichtbareLeerlingen();
  const bereik = useBereik();
  const rol = useEffectieveRol();
  const magAanmaken = rol === "beheerder";
  const [filter, setFilter] = useLeerlingFilter();
  const navigate = useNavigate();
  const [bulkMelding, setBulkMelding] = useState<string | null>(null);

  // Nieuw-rapportmoment-overlay: bewust een EIGEN, losse filterstand (start van de huidige
  // paginafilter, maar volledig apart bewerkbaar) — zo bepaal je expliciet en zichtbaar voor
  // wie je aanmaakt, i.p.v. per ongeluk te vertrouwen op wat de paginafilter toevallig nog stond.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalNaam, setModalNaam] = useState("");
  const [modalFilter, setModalFilter] = useState<LeerlingFilter>(LEEG_FILTER);

  const groepDefs = useMemo(() => alleGroepDefs(students, groepen), [students, groepen]);
  const zichtbaar = useMemo(() => {
    const leden = groepLeden(filter.groepId, students, groepen);
    return filterLeerlingen(students, filter, leden);
  }, [students, groepen, filter]);

  const modalZichtbaar = useMemo(() => {
    const leden = groepLeden(modalFilter.groepId, students, groepen);
    return filterLeerlingen(students, modalFilter, leden);
  }, [students, groepen, modalFilter]);

  const modalVestigingen = useMemo(() => {
    const tellingen = new Map<string, number>();
    for (const s of modalZichtbaar) {
      tellingen.set(s.vestiging, (tellingen.get(s.vestiging) ?? 0) + 1);
    }
    return [...tellingen.entries()].sort((a, b) => a[0].localeCompare(b[0], "nl"));
  }, [modalZichtbaar]);

  const openModal = () => {
    setModalNaam("");
    setModalFilter(filter);
    setModalOpen(true);
  };

  const maakVoorIedereen = () => {
    const naam = modalNaam.trim() || "Rapport";
    if (modalZichtbaar.length === 0) return;
    if (
      !confirm(
        `Rapportmoment "${naam}" aanmaken voor ${modalZichtbaar.length} leerling${modalZichtbaar.length === 1 ? "" : "en"}? ` +
          "Leerlingen die al zo'n rapport hebben, worden overgeslagen.",
      )
    ) {
      return;
    }
    const nieuweIds = maakRapportenBulk(
      modalZichtbaar.map((s) => s.id),
      schooljaar,
      naam,
    );
    const overgeslagen = modalZichtbaar.length - nieuweIds.length;
    setBulkMelding(
      `"${naam}" aangemaakt voor ${nieuweIds.length} leerling${nieuweIds.length === 1 ? "" : "en"}` +
        (overgeslagen > 0 ? ` (${overgeslagen} overgeslagen — had die al).` : "."),
    );
    setModalOpen(false);
  };

  return (
    <section>
      <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 16 }}>
        Kies een leerling om een rapport in te vullen. Rapporten zijn volledig handmatig — geen
        automatische berekening uit de badges.
      </p>

      {bereikBeperkt(bereik) && (
        <p className="jaar-melding">
          Je ziet enkel de leerlingen van{" "}
          <strong>
            {bereik.vestigingen.length === 0
              ? "geen enkele vestiging"
              : `${bereik.vestigingen.length === 1 ? "vestiging" : "de vestigingen"} ${bereik.vestigingen.join(", ")}`}
          </strong>
          . Voor toegang tot andere vestigingen contacteer je een beheerder.
        </p>
      )}

      <LeerlingFilterBar
        alle={students}
        zichtbaar={zichtbaar.length}
        groepen={groepDefs}
        filter={filter}
        onChange={setFilter}
      />

      {magAanmaken ? (
        <div className="rapport-bulk-paneel">
          <button type="button" className="knop-secundair" onClick={openModal}>
            + Nieuw rapportmoment…
          </button>
          {bulkMelding && <span className="rapport-bulk-melding">{bulkMelding}</span>}
        </div>
      ) : (
        <p className="rapport-bulk-melding" style={{ marginBottom: 16 }}>
          Enkel een beheerder start een nieuw rapportmoment — zo krijgt iedereen dezelfde
          benaming. Bestaande rapporten vul je hieronder gewoon in.
        </p>
      )}

      {magAanmaken && modalOpen && (
        <Modal label="Nieuw rapportmoment aanmaken" onClose={() => setModalOpen(false)} groot>
          <h2 style={{ marginTop: 0 }}>Nieuw rapportmoment</h2>
          <p style={{ color: "var(--text-muted)", marginTop: -8 }}>
            Kies hieronder expliciet voor wie — dit staat los van de filter op de leerlingenlijst
            erachter, zodat je niet per ongeluk voor de verkeerde groep aanmaakt.
          </p>

          <label className="rapport-toolbar-kies" style={{ marginBottom: 16 }}>
            <span>Naam rapportmoment</span>
            <input
              type="text"
              placeholder='bv. "Rapport 1"'
              value={modalNaam}
              onChange={(e) => setModalNaam(e.target.value)}
              autoFocus
            />
          </label>

          <LeerlingFilterBar
            alle={students}
            zichtbaar={modalZichtbaar.length}
            groepen={groepDefs}
            filter={modalFilter}
            onChange={setModalFilter}
          />

          <p className="rapport-modal-samenvatting">
            Dit maakt <strong>"{modalNaam.trim() || "Rapport"}"</strong> aan voor{" "}
            <strong>
              {modalZichtbaar.length} leerling{modalZichtbaar.length === 1 ? "" : "en"}
            </strong>
            {modalVestigingen.length > 0 && (
              <>
                {" "}
                — {modalVestigingen.map(([v, n]) => `${v || "onbekende vestiging"} (${n})`).join(", ")}
              </>
            )}
            . Leerlingen die al zo'n rapport hebben, worden overgeslagen.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="linkknop" onClick={() => setModalOpen(false)}>
              Annuleren
            </button>
            <button
              type="button"
              className="knop-primair"
              disabled={modalZichtbaar.length === 0}
              onClick={maakVoorIedereen}
            >
              Aanmaken voor {modalZichtbaar.length} leerling{modalZichtbaar.length === 1 ? "" : "en"}
            </button>
          </div>
        </Modal>
      )}

      {zichtbaar.length === 0 ? (
        <p className="lege-staat">Geen leerlingen voor deze filter.</p>
      ) : (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
          }}
        >
          <table className="leerling-tabel">
            <thead>
              <tr>
                <th>Naam</th>
                <th>Vestiging</th>
                <th>Graad</th>
                <th>Jaar</th>
                <th>Groep</th>
                <th>Rapporten dit schooljaar</th>
              </tr>
            </thead>
            <tbody>
              {zichtbaar.map((s) => {
                const mijnRapporten = rapportenVoorStudent(rapporten, s.id, schooljaar);
                return (
                  <tr
                    key={s.id}
                    className="leerling-rij"
                    onClick={() => navigate(`/rapport/${s.id}`)}
                  >
                    <td>
                      <Link
                        to={`/rapport/${s.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="leerling-naam"
                      >
                        {s.firstName} {s.lastName}
                      </Link>
                    </td>
                    <td>{s.vestiging}</td>
                    <td>{GRAAD_LABEL[graadVan(s.leerjaar)]}</td>
                    <td>{s.leerjaar}e</td>
                    <td>{s.klasgroep}</td>
                    <td>
                      {mijnRapporten.length === 0
                        ? "—"
                        : `${mijnRapporten.length}${mijnRapporten.some((r) => r.status === "concept") ? " (concept)" : ""}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
