import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ColorBar } from "../components/ColorBar";
import { LeerlingFilterBar } from "../components/LeerlingFilterBar";
import { RatingCell } from "../components/RatingCell";
import {
  cursussen,
  leerdoelen,
  leerdoelenVoorCursus,
  leerdoelenVoorRubric,
  rubrics,
  rubricsVoorCursus,
} from "../lib/curriculum";
import { alleGroepDefs, groepLeden } from "../lib/groepen";
import { telKleuren } from "../lib/kleurstats";
import { filterLeerlingen, useLeerlingFilter } from "../lib/leerlingen";
import { ALGEMEEN, PERIODES, type PeriodeId, isGeldigePeriode } from "../lib/periode";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "../lib/schooljaar";
import { getDoelKleur, setDoelKleur, useStore } from "../lib/store";

/**
 * Badgematrix: badges (per cursus, per rubric) als rijen, leerlingen als kolommen.
 * Cursussen en rubrics zijn in- en uitklapbaar zodat een mentor enkel toont wat relevant is
 * (bv. wiskunde zonder de talen). De inklapstand wordt lokaal onthouden.
 *
 * (In de code heten de badges nog `leerdoel` — enkel de labels zijn "badge".)
 */

const FOLD_KEY = "keerpunt-badgeboek:matrix-fold";
const PERIODE_KEY = "keerpunt-badgeboek:matrix-periode";

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

function loadPeriode(): PeriodeId {
  try {
    const raw = localStorage.getItem(PERIODE_KEY);
    if (raw && isGeldigePeriode(raw)) return raw;
  } catch {
    // geen opgeslagen keuze
  }
  return ALGEMEEN;
}

const zonder = (arr: string[], id: string) => arr.filter((x) => x !== id);
const met = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id]);

export function Badges() {
  const { students, kleuren, groepen, schooljaar } = useStore();
  const [filter, setFilter] = useLeerlingFilter();
  const [fold, setFold] = useState<Fold>(loadFold);
  const [periode, setPeriode] = useState<PeriodeId>(loadPeriode);
  const vergrendeld = isAfgesloten(schooljaar);
  const archief = !vergrendeld && schooljaar !== HUIDIG_SCHOOLJAAR;

  useEffect(() => {
    try {
      localStorage.setItem(PERIODE_KEY, periode);
    } catch {
      // opslag niet beschikbaar
    }
  }, [periode]);

  const groepDefs = useMemo(() => alleGroepDefs(students, groepen), [students, groepen]);
  const zichtbaar = useMemo(() => {
    const leden = groepLeden(filter.groepId, students, groepen);
    return filterLeerlingen(students, filter, leden);
  }, [students, groepen, filter]);

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

  const allesDicht = () =>
    setFold({ cursus: cursussen.map((c) => c.id), rubric: rubrics.map((r) => r.id) });
  const allesOpen = () => setFold({ cursus: [], rubric: [] });

  const kolomTotalen = useMemo(
    () =>
      zichtbaar.map((s) =>
        telKleuren(
          leerdoelen.map((d) => getDoelKleur(kleuren, schooljaar, periode, s.id, d.id)),
        ),
      ),
    [zichtbaar, kleuren, schooljaar, periode],
  );

  const telVoor = (doelen: { id: string }[], studentId: string) =>
    telKleuren(doelen.map((d) => getDoelKleur(kleuren, schooljaar, periode, studentId, d.id)));

  return (
    <section>
      <h1>Badges</h1>
      <p style={{ color: "var(--text-muted)" }}>
        {leerdoelen.length} badges. Kies een periode, klik een cel aan om de kleur te kiezen of
        te wissen. Klap cursussen of rubrics op en filter de leerlingen om te tonen wat je nodig
        hebt. Alles wordt lokaal bewaard.
      </p>

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
        <p className="lege-staat">Geen leerlingen voor deze filter.</p>
      ) : (
        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th className="grid-col-doel">Badge</th>
                {zichtbaar.map((s) => (
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
                    {zichtbaar.map((s) => {
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
                            {zichtbaar.map((s) => {
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
                                <td className="grid-col-doel grid-doel">{doel.omschrijving}</td>
                                {zichtbaar.map((s) => (
                                  <td key={s.id} className="grid-cel">
                                    <RatingCell
                                      label={`${s.firstName} — ${doel.omschrijving}`}
                                      readonly={vergrendeld}
                                      value={getDoelKleur(
                                        kleuren,
                                        schooljaar,
                                        periode,
                                        s.id,
                                        doel.id,
                                      )}
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
                  <td key={zichtbaar[i].id} className="grid-foot-cel">
                    <div>
                      {leerdoelen.length - t.leeg}/{leerdoelen.length} ingevuld
                    </div>
                    <ColorBar telling={t} />
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
