import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BulkKnop } from "../components/BulkKnop";
import { DeelevaluatieEditor } from "../components/DeelevaluatieEditor";
import { LeerlingFilterBar } from "../components/LeerlingFilterBar";
import { Modal } from "../components/Modal";
import { NotitieVeld } from "../components/NotitieVeld";
import { RatingCell } from "../components/RatingCell";
import { StroomBalk } from "../components/StroomBalk";
import { leerdoelenVoorStroom } from "../lib/curriculum";
import {
  cursusNamenVoorStroom,
  deelevaluatiesVoor,
  typeById,
  typesVoorCursus,
} from "../lib/deelevaluaties";
import { alleGroepDefs, groepLeden, stromenVanGroep } from "../lib/groepen";
import { filterLeerlingen, stroomVan, useLeerlingFilter } from "../lib/leerlingen";
import type { LeerlingFilter } from "../lib/leerlingen";
import { useZichtbareLeerlingen } from "../lib/rechten";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "../lib/schooljaar";
import { useAangemeld } from "../lib/sessie";
import {
  getDeelKleur,
  getDeelNotitie,
  setDeelKleur,
  setDeelKleurBulk,
  setMatrixCursus,
  setMatrixStromen,
  useStore,
  zetDeelNotitie,
} from "../lib/store";
import { STROOM_LABEL, deelSleutel } from "../lib/types";
import type { DeelKleuren, DeelNotities, Deelevaluatie, Stroom, Student } from "../lib/types";
import {
  useDeelevaluatieWijzigingLabel,
  useGeschiedenis,
  useWijzigingLabel,
} from "../lib/wijzigingslog";

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
 * Bovenaan de gedeelde stroom+cursus-balk (meerdere graden aanduidbaar, filter op cursus).
 * Per stroom en cursus toont de kapstok wat verwacht wordt; daaronder maakt de leerkracht
 * concrete deelevaluaties aan en duidt per leerling een kleur aan. Dat keurt de badge NIET
 * automatisch goed — het is een tussenstap. Cursussen staan standaard toegeklapt.
 */

const OPEN_KEY = "keerpunt-badgeboek:deelevaluaties-open:v2";

function loadOpen(): string[] {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // geen opgeslagen stand
  }
  return [];
}

type EditorState = {
  stroom: Stroom;
  bestaand?: Deelevaluatie;
  voorinvulling?: { cursus: string; typeId: string | null };
};

export function Deelevaluaties() {
  const {
    groepen,
    schooljaar,
    deelevaluaties,
    deelKleuren,
    deelNotities,
    matrixStromen,
    matrixCursus,
  } = useStore();
  const students = useZichtbareLeerlingen();
  const [filter, setFilter] = useLeerlingFilter();
  const aangemeld = useAangemeld();
  const mentorId = aangemeld?.rol === "mentor" ? aangemeld.mentor.id : undefined;

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [openSecties, setOpenSecties] = useState<string[]>(loadOpen);

  const vergrendeld = isAfgesloten(schooljaar);
  const archief = !vergrendeld && schooljaar !== HUIDIG_SCHOOLJAAR;
  const meerdereStromen = matrixStromen.length > 1;

  const groepDefs = useMemo(() => alleGroepDefs(students, groepen), [students, groepen]);

  // Kies je een groep in de filterbalk, dan schuift de stroomkeuze automatisch mee naar de
  // stromen van díé groep — anders kun je "1e graad" aanduiden en toch een groep uit het
  // 3e jaar kiezen, waarna de matrix niemand toont.
  const onFilterChange = (next: LeerlingFilter) => {
    setFilter(next);
    if (next.groepId && next.groepId !== filter.groepId) {
      const stromen = stromenVanGroep(next.groepId, students, groepen);
      if (stromen.length > 0) setMatrixStromen(stromen);
    }
  };

  // De stroomkeuze bepaalt al de graad/klasgroep-as: die velden weglaten en negeren.
  const stroomLeerlingen = useMemo(
    () => students.filter((s) => matrixStromen.includes(stroomVan(s))),
    [students, matrixStromen],
  );
  const zichtbaar = useMemo(() => {
    const leden = groepLeden(filter.groepId, students, groepen);
    return filterLeerlingen(stroomLeerlingen, { ...filter, graad: "", klasgroep: "" }, leden);
  }, [students, groepen, filter, stroomLeerlingen]);

  const cursusOpties = useMemo(() => {
    const uit: string[] = [];
    for (const stroom of matrixStromen) {
      for (const c of cursusNamenVoorStroom(stroom)) if (!uit.includes(c)) uit.push(c);
      for (const d of deelevaluatiesVoor(deelevaluaties, stroom, schooljaar)) {
        if (!uit.includes(d.cursus)) uit.push(d.cursus);
      }
    }
    return uit;
  }, [matrixStromen, deelevaluaties, schooljaar]);
  const cursusFilter = cursusOpties.includes(matrixCursus) ? matrixCursus : "";

  const perStroom = useMemo(
    () =>
      matrixStromen.map((stroom) => {
        const leerlingen = zichtbaar.filter((s) => stroomVan(s) === stroom);
        const mijn = deelevaluatiesVoor(deelevaluaties, stroom, schooljaar);
        let cursussen = cursusNamenVoorStroom(stroom);
        for (const d of mijn) if (!cursussen.includes(d.cursus)) cursussen.push(d.cursus);
        if (cursusFilter) cursussen = cursussen.filter((c) => c === cursusFilter);
        const badgeTekst = new Map<string, string>();
        for (const d of leerdoelenVoorStroom(stroom)) badgeTekst.set(d.id, d.omschrijving);
        return { stroom, leerlingen, mijn, cursussen, badgeTekst };
      }),
    [matrixStromen, zichtbaar, deelevaluaties, schooljaar, cursusFilter],
  );

  const alleSectieKeys = useMemo(
    () => perStroom.flatMap(({ stroom, cursussen }) => cursussen.map((c) => `${stroom}|${c}`)),
    [perStroom],
  );

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(openSecties));
    } catch {
      // opslag niet beschikbaar
    }
  }, [openSecties]);

  const toggleSectie = (k: string) =>
    setOpenSecties((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const allesOpen = () => setOpenSecties(alleSectieKeys);
  const allesDicht = () => setOpenSecties([]);

  return (
    <section>
      <StroomBalk hint="meerdere mogelijk" />

      {vergrendeld && (
        <p className="jaar-melding jaar-melding-slot">
          🔒 Schooljaar <strong>{schooljaar}</strong> is afgesloten. Deelbadges staan vast.
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
        onChange={onFilterChange}
        verbergVelden={["graad", "klasgroep"]}
        cursusOpties={cursusOpties}
        cursus={cursusFilter}
        onCursusChange={setMatrixCursus}
      />

      <div className="matrix-acties">
        {!vergrendeld && !meerdereStromen && (
          <button
            type="button"
            className="knop-primair"
            onClick={() => setEditor({ stroom: matrixStromen[0] })}
          >
            + Nieuwe deelbadge
          </button>
        )}
        {alleSectieKeys.length > 0 && (
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
          label={editor.bestaand ? "Deelbadge bewerken" : "Nieuwe deelbadge"}
          onClose={() => setEditor(null)}
        >
          <DeelevaluatieEditor
            stroom={editor.stroom}
            schooljaar={schooljaar}
            mentorId={mentorId}
            bestaand={editor.bestaand}
            voorinvulling={editor.voorinvulling}
            onSluit={() => setEditor(null)}
          />
        </Modal>
      )}

      {zichtbaar.length === 0 ? (
        <p className="lege-staat">
          Geen leerlingen voor deze stroom en filter. Kies een andere stroom of pas de filter aan.
        </p>
      ) : (
        perStroom.map(({ stroom, leerlingen, mijn, cursussen, badgeTekst }) => (
          <Fragment key={stroom}>
            {meerdereStromen && (
              <div className="stroom-deel-kop">
                <h2 className="stroom-matrix-titel">
                  {STROOM_LABEL[stroom]}
                  <span>
                    {leerlingen.length} {leerlingen.length === 1 ? "leerling" : "leerlingen"}
                  </span>
                </h2>
                {!vergrendeld && (
                  <button
                    type="button"
                    className="knop-secundair"
                    onClick={() => setEditor({ stroom })}
                  >
                    + Nieuwe deelbadge
                  </button>
                )}
              </div>
            )}

            {leerlingen.length === 0 ? (
              <p className="lege-staat">
                Geen leerlingen in {STROOM_LABEL[stroom]} voor deze filter.
              </p>
            ) : cursussen.length === 0 ? (
              <p className="lege-staat">Geen cursussen voor deze filter.</p>
            ) : (
              cursussen.map((cursus) => (
                <DeelCursusSectie
                  key={`${stroom}|${cursus}`}
                  stroom={stroom}
                  cursus={cursus}
                  leerlingen={leerlingen}
                  rijen={mijn.filter((d) => d.cursus === cursus)}
                  badgeTekst={badgeTekst}
                  deelKleuren={deelKleuren}
                  deelNotities={deelNotities}
                  vergrendeld={vergrendeld}
                  dicht={!openSecties.includes(`${stroom}|${cursus}`)}
                  onToggle={() => toggleSectie(`${stroom}|${cursus}`)}
                  onNieuw={(typeId) =>
                    setEditor({ stroom, voorinvulling: { cursus, typeId } })
                  }
                  onBewerk={(d) => setEditor({ stroom, bestaand: d })}
                />
              ))
            )}
          </Fragment>
        ))
      )}
    </section>
  );
}

/** Eén cursus binnen één stroom: de kapstok-tabel + de deelevaluatie-matrix. */
function DeelCursusSectie({
  stroom,
  cursus,
  leerlingen,
  rijen,
  badgeTekst,
  deelKleuren,
  deelNotities,
  vergrendeld,
  dicht,
  onToggle,
  onNieuw,
  onBewerk,
}: {
  stroom: Stroom;
  cursus: string;
  leerlingen: Student[];
  rijen: Deelevaluatie[];
  badgeTekst: Map<string, string>;
  deelKleuren: DeelKleuren;
  deelNotities: DeelNotities;
  vergrendeld: boolean;
  dicht: boolean;
  onToggle: () => void;
  onNieuw: (typeId: string | null) => void;
  onBewerk: (d: Deelevaluatie) => void;
}) {
  const wijzigingLabel = useWijzigingLabel();
  const geschiedenis = useGeschiedenis();
  const deelWijzigingLabel = useDeelevaluatieWijzigingLabel();
  const types = typesVoorCursus(stroom, cursus);
  const aantalPerType = new Map<string | null, number>();
  for (const d of rijen) aantalPerType.set(d.typeId, (aantalPerType.get(d.typeId) ?? 0) + 1);

  return (
    <div className="de-cursus">
      <button type="button" className="de-cursus-kop" onClick={onToggle}>
        <span className="grid-caret">{dicht ? "▶" : "▼"}</span>
        <h2>{cursus}</h2>
        <span className="de-cursus-meta">
          {rijen.length} {rijen.length === 1 ? "deelbadge" : "deelbadges"}
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
                    <th>Groep in deze cursus</th>
                    <th>Aantal badges</th>
                    <th>Aangemaakt</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {types.map((t) => (
                    <tr key={t.id}>
                      <td>{t.naam}</td>
                      <td className="de-num">{t.richtaantal}</td>
                      <td className="de-num">{aantalPerType.get(t.id) ?? 0}</td>
                      <td className="de-kapstok-actie">
                        {!vergrendeld && (
                          <button
                            type="button"
                            className="knop-icoon knop-icoon-klein"
                            title={`Deelbadge toevoegen voor "${t.naam}"`}
                            aria-label={`Deelbadge toevoegen voor ${t.naam}`}
                            onClick={() => onNieuw(t.id)}
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
              <span className="lege-staat">Nog geen deelbadges in deze cursus.</span>
              {!vergrendeld && (
                <button
                  type="button"
                  className="knop-icoon"
                  title={`Nieuwe deelbadge voor "${cursus}"`}
                  aria-label={`Nieuwe deelbadge voor ${cursus}`}
                  onClick={() => onNieuw(null)}
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
                    <th className="grid-col-doel">Deelbadge</th>
                    {leerlingen.map((s) => (
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
                        <td
                          className="grid-col-doel grid-doel"
                          title={deelWijzigingLabel(d) ?? undefined}
                        >
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
                                    <span
                                      key={id}
                                      className="de-badge-chip"
                                      title={badgeTekst.get(id)}
                                    >
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
                                  aantal={leerlingen.length}
                                  disabled={vergrendeld}
                                  onKies={(kleur) =>
                                    setDeelKleurBulk(
                                      d.id,
                                      leerlingen.map((s) => s.id),
                                      kleur,
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  className="knop-icoon knop-icoon-klein"
                                  title="Deelbadge bewerken"
                                  aria-label={`"${d.titel}" bewerken`}
                                  onClick={() => onBewerk(d)}
                                >
                                  <PotloodIcoon />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        {leerlingen.map((s) => {
                          const kleur = getDeelKleur(deelKleuren, d.id, s.id);
                          const sleutel = deelSleutel(d.id, s.id);
                          const wLabel = wijzigingLabel(sleutel) ?? undefined;
                          return (
                            <td key={s.id} className="grid-cel" title={wLabel}>
                              <div className={`grid-cel-inhoud rating-${kleur ?? "empty"}`}>
                                <RatingCell
                                  label={`${s.firstName} — ${d.titel}`}
                                  readonly={vergrendeld}
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
}
