import keerpuntLogo from "../assets/keerpunt-logo.png";
import { cursussenVoorStroom } from "../lib/curriculum";
import { stroomVan } from "../lib/leerlingen";
import { RATING_LABEL } from "../lib/ratings";
import { KLEUR_KEY, rubriekenVoorCursus } from "../lib/rubrieken";
import { getRapportCursusKleur, getRapportCursusOpmerking, getRapportItem } from "../lib/store";
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
}: {
  student: Student;
  rapport: Rapport;
  /** `rubriekenLijst()` — bundel + overrides, dezelfde bron als de Rubrics-pagina. */
  rubrieken: Rubriek[];
}) {
  const stroom = stroomVan(student, rapport.schooljaar);
  const cursussen = cursussenVoorStroom(stroom);
  // Per cursus: enkel de rubrics die effectief een kleur hebben — een leeg/
  // niet-gekozen rubric staat er standaard niet bij (dat is ballast op een rapport dat de deur uit
  // gaat; het volledige overzicht incl. lege rubrics blijft gewoon op het scherm staan). Een cursus
  // komt op het blad zodra er iets ingevuld is: een rubric-kleur, de cursuskleur of -opmerking.
  const printCursussen = cursussen
    .map((cursus) => ({
      cursus,
      kleur: getRapportCursusKleur(rapport, cursus.id).kleur,
      opmerking: getRapportCursusOpmerking(rapport, cursus.id),
      rijen: rubriekenVoorCursus(rubrieken, stroom, cursus.naam, cursus.id)
        .map((r) => ({ r, item: getRapportItem(rapport, r.id) }))
        .filter(({ item }) => item.kleur !== null),
    }))
    .filter(({ kleur, opmerking, rijen }) => kleur || opmerking || rijen.length > 0);

  return (
    <div className="rapport-print">
      {/* Kop: logo links, schooljaar / leerling + klas / rapportmoment rechts. */}
      <header className="rapport-print-kop">
        <img src={keerpuntLogo} alt="Keerpunt freinetscholen" />
        <div className="rapport-print-kop-info">
          <p>Schooljaar {rapport.schooljaar.replace("-", " – ")}</p>
          <p className="rapport-print-kop-leerling">
            <strong>
              {student.firstName} {student.lastName}
            </strong>
            <span>{student.klasgroep}</span>
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
          const leerlijnen = rijen.filter(({ r }) => r.leerlijn.trim());
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
                <table className="rapport-print-tabel">
                  <thead>
                    <tr>
                      <th>Cursus</th>
                      <th>Rubric</th>
                      <th>Kleur</th>
                      <th>Betekenis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rijen.map(({ r, item }) => (
                      <tr key={r.id}>
                        <td>{cursus.naam}</td>
                        <td>{r.naam}</td>
                        <td>
                          <span className={`rating rating-${item.kleur ?? "empty"}`}>
                            {item.kleur ? RATING_LABEL[item.kleur] : "—"}
                          </span>
                        </td>
                        {/* De rubric-tekst bij de rapport kleur — enkel de 4 kleuren
                            hebben er een, een witte status (bv. vrijgesteld) niet. */}
                        <td className="rapport-print-betekenis">
                          {item.kleur && item.kleur in KLEUR_KEY
                            ? r.criteria[
                                KLEUR_KEY[item.kleur as keyof typeof KLEUR_KEY]
                              ] || "—"
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Leerlijn onder elke rubric (cluster) van deze cursus. */}
              {leerlijnen.length > 0 && (
                <div className="rapport-print-kader rapport-print-leerlijn">
                  <h3>Leerlijn</h3>
                  {leerlijnen.map(({ r }) => (
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
