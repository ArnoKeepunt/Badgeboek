import { Link } from "react-router-dom";
import { Voortgangsring } from "../components/Voortgangsring";
import { cursussenVoorStroom, leerdoelenVoorCursus } from "../lib/curriculum";
import { aantalBehaald, telKleuren } from "../lib/kleurstats";
import { GRAAD_LABEL, graadVan, stroomVan } from "../lib/leerlingen";
import { graadKleur } from "../lib/leerlingVoortgang";
import { RATINGS } from "../lib/ratings";
import { useStore } from "../lib/store";
import type { Student } from "../lib/types";

/** Groot centraal overzicht voor de leerling: voortgang per graad en per cursus. */
export function LeerlingHome({ leerling }: { leerling: Student }) {
  const { kleuren } = useStore();
  const stroom = stroomVan(leerling);
  const graadLabel = GRAAD_LABEL[graadVan(leerling.leerjaar)];
  const cursussen = cursussenVoorStroom(stroom);

  const perCursus = cursussen.map((cursus) => {
    const doelen = leerdoelenVoorCursus(cursus.id);
    const telling = telKleuren(doelen.map((d) => graadKleur(kleuren, leerling.id, d.id)));
    return {
      cursus,
      totaal: doelen.length,
      // "Behaald" = de badge staat op groen of blauw. Geel/rood tellen niet mee.
      behaald: aantalBehaald(telling),
      telling,
    };
  });

  const totaal = perCursus.reduce((n, x) => n + x.totaal, 0);
  const behaald = perCursus.reduce((n, x) => n + x.behaald, 0);
  const klaar = perCursus.filter((x) => x.totaal > 0 && x.behaald === x.totaal).length;

  return (
    <div className="ll-home">
      <section className="ll-hero">
        <div className="ll-hero-tekst">
          <h1>Hoi {leerling.firstName}!</h1>
          <p>
            Je zit in de <strong>{graadLabel}</strong>. Zo ver ben je met je badges:
          </p>
          <p className="ll-hero-cijfer">
            <strong>{behaald}</strong> van {totaal} behaald
            {klaar > 0 && (
              <span className="ll-hero-klaar"> · {klaar} cursussen helemaal klaar 🎉</span>
            )}
          </p>
        </div>
        <Voortgangsring behaald={behaald} totaal={totaal} groot />
      </section>

      <h2 className="ll-kop">Mijn cursussen</h2>
      <div className="ll-cursussen">
        {perCursus.map(({ cursus, totaal: t, behaald: b, telling }) => (
          <Link key={cursus.id} to={`/vak/${cursus.id}`} className="ll-cursus-kaart">
            <div className="ll-cursus-boven">
              <span className="ll-cursus-naam">{cursus.naam}</span>
              <Voortgangsring behaald={b} totaal={t} />
            </div>
            <div className="ll-cursus-stand">
              {t === 0 ? "Nog geen badges" : `${b} van ${t} behaald`}
            </div>
            <div className="ll-strook" aria-hidden="true">
              {RATINGS.map((r) =>
                telling[r] > 0 ? (
                  <span
                    key={r}
                    className={`rating-${r}`}
                    style={{ flexGrow: telling[r], background: "var(--rating-solid)" }}
                  />
                ) : null,
              )}
              {telling.leeg > 0 && (
                <span className="ll-strook-leeg" style={{ flexGrow: telling.leeg }} />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
