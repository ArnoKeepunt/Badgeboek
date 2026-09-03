import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BulkKnop } from "../components/BulkKnop";
import { DeelevaluatieEditor } from "../components/DeelevaluatieEditor";
import { LeerlingFilterBar } from "../components/LeerlingFilterBar";
import { Modal } from "../components/Modal";
import { RatingCell } from "../components/RatingCell";
import { leerdoelenVoorStroom } from "../lib/curriculum";
import {
  cursusNamenVoorStroom,
  deelevaluatiesVoor,
  typeById,
  typesVoorCursus,
} from "../lib/deelevaluaties";
import { alleGroepDefs, groepLeden } from "../lib/groepen";
import { filterLeerlingen, stroomVan, useLeerlingFilter } from "../lib/leerlingen";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "../lib/schooljaar";
import { useAangemeld } from "../lib/sessie";
import { getDeelKleur, setDeelKleur, setDeelKleurBulk, useStore } from "../lib/store";
import { STROMEN, STROOM_LABEL } from "../lib/types";
import type { Deelevaluatie, Stroom } from "../lib/types";

function PlusIcoon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 3v10M3 8h10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
 * Deelevaluaties: toetsen/opdrachten die een leerkracht zelf aanmaakt en aan badges koppelt.
 * Per stroom en cursus toont de kapstok wat verwacht wordt (verplicht aantal); daaronder maakt
 * de leerkracht concrete deelevaluaties aan en duidt per leerling een kleur aan. Dat keurt de
 * badge NIET automatisch goed — het is een tussenstap.
 *
 * Net als de badgematrix: de cursussen staan standaard toegeklapt (minder scrollen).
 */

const OPEN_KEY = "keerpunt-badgeboek:deelevaluaties-open";

function loadOpen(): string[] {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // geen opgeslagen stand
  }
  return [];
}
export function Deelevaluaties() {
  const { students, groepen, schooljaar, deelevaluaties, deelKleuren, matrixStromen } = useStore();
  const [filter, setFilter] = useLeerlingFilter();
  const aangemeld = useAangemeld();
  const mentorId = aangemeld?.rol === "mentor" ? aangemeld.mentor.id : undefined;

  const [stroom, setStroom] = useState<Stroom>(matrixStromen[0] ?? "1A");
  const [editor, setEditor] = useState<
    null | { bestaand?: Deelevaluatie; voorinvulling?: { cursus: string; typeId: string | null } }
  >(null);
  // We onthouden welke cursussen OPEN staan; standaard is dat geen enkele (alles toe).
  const [openCursussen, setOpenCursussen] = useState<string[]>(loadOpen);

  const vergrendeld = isAfgesloten(schooljaar);
  const archief = !vergrendeld && schooljaar !== HUIDIG_SCHOOLJAAR;

  const groepDefs = useMemo(() => alleGroepDefs(students, groepen), [students, groepen]);
  // De stroomkeuze bepaalt al de graad/klasgroep-as: die velden weglaten en negeren.
  const stroomLeerlingen = useMemo(
    () => students.filter((s) => stroomVan(s) === stroom),
    [students, stroom],
  );
  const zichtbaar = useMemo(() => {
    const leden = groepLeden(filter.groepId, students, groepen);
    return filterLeerlingen(stroomLeerlingen, { ...filter, graad: "", klasgroep: "" }, leden);
  }, [students, groepen, filter, stroomLeerlingen]);

  const badgeTekst = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of leerdoelenVoorStroom(stroom)) m.set(d.id, d.omschrijving);
    return m;
  }, [stroom]);

  const mijnDeelevaluaties = useMemo(
    () => deelevaluatiesVoor(deelevaluaties, stroom, schooljaar),
    [deelevaluaties, stroom, schooljaar],
  );

  const cursussen = useMemo(() => {
    const uit = cursusNamenVoorStroom(stroom);
    for (const d of mijnDeelevaluaties) if (!uit.includes(d.cursus)) uit.push(d.cursus);
    return uit;
  }, [stroom, mijnDeelevaluaties]);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(openCursussen));
    } catch {
      // opslag niet beschikbaar
    }
  }, [openCursussen]);

  const toggleCursus = (c: string) =>
    setOpenCursussen((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const allesOpen = () => setOpenCursussen(cursussen);
  const allesDicht = () => setOpenCursussen([]);

  return (
    <section>
      <div className="periode-balk">
        <span className="periode-balk-label">Stroom</span>
        {STROMEN.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip${s === stroom ? " is-active" : ""}`}
            onClick={() => setStroom(s)}
          >
            {STROOM_LABEL[s]}
          </button>
        ))}
      </div>

      {vergrendeld && (
        <p className="jaar-melding jaar-melding-slot">
          🔒 Schooljaar <strong>{schooljaar}</strong> is afgesloten. Deelevaluaties staan vast.
        </p>
      )}
      {archief && (
        <p className="jaar-melding">
          Je bekijkt schooljaar <strong>{schooljaar}</strong> (niet het lopende schooljaar).
        </p>
      )}

      <LeerlingFilterBar
        alle={stroomLeerlingen}
        zichtbaar={zichtbaar.length}
        groepen={groepDefs}
        filter={filter}
        onChange={setFilter}
        verbergVelden={["graad", "klasgroep"]}
      />

      <div className="matrix-acties">
        {!vergrendeld && (
          <button type="button" className="knop-primair" onClick={() => setEditor({})}>
            + Nieuwe deelevaluatie
          </button>
        )}
        {cursussen.length > 0 && (
          <>
            <button type="button" className="linkknop" onClick={allesOpen}>
              Alles uitklappen
            </button>
            <button type="button" className="linkknop" onClick={allesDicht}>
              Alles inklappen
            </button>
          </>
        )}
      </div>

      {editor && (
        <Modal
          label={editor.bestaand ? "Deelevaluatie bewerken" : "Nieuwe deelevaluatie"}
          onClose={() => setEditor(null)}
        >
          <DeelevaluatieEditor
            stroom={stroom}
            schooljaar={schooljaar}
            mentorId={mentorId}
            bestaand={editor.bestaand}
            voorinvulling={editor.voorinvulling}
            onSluit={() => setEditor(null)}
          />
        </Modal>
      )}

      {zichtbaar.length === 0 && (
        <p className="lege-staat">
          Geen leerlingen in {STROOM_LABEL[stroom]} voor deze filter. Kies een andere stroom of
          pas de filter aan.
        </p>
      )}

      {zichtbaar.length > 0 &&
        cursussen.map((cursus) => {
          const dicht = !openCursussen.includes(cursus);
          const types = typesVoorCursus(stroom, cursus);
          const rijen = mijnDeelevaluaties.filter((d) => d.cursus === cursus);
          const aantalPerType = new Map<string | null, number>();
          for (const d of rijen)
            aantalPerType.set(d.typeId, (aantalPerType.get(d.typeId) ?? 0) + 1);

          return (
            <div key={cursus} className="de-cursus">
              <button
                type="button"
                className="de-cursus-kop"
                onClick={() => toggleCursus(cursus)}
              >
                <span className="grid-caret">{dicht ? "▶" : "▼"}</span>
                <h2>{cursus}</h2>
                <span className="de-cursus-meta">
                  {rijen.length} {rijen.length === 1 ? "deelevaluatie" : "deelevaluaties"}
                  {types.length > 0 && ` · ${types.length} types`}
                </span>
              </button>

              {!dicht && (
                <>
                  {types.length > 0 && (
                    <div className="de-kapstok">
                      <table className="de-kapstok-tabel">
                        <thead>
                          <tr>
                            <th>Verwacht in deze cursus</th>
                            <th>Verplicht</th>
                            <th>Richtaantal</th>
                            <th>Aangemaakt</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {types.map((t) => (
                            <tr key={t.id}>
                              <td>{t.naam}</td>
                              <td className="de-num">{t.verplicht}</td>
                              <td className="de-num">{t.richtaantal}</td>
                              <td className="de-num">{aantalPerType.get(t.id) ?? 0}</td>
                              <td className="de-kapstok-actie">
                                {!vergrendeld && (
                                  <button
                                    type="button"
                                    className="knop-icoon knop-icoon-klein"
                                    title={`Toets toevoegen voor "${t.naam}"`}
                                    aria-label={`Toets toevoegen voor ${t.naam}`}
                                    onClick={() =>
                                      setEditor({ voorinvulling: { cursus, typeId: t.id } })
                                    }
                                  >
                                    <PlusIcoon />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {rijen.length === 0 ? (
                    <div className="de-leeg de-leeg-rij">
                      <span className="lege-staat">Nog geen deelevaluaties in deze cursus.</span>
                      {!vergrendeld && (
                        <button
                          type="button"
                          className="knop-icoon"
                          title="Nieuwe deelevaluatie in deze cursus"
                          aria-label="Nieuwe deelevaluatie in deze cursus"
                          onClick={() => setEditor({ voorinvulling: { cursus, typeId: null } })}
                        >
                          <PlusIcoon />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid-wrap">
                      <table className="grid">
                        <thead>
                          <tr>
                            <th className="grid-col-doel">Deelevaluatie</th>
                            {zichtbaar.map((s) => (
                              <th
                                key={s.id}
                                className="grid-col-leerling"
                                title={`${s.firstName} ${s.lastName}`}
                              >
                                <Link to={`/students/${s.id}`}>{s.firstName}</Link>
                                <span className="grid-col-leerling-sub">
                                  {s.lastName} · {s.leerjaar}e · {s.klasgroep}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rijen.map((d) => {
                            const type = typeById(d.typeId);
                            return (
                              <tr key={d.id}>
                                <td className="grid-col-doel grid-doel">
                                  <div className="de-rij-kop">
                                    <div className="de-rij-titel">
                                      <strong>{d.titel}</strong>
                                      {(d.datum || type) && (
                                        <span className="de-rij-meta">
                                          {[d.datum, type?.naam].filter(Boolean).join(" · ")}
                                        </span>
                                      )}
                                      {d.leerdoelIds.length > 0 && (
                                        <span className="de-rij-badges">
                                          {d.leerdoelIds.slice(0, 3).map((id) => (
                                            <span key={id} className="de-badge-chip" title={badgeTekst.get(id)}>
                                              {badgeTekst.get(id) ?? "badge"}
                                            </span>
                                          ))}
                                          {d.leerdoelIds.length > 3 && (
                                            <span className="de-badge-chip">
                                              +{d.leerdoelIds.length - 3}
                                            </span>
                                          )}
                                        </span>
                                      )}
                                    </div>
                                    {!vergrendeld && (
                                      <div className="de-rij-hoek">
                                        <BulkKnop
                                          aantal={zichtbaar.length}
                                          disabled={vergrendeld}
                                          onKies={(kleur) =>
                                            setDeelKleurBulk(
                                              d.id,
                                              zichtbaar.map((s) => s.id),
                                              kleur,
                                            )
                                          }
                                        />
                                        <button
                                          type="button"
                                          className="knop-icoon knop-icoon-klein"
                                          title="Deelevaluatie bewerken"
                                          aria-label={`"${d.titel}" bewerken`}
                                          onClick={() => setEditor({ bestaand: d })}
                                        >
                                          <PotloodIcoon />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                {zichtbaar.map((s) => (
                                  <td key={s.id} className="grid-cel">
                                    <RatingCell
                                      label={`${s.firstName} — ${d.titel}`}
                                      readonly={vergrendeld}
                                      value={getDeelKleur(deelKleuren, d.id, s.id)}
                                      onChange={(next) => setDeelKleur(d.id, s.id, next)}
                                    />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
    </section>
  );
}
