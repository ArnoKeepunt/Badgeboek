import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BulkKnop } from "../components/BulkKnop";
import { ColorBar } from "../components/ColorBar";
import { LeerlingFilterBar } from "../components/LeerlingFilterBar";
import { RatingCell } from "../components/RatingCell";
import {
  cursussenVoorStroom,
  leerdoelenVoorCursus,
  leerdoelenVoorRubric,
  leerdoelenVoorStroom,
  rubricsVoorCursus,
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
import type { DoelKleuren, Stroom, Student } from "../lib/types";

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

const FOLD_KEY = "keerpunt-badgeboek:matrix-fold";

interface Fold {
  cursus: string[];
  rubric: string[];
}

function loadFold(): Fold {
  try {
    const raw = localStorage.getItem(FOLD_KEY);
    if (raw) return JSON.parse(raw) as Fold;
  } catch {
    // geen opgeslagen stand — begin volledig uitgeklapt
  }
  return { cursus: [], rubric: [] };
}

const zonder = (arr: string[], id: string) => arr.filter((x) => x !== id);
const met = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id]);

interface StroomMatrixProps {
  stroom: Stroom;
  leerlingen: Student[];
  fold: Fold;
  toggleCursus: (id: string) => void;
  toggleRubric: (id: string) => void;
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
                <th key={s.id} className="grid-col-leerling">
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
                  rubricsVoorCursus(cursus.id).map((rubric) => {
                    const rubricDicht = fold.rubric.includes(rubric.id);
                    const doelen = leerdoelenVoorRubric(rubric.id);
                    return (
                      <Fragment key={rubric.id}>
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
                          {leerlingen.map((s) => {
                            const t = telVoor(doelen, s.id);
                            return (
                              <td key={s.id} className="grid-tel-cel">
                                {doelen.length - t.leeg}/{doelen.length}
                              </td>
                            );
                          })}
                        </tr>

                        {!rubricDicht &&
                          doelen.map((doel) => (
                            <tr key={doel.id}>
                              <td className="grid-col-doel grid-doel">
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
                                    onChange={(next) =>
                                      setDoelKleur(schooljaar, periode, s.id, doel.id, next)
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
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
  const zichtbaar = useMemo(() => {
    const leden = groepLeden(filter.groepId, students, groepen);
    return filterLeerlingen(students, filter, leden).filter((s) =>
      matrixStromen.includes(stroomVan(s)),
    );
  }, [students, groepen, filter, matrixStromen]);

  const leerlingenPerStroom = useMemo(
    () => matrixStromen.map((s) => ({ stroom: s, leerlingen: zichtbaar.filter((l) => stroomVan(l) === s) })),
    [matrixStromen, zichtbaar],
  );

  const totaalBadges = useMemo(
    () => matrixStromen.reduce((n, s) => n + leerdoelenVoorStroom(s).length, 0),
    [matrixStromen],
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

  const allesDicht = () => {
    const cursusIds = matrixStromen.flatMap((s) => cursussenVoorStroom(s).map((c) => c.id));
    const rubricIds = cursusIds.flatMap((id) => rubricsVoorCursus(id).map((r) => r.id));
    setFold({ cursus: cursusIds, rubric: rubricIds });
  };
  const allesOpen = () => setFold({ cursus: [], rubric: [] });

  return (
    <section>
      <h1>Badges</h1>
      <p style={{ color: "var(--text-muted)" }}>
        {totaalBadges} badges · {matrixStromen.map((s) => STROOM_LABEL[s]).join(" + ")}. Kies
        stroom en periode, klik een cel aan om de kleur te kiezen of te wissen. Klap cursussen of
        rubrics op en filter de leerlingen om te tonen wat je nodig hebt. Alles wordt lokaal
        bewaard.
      </p>

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
        alle={students}
        zichtbaar={zichtbaar.length}
        groepen={groepDefs}
        filter={filter}
        onChange={setFilter}
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
