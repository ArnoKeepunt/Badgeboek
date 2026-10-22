import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LeerlingFilterBar } from "../components/LeerlingFilterBar";
import { Modal } from "../components/Modal";
import { RapportPrint } from "../components/RapportPrint";
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
import {
  maakRapportenBulk,
  rapportenVoorStudent,
  rondRapportenAfBulk,
  rubriekenLijst,
  useStore,
} from "../lib/store";
import type { Rapport as RapportDoc } from "../lib/types";

/**
 * Rapport: startpunt om een leerling te kiezen (zelfde leerlingenlijst als `/students`, maar
 * elke rij springt naar `/rapport/:studentId` i.p.v. het leerlingdetail). Het rapport zelf
 * (kleur + opmerking per cursus) vul je daar in, één leerling tegelijk. Bulkacties per
 * rapportmoment voor de leerlingen in de huidige filter (printen en afwerken) — enkel voor de beheerder.
 */
export function Rapport() {
  const { rapporten, groepen, schooljaar, rubriekenOverride, rubriekWijzigingen } = useStore();
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

  // Bulkacties: een rapportmoment kiezen (op naam), dan printen/afwerken voor de leerlingen
  // in de huidige paginafilter. Leeg = het meest recent aangemaakte rapportmoment.
  const [bulkMoment, setBulkMoment] = useState("");
  // Rapporten die nu (onzichtbaar) klaarstaan voor het printvenster; null = niet aan het printen.
  const [printLijst, setPrintLijst] = useState<RapportDoc[] | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  // Zelfde bron als RapportDetail/Rubrics: bundel + overrides uit de store.
  const alleRubrieken = useMemo(
    () => rubriekenLijst(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rubriekenOverride, rubriekWijzigingen],
  );

  const groepDefs = useMemo(() => alleGroepDefs(students, groepen), [students, groepen]);
  const zichtbaar = useMemo(() => {
    const leden = groepLeden(filter.groepId, students, groepen);
    return filterLeerlingen(students, filter, leden);
  }, [students, groepen, filter]);

  // Rapportmomenten van dit schooljaar bij de leerlingen in de filter, nieuwste eerst.
  const zichtbaarIds = useMemo(() => new Set(zichtbaar.map((s) => s.id)), [zichtbaar]);
  const momenten = useMemo(() => {
    const laatst = new Map<string, number>();
    for (const r of rapporten) {
      if (r.schooljaar !== schooljaar || !zichtbaarIds.has(r.studentId)) continue;
      laatst.set(r.naam, Math.max(laatst.get(r.naam) ?? 0, r.aangemaaktOp));
    }
    return [...laatst.entries()].sort((a, b) => b[1] - a[1]).map(([naam]) => naam);
  }, [rapporten, schooljaar, zichtbaarIds]);
  const gekozenMoment = momenten.includes(bulkMoment) ? bulkMoment : (momenten[0] ?? "");
  // In de volgorde van de leerlingenlijst, zodat de stapel geprinte rapporten daarmee overeenkomt.
  const momentRapporten = useMemo(() => {
    const perLeerling = new Map(
      rapporten
        .filter((r) => r.schooljaar === schooljaar && r.naam === gekozenMoment)
        .map((r) => [r.studentId, r]),
    );
    return zichtbaar.flatMap((s) => {
      const r = perLeerling.get(s.id);
      return r ? [r] : [];
    });
  }, [rapporten, schooljaar, gekozenMoment, zichtbaar]);
  const aantalConcept = momentRapporten.filter((r) => r.status === "concept").length;
  const zonderRapport = zichtbaar.length - momentRapporten.length;

  const bulkAfwerken = () => {
    if (aantalConcept === 0) return;
    if (
      !confirm(
        `"${gekozenMoment}" afwerken voor ${aantalConcept} leerling${aantalConcept === 1 ? "" : "en"}? ` +
          "Die rapporten staan dan vast; enkel een beheerder kan ze nog heropenen.",
      )
    ) {
      return;
    }
    const n = rondRapportenAfBulk(momentRapporten.map((r) => r.id));
    setBulkMelding(`"${gekozenMoment}" afgewerkt voor ${n} leerling${n === 1 ? "" : "en"}.`);
  };

  // Eerst de rapporten (onzichtbaar op het scherm) renderen, dan pas het printvenster openen —
  // zie het effect hieronder.
  const bulkPrinten = () => {
    if (magAanmaken && momentRapporten.length > 0) setPrintLijst(momentRapporten);
  };

  useEffect(() => {
    if (!printLijst) return;
    let geannuleerd = false;
    const vorigeTitel = document.title;
    // Het printvenster gebruikt `document.title` als voorgestelde pdf-bestandsnaam.
    const naam = `${printLijst[0]?.naam ?? "Rapporten"}-${schooljaar}`.replace(/[\\/:*?"<>|]/g, "");
    const klaar = () => {
      document.title = vorigeTitel;
      window.removeEventListener("afterprint", klaar);
      setPrintLijst(null);
    };
    // Wachten tot het logo in elk rapport geladen is, anders kan het op het blad ontbreken.
    const beelden = [...(printRef.current?.querySelectorAll("img") ?? [])];
    Promise.all(beelden.map((img) => img.decode().catch(() => undefined))).then(() => {
      if (geannuleerd) return;
      document.title = naam;
      window.addEventListener("afterprint", klaar);
      window.print();
    });
    return () => {
      geannuleerd = true;
      window.removeEventListener("afterprint", klaar);
      document.title = vorigeTitel;
    };
  }, [printLijst, schooljaar]);

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
      <div className="no-print">
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

        {magAanmaken && momenten.length > 0 && (
          <div className="rapport-bulk-paneel rapport-bulk-acties">
            <label className="rapport-toolbar-kies">
              <span>Rapportmoment</span>
              <select value={gekozenMoment} onChange={(e) => setBulkMoment(e.target.value)}>
                {momenten.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="knop-secundair"
              disabled={momentRapporten.length === 0 || printLijst !== null}
              title='Opent het printvenster — kies daar "Opslaan als pdf" voor één pdf met alle rapporten.'
              onClick={bulkPrinten}
            >
              Printen ({momentRapporten.length})
            </button>
            <button
              type="button"
              className="knop-secundair"
              disabled={aantalConcept === 0}
              onClick={bulkAfwerken}
            >
              Afwerken ({aantalConcept})
            </button>
            <span className="rapport-bulk-melding">
              Voor de {zichtbaar.length} leerling{zichtbaar.length === 1 ? "" : "en"} in de filter
              {momentRapporten.length > aantalConcept &&
                ` · ${momentRapporten.length - aantalConcept} al afgewerkt`}
              {zonderRapport > 0 && ` · ${zonderRapport} zonder dit rapport`}
            </span>
          </div>
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
      </div>

      {/* Bulkprinten: enkel gerenderd zolang het printvenster open is; elk rapport begint op
          een nieuwe pagina (zie `.rapport-print + .rapport-print` in index.css). */}
      {printLijst && (
        <div ref={printRef}>
          {printLijst.map((r) => {
            const student = students.find((s) => s.id === r.studentId);
            return student ? (
              <RapportPrint key={r.id} student={student} rapport={r} rubrieken={alleRubrieken} />
            ) : null;
          })}
        </div>
      )}
    </section>
  );
}
