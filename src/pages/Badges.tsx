import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BulkKnop } from "../components/BulkKnop";
import { ColorBar } from "../components/ColorBar";
import { LeerlingFilterBar } from "../components/LeerlingFilterBar";
import { RatingCell } from "../components/RatingCell";
import {
  cursussen as alleCursussen,
  cursussenVoorStroom,
  leerdoelenVoorCursus,
  leerdoelenVoorRubric,
  leerdoelenVoorStroom,
  rubricsVoorCursus,
  subgroepenVoorRubric,
} from "../lib/curriculum";
import { alleGroepDefs, groepLeden } from "../lib/groepen";
import { telKleuren } from "../lib/kleurstats";
import { filterLeerlingen, stroomVan, useLeerlingFilter } from "../lib/leerlingen";
import { PERIODES, type PeriodeId } from "../lib/periode";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "../lib/schooljaar";
import {
  getDoelKleur,
  setDoelKleur,
  setDoelKleurBulk,
  setPeriode,
  toggleMatrixStroom,
  useStore,
} from "../lib/store";
import { STROMEN, STROOM_LABEL } from "../lib/types";
import type { DoelKleuren, Leerdoel, Stroom, Student } from "../lib/types";

/**
 * Badgematrix: badges (per cursus, per rubric) als rijen, leerlingen als kolommen.
 * Cursussen en rubrics zijn in- en uitklapbaar zodat een mentor enkel toont wat relevant is
 * (bv. wiskunde zonder de talen). De inklapstand wordt lokaal onthouden.
 *
 * De stroomkeuze bepaalt zowel welke badges als welke leerlingen zichtbaar zijn: sta je op
 * "1e graad A", dan zie je enkel A-leerlingen. Meerdere stromen tegelijk kan (bv. 1A + 1B):
 * elke stroom krijgt dan zijn eigen tabel — badges én leerlingen apart, allebei bewerkbaar.
 *
 * (In de code heten de badges nog `leerdoel` — enkel de labels zijn "badge".)
 */

const FOLD_KEY = "keerpunt-badgeboek:matrix-fold:v2";

/** Standaard: alle cursussen toegeklapt, zodat je niet langs alles moet scrollen. */
const alleCursusIds = () => alleCursussen.map((c) => c.id);

interface Fold {
  cursus: string[];
  rubric: string[];
  /** Ingeklapte subgroepen, sleutel `${rubricId}|${subgroepnaam}`. */
  subgroep: string[];
}

function loadFold(): Fold {
  try {
    const raw = localStorage.getItem(FOLD_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Fold>;
      return {
        cursus: p.cursus ?? alleCursusIds(),
        rubric: p.rubric ?? [],
        subgroep: p.subgroep ?? [],
      };
    }
  } catch {
    // geen opgeslagen stand
  }
  return { cursus: alleCursusIds(), rubric: [], subgroep: [] };
}

const subgroepSleutel = (rubricId: string, naam: string) => `${rubricId}|${naam}`;

const zonder = (arr: string[], id: string) => arr.filter((x) => x !== id);
const met = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id]);

interface StroomMatrixProps {
  stroom: Stroom;
  leerlingen: Student[];
  fold: Fold;
  toggleCursus: (id: string) => void;
  toggleRubric: (id: string) => void;
  toggleSubgroep: (key: string) => void;
  kleuren: DoelKleuren;
  schooljaar: string;
  periode: PeriodeId;
  vergrendeld: boolean;
  toonTitel: boolean;
}

/** Eén badgematrix voor precies één stroom: die stroom zijn cursussen × die stroom zijn leerlingen. */
function StroomMatrix({
  stroom,
  leerlingen,
  fold,
  toggleCursus,
  toggleRubric,
  toggleSubgroep,
  kleuren,
  schooljaar,
  periode,
  vergrendeld,
  toonTitel,
}: StroomMatrixProps) {
  const cursussen = cursussenVoorStroom(stroom);
  const stroomLeerdoelen = useMemo(() => leerdoelenVoorStroom(stroom), [stroom]);

  const telVoor = (doelen: { id: string }[], studentId: string) =>
    telKleuren(doelen.map((d) => getDoelKleur(kleuren, schooljaar, periode, studentId, d.id)));

  const telCellen = (doelen: { id: string }[]) =>
    leerlingen.map((s) => {
      const t = telVoor(doelen, s.id);
      return (
        <td key={s.id} className="grid-tel-cel">
          {doelen.length - t.leeg}/{doelen.length}
        </td>
      );
    });

  const doelRij = (doel: Leerdoel, niveau: 1 | 2 | 3) => (
    <tr key={doel.id}>
      <td className={`grid-col-doel grid-doel grid-doel-n${niveau}`}>
        <div className="grid-doel-rij">
          <span className="grid-doel-tekst">{doel.omschrijving}</span>
          <BulkKnop
            aantal={leerlingen.length}
            disabled={vergrendeld}
            onKies={(kleur) =>
              setDoelKleurBulk(
                schooljaar,
                periode,
                leerlingen.map((s) => s.id),
                doel.id,
                kleur,
              )
            }
          />
        </div>
      </td>
      {leerlingen.map((s) => (
        <td key={s.id} className="grid-cel">
          <RatingCell
            label={`${s.firstName} — ${doel.omschrijving}`}
            readonly={vergrendeld}
            value={getDoelKleur(kleuren, schooljaar, periode, s.id, doel.id)}
            onChange={(next) => setDoelKleur(schooljaar, periode, s.id, doel.id, next)}
          />
        </td>
      ))}
    </tr>
  );

  const kolomTotalen = leerlingen.map((s) =>
    telKleuren(stroomLeerdoelen.map((d) => getDoelKleur(kleuren, schooljaar, periode, s.id, d.id))),
  );

  const titel = toonTitel ? (
    <h2 className="stroom-matrix-titel">
      {STROOM_LABEL[stroom]}
      <span>
        {leerlingen.length} {leerlingen.length === 1 ? "leerling" : "leerlingen"} ·{" "}
        {stroomLeerdoelen.length} badges
      </span>
    </h2>
  ) : null;

  if (cursussen.length === 0) {
    return (
      <div className="stroom-matrix">
        {titel}
        <p className="lege-staat">
          Nog geen badges voor {STROOM_LABEL[stroom]}. Dit badgeboek is nog niet verwerkt.
        </p>
      </div>
    );
  }
  if (leerlingen.length === 0) {
    return (
      <div className="stroom-matrix">
        {titel}
        <p className="lege-staat">Geen leerlingen in {STROOM_LABEL[stroom]} voor deze filter.</p>
      </div>
    );
  }

  return (
    <div className="stroom-matrix">
      {titel}
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="grid-col-doel">Badge</th>
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

          {cursussen.map((cursus) => {
            const cursusDicht = fold.cursus.includes(cursus.id);
            const cursusDoelen = leerdoelenVoorCursus(cursus.id);
            const cursusRubrics = rubricsVoorCursus(cursus.id);
            // Eén rubriek met dezelfde naam als de cursus = een overbodig tussenniveau:
            // toon de badges dan meteen onder de cursus.
            const enkeleRubriek = cursusRubrics.length === 1;
            return (
              <tbody key={cursus.id}>
                <tr className="grid-cursus">
                  <th className="grid-col-doel">
                    <button
                      type="button"
                      className="grid-toggle"
                      onClick={() => toggleCursus(cursus.id)}
                    >
                      <span className="grid-caret">{cursusDicht ? "▶" : "▼"}</span>
                      {cursus.naam}
                      <span className="grid-count">{cursusDoelen.length}</span>
                    </button>
                  </th>
                  {leerlingen.map((s) => {
                    const t = telVoor(cursusDoelen, s.id);
                    return (
                      <td key={s.id} className="grid-tel-cel">
                        {cursusDoelen.length - t.leeg}/{cursusDoelen.length}
                      </td>
                    );
                  })}
                </tr>

                {!cursusDicht &&
                  cursusRubrics.map((rubric) => {
                    const rubricDicht = !enkeleRubriek && fold.rubric.includes(rubric.id);
                    const doelen = leerdoelenVoorRubric(rubric.id);
                    const subgroepen = subgroepenVoorRubric(rubric.id);
                    return (
                      <Fragment key={rubric.id}>
                        {!enkeleRubriek && (
                          <tr className="grid-group">
                            <th className="grid-col-doel">
                              <button
                                type="button"
                                className="grid-toggle"
                                onClick={() => toggleRubric(rubric.id)}
                              >
                                <span className="grid-caret">{rubricDicht ? "▶" : "▼"}</span>
                                {rubric.naam}
                                <span className="grid-count">{doelen.length}</span>
                              </button>
                            </th>
                            {telCellen(doelen)}
                          </tr>
                        )}

                        {!rubricDicht &&
                          subgroepen.map((groep) => {
                            if (!groep.naam) {
                              const losNiveau = enkeleRubriek ? 1 : 2;
                              return (
                                <Fragment key={`${rubric.id}|los`}>
                                  {groep.leerdoelen.map((d) => doelRij(d, losNiveau))}
                                </Fragment>
                              );
                            }
                            const sgKey = subgroepSleutel(rubric.id, groep.naam);
                            const sgDicht = fold.subgroep.includes(sgKey);
                            return (
                              <Fragment key={sgKey}>
                                <tr className="grid-group grid-subgroep">
                                  <th className="grid-col-doel">
                                    <button
                                      type="button"
                                      className="grid-toggle"
                                      onClick={() => toggleSubgroep(sgKey)}
                                    >
                                      <span className="grid-caret">{sgDicht ? "▶" : "▼"}</span>
                                      {groep.naam}
                                      <span className="grid-count">{groep.leerdoelen.length}</span>
                                    </button>
                                  </th>
                                  {telCellen(groep.leerdoelen)}
                                </tr>
                                {!sgDicht && groep.leerdoelen.map((d) => doelRij(d, 3))}
                              </Fragment>
                            );
                          })}
                      </Fragment>
                    );
                  })}
              </tbody>
            );
          })}

          <tfoot>
            <tr>
              <th className="grid-col-doel">Samenvatting</th>
              {kolomTotalen.map((t, i) => (
                <td key={leerlingen[i].id} className="grid-foot-cel">
                  <div>
                    {stroomLeerdoelen.length - t.leeg}/{stroomLeerdoelen.length} ingevuld
                  </div>
                  <ColorBar telling={t} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function Badges() {
  const { students, kleuren, groepen, schooljaar, periode, matrixStromen } = useStore();
  const [filter, setFilter] = useLeerlingFilter();
  const [fold, setFold] = useState<Fold>(loadFold);
  const vergrendeld = isAfgesloten(schooljaar);
  const archief = !vergrendeld && schooljaar !== HUIDIG_SCHOOLJAAR;

  const groepDefs = useMemo(() => alleGroepDefs(students, groepen), [students, groepen]);

  // De stroomchips bepalen al de graad/klasgroep-as, dus die velden in de filterbalk laten
  // we weg en negeren we hier — geen dubbel systeem.
  const stroomLeerlingen = useMemo(
    () => students.filter((s) => matrixStromen.includes(stroomVan(s))),
    [students, matrixStromen],
  );
  const zichtbaar = useMemo(() => {
    const leden = groepLeden(filter.groepId, students, groepen);
    const zonderStroomvelden = { ...filter, graad: "", klasgroep: "" };
    return filterLeerlingen(stroomLeerlingen, zonderStroomvelden, leden);
  }, [students, groepen, filter, stroomLeerlingen]);

  const leerlingenPerStroom = useMemo(
    () =>
      matrixStromen.map((s) => ({
        stroom: s,
        leerlingen: zichtbaar.filter((l) => stroomVan(l) === s),
      })),
    [matrixStromen, zichtbaar],
  );

  useEffect(() => {
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify(fold));
    } catch {
      // opslag niet beschikbaar — stand blijft enkel voor deze sessie
    }
  }, [fold]);

  const toggleCursus = (id: string) =>
    setFold((f) => ({
      ...f,
      cursus: f.cursus.includes(id) ? zonder(f.cursus, id) : met(f.cursus, id),
    }));
  const toggleRubric = (id: string) =>
    setFold((f) => ({
      ...f,
      rubric: f.rubric.includes(id) ? zonder(f.rubric, id) : met(f.rubric, id),
    }));
  const toggleSubgroep = (key: string) =>
    setFold((f) => ({
      ...f,
      subgroep: f.subgroep.includes(key) ? zonder(f.subgroep, key) : met(f.subgroep, key),
    }));

  const allesDicht = () => {
    const cursusIds = matrixStromen.flatMap((s) => cursussenVoorStroom(s).map((c) => c.id));
    const rubricIds = cursusIds.flatMap((id) => rubricsVoorCursus(id).map((r) => r.id));
    const subgroepKeys = rubricIds.flatMap((rid) =>
      subgroepenVoorRubric(rid)
        .filter((g) => g.naam)
        .map((g) => `${rid}|${g.naam}`),
    );
    setFold({ cursus: cursusIds, rubric: rubricIds, subgroep: subgroepKeys });
  };
  const allesOpen = () => setFold({ cursus: [], rubric: [], subgroep: [] });

  return (
    <section>
      <div className="periode-balk">
        <span className="periode-balk-label">Stroom</span>
        {STROMEN.map((s) => {
          const actief = matrixStromen.includes(s);
          return (
            <button
              key={s}
              type="button"
              className={`chip${actief ? " is-active" : ""}`}
              aria-pressed={actief}
              onClick={() => toggleMatrixStroom(s)}
            >
              {STROOM_LABEL[s]} ({cursussenVoorStroom(s).length})
            </button>
          );
        })}
        <span className="periode-balk-hint">meerdere mogelijk</span>
      </div>

      <div className="periode-balk">
        <span className="periode-balk-label">Periode</span>
        {PERIODES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip${p.id === periode ? " is-active" : ""}`}
            onClick={() => setPeriode(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {vergrendeld && (
        <p className="jaar-melding jaar-melding-slot">
          🔒 Schooljaar <strong>{schooljaar}</strong> is afgesloten. De evaluaties staan vast en
          kunnen niet meer gewijzigd worden.
        </p>
      )}
      {archief && (
        <p className="jaar-melding">
          Je bekijkt schooljaar <strong>{schooljaar}</strong> (niet het lopende schooljaar).
          Wijzigingen worden bewaard bij dat schooljaar. Wissel bovenaan van schooljaar.
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
        <button type="button" className="linkknop" onClick={allesOpen}>
          Alles uitklappen
        </button>
        <button type="button" className="linkknop" onClick={allesDicht}>
          Alles inklappen
        </button>
      </div>

      {zichtbaar.length === 0 ? (
        <p className="lege-staat">
          Geen leerlingen voor deze stroom en filter. Duid de juiste stroom aan of pas de filter
          aan.
        </p>
      ) : (
        leerlingenPerStroom.map(({ stroom, leerlingen }) => (
          <StroomMatrix
            key={stroom}
            stroom={stroom}
            leerlingen={leerlingen}
            fold={fold}
            toggleCursus={toggleCursus}
            toggleRubric={toggleRubric}
            toggleSubgroep={toggleSubgroep}
            kleuren={kleuren}
            schooljaar={schooljaar}
            periode={periode}
            vergrendeld={vergrendeld}
            toonTitel={matrixStromen.length > 1}
          />
        ))
      )}
    </section>
  );
}
