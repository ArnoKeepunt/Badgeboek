import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GroepEditor } from "../components/GroepEditor";
import { LeerlingFilterBar } from "../components/LeerlingFilterBar";
import { Modal } from "../components/Modal";
import { PotloodIcoon, PrullenbakIcoon } from "../components/RijIcoontjes";
import { leerdoelenVoorStroom } from "../lib/curriculum";
import { alleGroepDefs, groepLeden } from "../lib/groepen";
import {
  GRAAD_LABEL,
  genereerLeerlingId,
  graadVan,
  filterLeerlingen,
  stroomVan,
  useLeerlingFilter,
} from "../lib/leerlingen";
import { bereikBeperkt, useBereik, useHuidigeActorId, useZichtbareLeerlingen } from "../lib/rechten";
import { useEffectieveRol } from "../lib/sessie";
import { getDoelKleur, upsertStudenten, useStore, verwijderLeerling } from "../lib/store";
import type { Student } from "../lib/types";
import { vestigingKeuzes } from "../lib/vestigingen";

const leegLeerling = (): Student => ({
  id: "",
  firstName: "",
  lastName: "",
  vestiging: "",
  leerjaar: 1,
  klasgroep: "A",
});

export function Students() {
  const { kleuren, groepen, schooljaar, students: alleStudenten } = useStore();
  const students = useZichtbareLeerlingen();
  const bereik = useBereik();
  const [filter, setFilter] = useLeerlingFilter();
  const navigate = useNavigate();
  const [nieuweGroep, setNieuweGroep] = useState(false);
  const actorId = useHuidigeActorId();
  const isBeheerder = useEffectieveRol() === "beheerder";

  const [bewerk, setBewerk] = useState<Student | null>(null);
  const [nieuw, setNieuw] = useState(false);
  const [melding, setMelding] = useState("");

  const groepDefs = useMemo(() => alleGroepDefs(students, groepen), [students, groepen]);
  const zichtbaar = useMemo(() => {
    const leden = groepLeden(filter.groepId, students, groepen);
    return filterLeerlingen(students, filter, leden);
  }, [students, groepen, filter]);

  const vestigingOpties = useMemo(
    () => vestigingKeuzes(alleStudenten.map((s) => s.vestiging)),
    [alleStudenten],
  );

  const bewaar = (s: Student) => {
    const firstName = s.firstName.trim();
    const lastName = s.lastName.trim();
    if (!firstName || !lastName) {
      setMelding("Vul voornaam en achternaam in.");
      return;
    }
    if (!s.vestiging) {
      setMelding("Kies een vestiging.");
      return;
    }
    if (!(s.leerjaar >= 1 && s.leerjaar <= 6)) {
      setMelding("Kies een leerjaar (1 t/m 6).");
      return;
    }
    const klasgroep = s.klasgroep.trim().toUpperCase();
    if (!klasgroep) {
      setMelding("Vul een klasgroep in.");
      return;
    }
    let id = s.id.trim();
    if (nieuw) {
      if (!id) {
        id = genereerLeerlingId(firstName, lastName, alleStudenten.map((x) => x.id));
      } else if (alleStudenten.some((x) => x.id === id)) {
        setMelding(`Id "${id}" bestaat al — kies een andere of laat het veld leeg.`);
        return;
      }
    }
    upsertStudenten([{ ...s, id, firstName, lastName, klasgroep }]);
    setMelding(`${firstName} ${lastName} opgeslagen.`);
    setBewerk(null);
    setNieuw(false);
  };

  const verwijder = (s: Student) => {
    if (
      !confirm(
        `${s.firstName} ${s.lastName} definitief verwijderen?\n\nEventuele evaluaties en rapporten van deze leerling blijven in de opslag staan, maar zijn nergens meer te zien.`,
      )
    )
      return;
    verwijderLeerling(s.id);
    setMelding(`${s.firstName} ${s.lastName} verwijderd.`);
  };

  return (
    <section>
      {nieuweGroep && (
        <Modal label="Nieuwe groep" onClose={() => setNieuweGroep(false)}>
          <GroepEditor
            mentorId={actorId}
            onGemaakt={(id) => setFilter({ ...filter, groepId: `eigen:${id}` })}
            onSluit={() => setNieuweGroep(false)}
          />
        </Modal>
      )}
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

      {melding && <div className="gegevens-melding is-ok">{melding}</div>}

      {isBeheerder && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            type="button"
            className="knop-primair"
            onClick={() => {
              setNieuw(true);
              setBewerk(leegLeerling());
            }}
          >
            + Leerling
          </button>
        </div>
      )}

      <LeerlingFilterBar
        alle={students}
        zichtbaar={zichtbaar.length}
        groepen={groepDefs}
        filter={filter}
        onChange={setFilter}
        onNieuweGroep={() => setNieuweGroep(true)}
      />

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
                <th>Ingevuld</th>
                {isBeheerder && <th>Acties</th>}
              </tr>
            </thead>
            <tbody>
              {zichtbaar.map((s) => {
                const doelen = leerdoelenVoorStroom(stroomVan(s, schooljaar));
                const ingevuld = doelen.filter(
                  (d) => getDoelKleur(kleuren, schooljaar, s.id, d.id) !== null,
                ).length;
                return (
                  <tr
                    key={s.id}
                    className="leerling-rij"
                    onClick={() => navigate(`/students/${s.id}`)}
                  >
                    <td>
                      <Link
                        to={`/students/${s.id}`}
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
                      {ingevuld} / {doelen.length}
                    </td>
                    {isBeheerder && (
                      <td>
                        <span
                          className="gebruikers-acties"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="knop-icoon knop-icoon-klein knop-icoon--plat"
                            title="Bewerken"
                            aria-label={`${s.firstName} ${s.lastName} bewerken`}
                            onClick={() => {
                              setNieuw(false);
                              setBewerk(s);
                            }}
                          >
                            <PotloodIcoon />
                          </button>
                          <button
                            type="button"
                            className="knop-icoon knop-icoon-klein knop-icoon--plat is-gevaar"
                            title="Verwijderen"
                            aria-label={`${s.firstName} ${s.lastName} verwijderen`}
                            onClick={() => verwijder(s)}
                          >
                            <PrullenbakIcoon />
                          </button>
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {bewerk && (
        <Modal
          label={nieuw ? "Nieuwe leerling" : `${bewerk.firstName} ${bewerk.lastName} bewerken`}
          onClose={() => {
            setBewerk(null);
            setNieuw(false);
          }}
        >
          <LeerlingForm
            waarde={bewerk}
            nieuw={nieuw}
            vestigingen={vestigingOpties}
            onBewaar={bewaar}
            onSluit={() => {
              setBewerk(null);
              setNieuw(false);
            }}
          />
        </Modal>
      )}
    </section>
  );
}

function LeerlingForm({
  waarde,
  nieuw,
  vestigingen,
  onBewaar,
  onSluit,
}: {
  waarde: Student;
  nieuw: boolean;
  vestigingen: string[];
  onBewaar: (s: Student) => void;
  onSluit: () => void;
}) {
  const [s, setS] = useState<Student>(waarde);

  return (
    <div className="gebruikers-form">
      <h3>{nieuw ? "Nieuwe leerling" : `${waarde.firstName} ${waarde.lastName} bewerken`}</h3>
      <label className="de-veld">
        <span>Voornaam</span>
        <input value={s.firstName} onChange={(e) => setS({ ...s, firstName: e.target.value })} />
      </label>
      <label className="de-veld">
        <span>Achternaam</span>
        <input value={s.lastName} onChange={(e) => setS({ ...s, lastName: e.target.value })} />
      </label>
      <label className="de-veld">
        <span>Id</span>
        <input
          value={s.id}
          disabled={!nieuw}
          placeholder="optioneel — anders afgeleid uit de naam"
          onChange={(e) => setS({ ...s, id: e.target.value })}
        />
      </label>
      <label className="de-veld">
        <span>Vestiging</span>
        <select value={s.vestiging} onChange={(e) => setS({ ...s, vestiging: e.target.value })}>
          <option value="">— kies een vestiging —</option>
          {vestigingen.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="de-veld">
        <span>Leerjaar</span>
        <select
          value={s.leerjaar}
          onChange={(e) => setS({ ...s, leerjaar: Number(e.target.value) })}
        >
          {[1, 2, 3, 4, 5, 6].map((j) => (
            <option key={j} value={j}>
              {j}e jaar
            </option>
          ))}
        </select>
      </label>
      <label className="de-veld">
        <span>Klasgroep</span>
        <input
          value={s.klasgroep}
          placeholder="bv. A"
          onChange={(e) => setS({ ...s, klasgroep: e.target.value })}
        />
      </label>
      <div className="gebruikers-form-acties">
        <button type="button" className="knop-primair" onClick={() => onBewaar(s)}>
          Opslaan
        </button>
        <button type="button" className="linkknop" onClick={onSluit}>
          Annuleren
        </button>
      </div>
    </div>
  );
}
