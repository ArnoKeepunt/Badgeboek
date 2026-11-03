import { Link, useParams } from "react-router-dom";
import { CursusIcoon, KleurLegende, KleurStrook, Status } from "../components/LeerlingOnderdelen";
import { cursussenVoorStroom, leerdoelenVoorCursus } from "../lib/curriculum";
import { aantalBehaald, telKleuren } from "../lib/kleurstats";
import { stroomVan } from "../lib/leerlingen";
import { graadKleur, graadNotitie } from "../lib/leerlingVoortgang";
import { HUIDIG_SCHOOLJAAR } from "../lib/schooljaar";
import { useAangemeld } from "../lib/sessie";
import { getDeelKleur, getDeelNotitie, rubriekenLijst, useStore } from "../lib/store";
import { useBeoordelaar } from "../lib/wijzigingslog";
import { deelSleutel, doelSleutel, type Kleurcriteria } from "../lib/types";

/** De vier kleuren, positiefste eerst — met de sleutel in `Kleurcriteria` en de CSS-klasse. */
const RUBRIEK_KLEUREN: { key: keyof Kleurcriteria; klasse: string; label: string }[] = [
  { key: "blauw", klasse: "blue", label: "Blauw" },
  { key: "groen", klasse: "green", label: "Groen" },
  { key: "geel", klasse: "yellow", label: "Geel" },
  { key: "rood", klasse: "red", label: "Rood" },
];

const datumFmt = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });
/** "2026-10-14" → "14 okt."; onleesbaar → zoals het staat. */
const toonDatum = (d: string) => {
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : datumFmt.format(t);
};

/**
 * Zichtbare mentoropmerking als tekstballon. Kort → meteen tonen; lang → inklapbaar
 * (`<details>`), want sommige mentoren schrijven een halve pagina.
 */
function MentorNotitie({ tekst }: { tekst: string }) {
  // Niet "van <beoordelaar>": wie de kleur gaf, schreef niet per se de opmerking.
  const kop = "Opmerking van je mentor";
  if (tekst.length <= 140) {
    return (
      <div className="ll-ballon">
        <span className="ll-ballon-kop">{kop}</span>
        <p>{tekst}</p>
      </div>
    );
  }
  return (
    <details className="ll-ballon ll-ballon-lang">
      <summary className="ll-ballon-kop">{kop}</summary>
      <p>{tekst}</p>
    </details>
  );
}

export function LeerlingCursus() {
  const { cursusId } = useParams();
  const { kleuren, notities, deelevaluaties, deelKleuren, deelNotities } = useStore();
  const aangemeld = useAangemeld();
  const beoordelaar = useBeoordelaar();

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
  const stroom = stroomVan(leerling);
  const cursus = cursussenVoorStroom(stroom).find((c) => c.id === cursusId);

  if (!cursus) {
    return (
      <div className="ll-leeg">
        <p>Deze cursus konden we niet vinden.</p>
        <Link to="/" className="ll-terug">
          ← Terug naar mijn badges
        </Link>
      </div>
    );
  }

  // De uitgeschreven rubrieken voor deze cursus (nog niet elke cursus heeft er).
  const rubrieken = rubriekenLijst().filter(
    (r) => r.stroom === stroom && r.cursus === cursus.naam,
  );

  const doelen = leerdoelenVoorCursus(cursus.id);
  const telling = telKleuren(doelen.map((d) => graadKleur(kleuren, leerling.id, d.id)));
  // "Behaald" = de badge staat op groen of blauw. Geel/rood tellen niet mee.
  const behaald = aantalBehaald(telling);

  // De deelbadges die aan een badge van deze cursus hangen — altijd zichtbaar ín de kaart van
  // hun badge, zoals in het rapport (een deelbadge op meerdere badges staat onder elk ervan).
  // Nieuwste bovenaan; zonder datum onderaan. Enkel de **eigen** deelbadges: van de eigen
  // vestiging (of overkoepelend) én met een kleur of zichtbare opmerking voor deze leerling.
  // Een deelbadge hangt niet aan een klas/groep, enkel aan stroom + vestiging — zonder die
  // laatste voorwaarde zag elke leerling van de stroom de toetsen van andere groepen als
  // "Nog niet beoordeeld". Door de mentor verborgen deelbadges blijven sowieso weg.
  const cursusDoelIds = new Set(doelen.map((d) => d.id));
  const deelVanCursus = deelevaluaties
    .filter(
      (d) =>
        !d.verborgenVoorLeerlingen &&
        d.schooljaar === HUIDIG_SCHOOLJAAR &&
        d.stroom === stroom &&
        (d.vestiging === "" || d.vestiging === leerling.vestiging) &&
        d.leerdoelIds.some((id) => cursusDoelIds.has(id)) &&
        (getDeelKleur(deelKleuren, d.id, leerling.id) !== null ||
          getDeelNotitie(deelNotities, d.id, leerling.id).zichtbaar !== ""),
    )
    .sort((a, b) => {
      if (a.datum && b.datum && a.datum !== b.datum) return a.datum < b.datum ? 1 : -1;
      if (Boolean(a.datum) !== Boolean(b.datum)) return a.datum ? -1 : 1;
      return a.titel.localeCompare(b.titel, "nl");
    });

  return (
    <div className="ll-cursus">
      <Link to="/" className="ll-terug">
        ← Mijn badges
      </Link>

      <header className="ll-cursus-hero">
        <CursusIcoon id={cursus.id} naam={cursus.naam} groot />
        <div className="ll-cursus-hero-tekst">
          <h1>{cursus.naam}</h1>
          <p>
            {doelen.length === 0
              ? "Voor deze cursus staan er nog geen badges klaar."
              : `${behaald} van ${doelen.length} badges behaald`}
          </p>
        </div>
        {doelen.length > 0 && (
          <div className="ll-cursus-hero-strook">
            <KleurStrook telling={telling} />
            <KleurLegende telling={telling} />
          </div>
        )}
      </header>

      {doelen.length > 0 && (
        <section aria-label="Badges">
          <h2 className="ll-kop">Badges</h2>
          <ul className="ll-badges">
            {doelen.map((doel) => {
              const notitie = graadNotitie(notities, leerling.id, doel.id);
              const kleur = graadKleur(kleuren, leerling.id, doel.id);
              const wie = kleur
                ? beoordelaar(doelSleutel(HUIDIG_SCHOOLJAAR, leerling.id, doel.id))
                : null;
              const deel = deelVanCursus.filter((d) => d.leerdoelIds.includes(doel.id));
              return (
                <li
                  key={doel.id}
                  className={`ll-badge-kaart rating-${kleur ?? "empty"}${kleur ? "" : " is-open"}`}
                >
                  <div className="ll-badge-kop">
                    <div className="ll-badge-links">
                      <h3 className="ll-badge-tekst">{doel.omschrijving}</h3>
                      {wie && <span className="ll-badge-beoordelaar">Beoordeeld door {wie}</span>}
                    </div>
                    <Status kleur={kleur} />
                  </div>
                  {notitie && <MentorNotitie tekst={notitie} />}

                  {deel.length > 0 && (
                    <div className="ll-deelbadges">
                      <span className="ll-deelbadges-kop">
                        Deelbadges <span className="ll-teller">{deel.length}</span>
                      </span>
                      <ul aria-label={`Deelbadges bij ${doel.omschrijving}`}>
                        {deel.map((d) => {
                          const dn = getDeelNotitie(deelNotities, d.id, leerling.id).zichtbaar;
                          const deelKleur = getDeelKleur(deelKleuren, d.id, leerling.id);
                          const deelWie = deelKleur
                            ? beoordelaar(deelSleutel(d.id, leerling.id))
                            : null;
                          return (
                            <li key={d.id} className={`ll-deel rating-${deelKleur ?? "empty"}`}>
                              <span className="ll-bol" aria-hidden="true" />
                              <div className="ll-deel-midden">
                                <span className="ll-deel-titel">{d.titel}</span>
                                {(d.datum || deelWie) && (
                                  <span className="ll-deel-meta">
                                    {[d.datum && toonDatum(d.datum), deelWie]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                )}
                                {dn && <MentorNotitie tekst={dn} />}
                              </div>
                              <Status kleur={deelKleur} klein />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {rubrieken.length > 0 && (
        <section className="ll-rubrieken">
          <h2 className="ll-kop">Waar we op letten</h2>
          <p className="ll-rubrieken-uitleg">
            Zo ziet elke kleur eruit voor deze cursus. Tik een onderdeel open om het te lezen.
          </p>
          <div className="ll-rubrieken-lijst">
            {rubrieken.map((r) => (
              <details key={r.id} className="ll-rubriek-uit">
                <summary>
                  {r.naam.replace(/^\s*RUBRIC\s*\d*\s*[-–:.]?\s*/i, "") || r.naam}
                </summary>
                <dl className="rubriek-criteria">
                  {RUBRIEK_KLEUREN.map(({ key, klasse, label }) =>
                    r.criteria[key]?.trim() ? (
                      <div key={key} className={`rubriek-criterium rating-${klasse}`}>
                        <dt className="rubriek-criterium-kleur">{label}</dt>
                        <dd className="rubriek-criterium-tekst">{r.criteria[key]}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
