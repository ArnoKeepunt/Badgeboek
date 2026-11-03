import { Link, useParams } from "react-router-dom";
import { RapportPrint } from "../components/RapportPrint";
import { useAangemeld } from "../lib/sessie";
import { rubriekenLijst, useStore } from "../lib/store";

/**
 * "Mijn rapporten" voor de leerling (en ouders): enkel de **afgewerkte** rapporten, alleen-lezen,
 * in dezelfde opmaak als het geprinte rapport. Een concept (nog in de maak bij de mentoren)
 * blijft onzichtbaar — de rapportmodule zelf is personeel-only.
 */
export function LeerlingRapporten() {
  const { rapportId } = useParams();
  const { rapporten } = useStore();
  const aangemeld = useAangemeld();

  if (aangemeld?.rol !== "leerling") {
    return (
      <div className="ll-leeg">
        <p>Deze pagina is voor leerlingen.</p>
        <Link to="/" className="ll-terug">
          ← Terug
        </Link>
      </div>
    );
  }

  const leerling = aangemeld.leerling;
  // Alle schooljaren, nieuwste eerst.
  const mijn = rapporten
    .filter((r) => r.studentId === leerling.id && r.status === "afgewerkt")
    .sort((a, b) =>
      a.schooljaar !== b.schooljaar
        ? b.schooljaar.localeCompare(a.schooljaar)
        : b.aangemaaktOp - a.aangemaaktOp,
    );

  if (rapportId) {
    const rapport = mijn.find((r) => r.id === rapportId);
    if (!rapport) {
      return (
        <div className="ll-leeg">
          <p>Dit rapport konden we niet vinden.</p>
          <Link to="/mijn-rapporten" className="ll-terug">
            ← Mijn rapporten
          </Link>
        </div>
      );
    }
    // De bewaarde pdf (nieuwste versie) van het afgewerkte rapport, als die er is.
    const pdf = rapport.pdfVersies?.at(-1);
    return (
      <div className="ll-rapport">
        <div className="ll-rapport-acties no-print">
          <Link to="/mijn-rapporten" className="ll-terug">
            ← Mijn rapporten
          </Link>
          <span className="ll-rapport-knoppen">
            {pdf && (
              <a className="ll-afmelden" href={pdf.url} target="_blank" rel="noreferrer">
                Pdf downloaden
              </a>
            )}
            <button type="button" className="ll-afmelden" onClick={() => window.print()}>
              Afdrukken
            </button>
          </span>
        </div>
        <div className="ll-rapport-blad">
          <RapportPrint student={leerling} rapport={rapport} rubrieken={rubriekenLijst()} />
        </div>
      </div>
    );
  }

  return (
    <div className="ll-rapporten">
      <h1 className="ll-kop">Mijn rapporten</h1>
      {mijn.length === 0 ? (
        <p className="ll-rapporten-leeg">
          Er is nog geen rapport klaar. Zodra je rapport afgewerkt is, vind je het hier.
        </p>
      ) : (
        <ul className="ll-rapporten-lijst">
          {mijn.map((r) => (
            <li key={r.id}>
              <Link to={`/mijn-rapporten/${r.id}`} className="ll-rapport-kaart">
                <span className="ll-rapport-icoon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 3v5h5M9.5 13h5M9.5 16.5h5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="ll-rapport-tekst">
                  <span className="ll-rapport-naam">{r.naam}</span>
                  <span className="ll-rapport-jaar">
                    Schooljaar {r.schooljaar.replace("-", " – ")}
                  </span>
                </span>
                <span className="ll-pijl" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
