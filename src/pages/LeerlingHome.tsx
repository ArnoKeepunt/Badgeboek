import { Link } from "react-router-dom";
import { CursusIcoon, KleurLegende, KleurStrook } from "../components/LeerlingOnderdelen";
import { cursussenVoorStroom, leerdoelenVoorCursus } from "../lib/curriculum";
import { aantalBehaald, aantalIngevuld, telKleuren } from "../lib/kleurstats";
import { GRAAD_LABEL, graadVan, stroomVan } from "../lib/leerlingen";
import { graadKleur } from "../lib/leerlingVoortgang";
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

  const behaald = perCursus.reduce((n, x) => n + x.behaald, 0);
  const klaar = perCursus.filter((x) => x.totaal > 0 && x.behaald === x.totaal).length;
  const alles = telKleuren(
    perCursus.flatMap(({ cursus }) =>
      leerdoelenVoorCursus(cursus.id).map((d) => graadKleur(kleuren, leerling.id, d.id)),
    ),
  );
  // "Aangeboden" = de badge heeft al een kleur gekregen (wit/leeg = nog niet aangeboden;
  // witte statussen zoals n.v.t. vallen erbuiten).
  const aangeboden = aantalIngevuld(alles);

  return (
    <div className="ll-home">
      {/* Rooster i.p.v. geneste blokken: op de gsm staat de teller naast de groet en lopen de
          zin + legende eronder over de volle breedte. Zie `.ll-hero` in Leerling.css. */}
      <section className="ll-hero">
        <span className="ll-hero-graad">{graadLabel}</span>
        <h1 className="ll-hero-titel">Hoi {leerling.firstName}! 👋</h1>
        <p className="ll-hero-cijfer">
          Je hebt <strong>{behaald}</strong> {behaald === 1 ? "badge" : "badges"} behaald.
          {klaar > 0 && (
            <>
              {" "}
              <span className="ll-hero-klaar">
                {klaar === 1 ? "1 cursus is" : `${klaar} cursussen zijn`} helemaal klaar 🎉
              </span>
            </>
          )}
        </p>
        <KleurLegende telling={alles} />
        {/* Behaald t.o.v. de badges die al aangeboden (beoordeeld) zijn — niet t.o.v. alle badges
            van het jaar, want dat gaf leerlingen een verkeerd beeld. */}
        <div
          className="ll-hero-teller"
          role="img"
          aria-label={`${behaald} van de ${aangeboden} aangeboden badges behaald`}
        >
          <span className="ll-hero-teller-getal">
            {behaald}
            <span className="ll-hero-teller-totaal">/{aangeboden}</span>
          </span>
          <span className="ll-hero-teller-label">aangeboden</span>
        </div>
      </section>

      <h2 className="ll-kop">Mijn cursussen</h2>
      <div className="ll-cursussen">
        {/* Geen ring per cursus: een percentage per cursus gaf leerlingen een verkeerd beeld.
            De kleurenstrook toont wel hoe de badges ervoor staan. */}
        {perCursus.map(({ cursus, totaal: t, behaald: b, telling }) => (
          <Link key={cursus.id} to={`/vak/${cursus.id}`} className="ll-cursus-kaart">
            <CursusIcoon id={cursus.id} naam={cursus.naam} />
            <span className="ll-cursus-midden">
              <span className="ll-cursus-naam">{cursus.naam}</span>
              <span className="ll-cursus-stand">
                {t === 0 ? "Nog geen badges" : `${b} van ${t} behaald`}
              </span>
              {t > 0 && <KleurStrook telling={telling} />}
            </span>
            <span className="ll-pijl" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
