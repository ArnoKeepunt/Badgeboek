import { Fragment, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { NotitieVeld } from "../components/NotitieVeld";
import { RatingCell } from "../components/RatingCell";
import { telKleuren } from "../lib/kleurstats";
import {
  cursussenVoorStroom,
  leerdoelenVoorCursus,
  leerdoelenVoorRubric,
  rubricsVoorCursus,
  subgroepenVoorRubric,
} from "../lib/curriculum";
import { GRAAD_LABEL, graadVan, stroomVan } from "../lib/leerlingen";
import { PERIODES } from "../lib/periode";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "../lib/schooljaar";
import { getDoelKleur, setDoelKleur, useStore } from "../lib/store";
import type { Leerdoel } from "../lib/types";

/**
 * Leerlingdetail: dezelfde badges als in de badgematrix (`Badges.tsx`), maar met de vijf
 * periodes als kolommen voor één leerling. Cursussen en rubrics zijn in- en uitklapbaar op
 * exact dezelfde manier als in de matrix; de koprij en de eerste kolom (badgetekst) blijven
 * leesbaar staan bij het scrollen.
 */

const FOLD_KEY = "keerpunt-badgeboek:student-fold";

interface Fold {
  cursus: string[];
  rubric: string[];
  subgroep: string[];
}

function loadFold(): Fold {
  try {
    const raw = localStorage.getItem(FOLD_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Fold>;
      return { cursus: p.cursus ?? [], rubric: p.rubric ?? [], subgroep: p.subgroep ?? [] };
    }
  } catch {
    // geen opgeslagen stand — begin volledig uitgeklapt
  }
  return { cursus: [], rubric: [], subgroep: [] };
}

const zonder = (arr: string[], id: string) => arr.filter((x) => x !== id);
const met = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id]);
const subgroepSleutel = (rubricId: string, naam: string) => `${rubricId}|${naam}`;

export function StudentDetail() {
  const { studentId } = useParams();
  const { students, kleuren, schooljaar } = useStore();
  const [fold, setFold] = useState<Fold>(loadFold);
  const student = students.find((s) => s.id === studentId);
  const vergrendeld = isAfgesloten(schooljaar);
  const archief = !vergrendeld && schooljaar !== HUIDIG_SCHOOLJAAR;

  const navigate = useNavigate();
  const location = useLocation();
  // "Terug" gaat naar de vorige pagina (bv. de matrix), of naar de leerlingenlijst als er
  // geen geschiedenis is (rechtstreeks geopende link).
  const kanTerug = location.key !== "default";
  const terug = () => (kanTerug ? navigate(-1) : navigate("/students"));

  useEffect(() => {
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify(fold));
    } catch {
      // opslag niet beschikbaar — stand blijft enkel voor deze sessie
    }
  }, [fold]);

  if (!student) {
    return (
      <section>
        <h1>Leerling niet gevonden</h1>
        <Link to="/students">Terug naar leerlingen</Link>
      </section>
    );
  }

  const stroom = stroomVan(student);
  const cursussen = cursussenVoorStroom(stroom);

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
    const cursusIds = cursussen.map((c) => c.id);
    const rubricIds = cursusIds.flatMap((id) => rubricsVoorCursus(id).map((r) => r.id));
    const subgroepKeys = rubricIds.flatMap((rid) =>
      subgroepenVoorRubric(rid)
        .filter((g) => g.naam)
        .map((g) => `${rid}|${g.naam}`),
    );
    setFold({ cursus: cursusIds, rubric: rubricIds, subgroep: subgroepKeys });
  };
  const allesOpen = () => setFold({ cursus: [], rubric: [], subgroep: [] });

  const telVoor = (doelen: { id: string }[], periodeId: string) =>
    telKleuren(doelen.map((d) => getDoelKleur(kleuren, schooljaar, periodeId, student.id, d.id)));

  const telCellen = (doelen: { id: string }[]) =>
    PERIODES.map((p) => {
      const t = telVoor(doelen, p.id);
      return (
        <td key={p.id} className="grid-tel-cel">
          {doelen.length - t.leeg}/{doelen.length}
        </td>
      );
    });

  const doelRij = (doel: Leerdoel, niveau: 1 | 2 | 3) => (
    <tr key={doel.id}>
      <td className={`grid-col-doel grid-doel grid-doel-n${niveau}`}>
        <div className="grid-doel-rij">
          <span className="grid-doel-tekst">{doel.omschrijving}</span>
          <NotitieVeld
            schooljaar={schooljaar}
            studentId={student.id}
            leerdoelId={doel.id}
            readonly={vergrendeld}
          />
        </div>
      </td>
      {PERIODES.map((p) => (
        <td key={p.id} className="grid-cel">
          <RatingCell
            label={`${doel.omschrijving} — ${p.label}`}
            readonly={vergrendeld}
            value={getDoelKleur(kleuren, schooljaar, p.id, student.id, doel.id)}
            onChange={(next) => setDoelKleur(schooljaar, p.id, student.id, doel.id, next)}
          />
        </td>
      ))}
    </tr>
  );

  return (
    <section>
      <div className="detail-terug">
        <button type="button" className="linkknop" onClick={terug}>
          &larr; Terug
        </button>
        <Link to="/students">Alle leerlingen</Link>
      </div>
      <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
        {student.vestiging} · {GRAAD_LABEL[graadVan(student.leerjaar)]} · {student.leerjaar}e jaar
        · groep {student.klasgroep} · badgeboek {stroom}
      </p>

      {vergrendeld && (
        <p className="jaar-melding jaar-melding-slot">
          🔒 Schooljaar <strong>{schooljaar}</strong> is afgesloten — de evaluaties staan vast.
        </p>
      )}
      {archief && (
        <p className="jaar-melding">
          Je bekijkt schooljaar <strong>{schooljaar}</strong> (niet het lopende schooljaar).
        </p>
      )}

      <div className="matrix-acties">
        <button type="button" className="linkknop" onClick={allesOpen}>
          Alles uitklappen
        </button>
        <button type="button" className="linkknop" onClick={allesDicht}>
          Alles inklappen
        </button>
      </div>

      <div className="grid-wrap">
        <table className="grid grid--rustig">
          <thead>
            <tr>
              <th className="grid-col-doel">Badge</th>
              {PERIODES.map((p) => (
                <th key={p.id} className="grid-col-periode" title={p.label}>
                  {p.kort}
                </th>
              ))}
            </tr>
          </thead>

          {cursussen.map((cursus) => {
            const cursusDicht = fold.cursus.includes(cursus.id);
            const cursusDoelen = leerdoelenVoorCursus(cursus.id);
            const cursusRubrics = rubricsVoorCursus(cursus.id);
            // Eén rubriek = overbodig tussenniveau: badges meteen onder de cursus.
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
                  {PERIODES.map((p) => {
                    const t = telVoor(cursusDoelen, p.id);
                    return (
                      <td key={p.id} className="grid-tel-cel">
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
        </table>
      </div>
    </section>
  );
}
