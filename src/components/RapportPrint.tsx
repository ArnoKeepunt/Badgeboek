import keerpuntLogo from "../assets/keerpunt-logo.png";
import { rapportCursussen, rapportKlas } from "../lib/rapportInhoud";
import { RATING_LABEL } from "../lib/ratings";
import type { Rapport, Rubriek, Student } from "../lib/types";

/**
 * Het geprinte rapport van één leerling: enkel zichtbaar bij het afdrukken (zie `@media print` in
 * `index.css`). Statische, opgeruimde weergave — geen popovers/knoppen die toch niet printen.
 * Gedeeld door het rapport van één leerling (`RapportDetail`) en het bulkprinten op `/rapport`;
 * na elkaar geplaatst begint elk rapport op een nieuwe pagina.
 */
export function RapportPrint({
  student,
  rapport,
  rubrieken,
  logo = keerpuntLogo,
}: {
  student: Student;
  rapport: Rapport;
  /** Het logo; de pdf-server geeft hier een `data:`-URI mee (die laadt niets van buiten). */
  logo?: string;
  /** `rubriekenLijst()` — bundel + overrides, dezelfde bron als de Rubrics-pagina. */
  rubrieken: Rubriek[];
}) {
  const printCursussen = rapportCursussen(student, rapport, rubrieken);

  return (
    <div className="rapport-print">
      {/* Kop: logo links, schooljaar / leerling + klas / rapportmoment rechts. */}
      <header className="rapport-print-kop">
        <img src={logo} alt="Keerpunt freinetscholen" />
        <div className="rapport-print-kop-info">
          <p>Schooljaar {rapport.schooljaar.replace("-", " – ")}</p>
          <p className="rapport-print-kop-leerling">
            <strong>
              {student.firstName} {student.lastName}
            </strong>
            <span>{rapportKlas(student, rapport)}</span>
          </p>
          <p>{rapport.naam}</p>
        </div>
      </header>

      {/* Altijd een kader, ook leeg: zo blijft de plaats op het blad hetzelfde. */}
      <section className="rapport-print-kader rapport-print-klassenraad">
        <h2>Commentaar klassenraad</h2>
        {rapport.klassenraadCommentaar && <p>{rapport.klassenraadCommentaar}</p>}
      </section>

      {printCursussen.length === 0 ? (
        <p className="rapport-print-leeg">
          Nog geen enkele rubric ingevuld voor dit rapport.
        </p>
      ) : (
        printCursussen.map(({ cursus, kleur, opmerking, rijen }) => {
          const leerlijnen = rijen.filter(({ rubriek }) => rubriek.leerlijn.trim());
          return (
            <section key={cursus.id} className="rapport-print-cursus">
              {/* Cursuskop: naam + opmerking links, de cursuskleur (eval. cursus) rechts. */}
              <div className="rapport-print-cursus-kop">
                <div className="rapport-print-cursus-naam">
                  <h2>{cursus.naam}</h2>
                  {opmerking && <p>{opmerking}</p>}
                </div>
                <div className="rapport-print-cursus-eval">
                  {kleur ? (
                    <span className={`rating rating-${kleur}`}>
                      {RATING_LABEL[kleur]}
                    </span>
                  ) : (
                    <span className="rapport-print-geen-kleur">—</span>
                  )}
                  <small>Evaluatie cursus</small>
                </div>
              </div>

              {rijen.length > 0 && (
                <ul className="rapport-print-rubrieken">
                  {rijen.map(({ rubriek: r, kleur: rijKleur, betekenis }) => (
                    <li key={r.id}>
                      <div className="rapport-print-rubriek-kop">
                        <strong>{r.naam}</strong>
                        <span className={`rating rating-${rijKleur}`}>
                          {RATING_LABEL[rijKleur]}
                        </span>
                      </div>
                      {/* De rubric-tekst bij de gekozen kleur — enkel de 4 kleuren hebben er
                          een, een witte status (bv. vrijgesteld) niet. */}
                      {betekenis && <p className="rapport-print-betekenis">{betekenis}</p>}
                    </li>
                  ))}
                </ul>
              )}

              {/* Leerlijn onder elke rubric (cluster) van deze cursus. */}
              {leerlijnen.length > 0 && (
                <div className="rapport-print-kader rapport-print-leerlijn">
                  <h3>Leerlijn</h3>
                  {leerlijnen.map(({ rubriek: r }) => (
                    <div key={r.id}>
                      {leerlijnen.length > 1 && <h4>{r.naam}</h4>}
                      <p>{r.leerlijn}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      <footer className="rapport-print-handtekeningen">
        <div>Handtekening klastitularis</div>
        <div>Handtekening leerling</div>
        <div>Handtekening ouder</div>
      </footer>
    </div>
  );
}
