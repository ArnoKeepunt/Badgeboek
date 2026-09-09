import { Link, useParams } from "react-router-dom";
import { Voortgangsring } from "../components/Voortgangsring";
import {
  cursussenVoorStroom,
  leerdoelenVoorCursus,
  leerdoelenVoorStroom,
} from "../lib/curriculum";
import { aantalBehaald, telKleuren } from "../lib/kleurstats";
import { stroomVan } from "../lib/leerlingen";
import { graadKleur, graadNotitie } from "../lib/leerlingVoortgang";
import { HUIDIG_SCHOOLJAAR } from "../lib/schooljaar";
import { useAangemeld } from "../lib/sessie";
import { RATING_LABEL } from "../lib/ratings";
import { getDeelKleur, getDeelNotitie, rubriekenLijst, useStore } from "../lib/store";
import type { Kleurcriteria, Rating } from "../lib/types";

/** De vier kleuren, positiefste eerst — met de sleutel in `Kleurcriteria` en de CSS-klasse. */
const RUBRIEK_KLEUREN: { key: keyof Kleurcriteria; klasse: string; label: string }[] = [
  { key: "blauw", klasse: "blue", label: "Blauw" },
  { key: "groen", klasse: "green", label: "Groen" },
  { key: "geel", klasse: "yellow", label: "Geel" },
  { key: "rood", klasse: "red", label: "Rood" },
];

/** Kleurvakje voor de leerling — zelfde stijl (rand + tint) als de cellen in de mentormatrix. */
function Status({ kleur }: { kleur: Rating | null }) {
  return (
    <span className={`ll-status rating-${kleur ?? "empty"}`}>
      {kleur ? RATING_LABEL[kleur] : "Nog niet beoordeeld"}
    </span>
  );
}

/**
 * Zichtbare mentoropmerking. Kort → gewoon meteen tonen; lang → inklapbaar (`<details>`),
 * want sommige mentoren schrijven een halve pagina.
 */
function MentorNotitie({ tekst }: { tekst: string }) {
  if (tekst.length <= 100) {
    return <p className="ll-badge-notitie">“{tekst}”</p>;
  }
  return (
    <details className="ll-notitie">
      <summary>Opmerking van de mentor</summary>
      <p className="ll-badge-notitie">“{tekst}”</p>
    </details>
  );
}

export function LeerlingCursus() {
  const { cursusId } = useParams();
  const { kleuren, notities, deelevaluaties, deelKleuren, deelNotities } = useStore();
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

  const badgeTekst = new Map(leerdoelenVoorStroom(stroom).map((d) => [d.id, d.omschrijving]));

  // De deelevaluaties die aan een badge van deze cursus hangen (elk één keer, alleen-lezen).
  // Nieuwste bovenaan; deelevaluaties zonder datum onderaan.
  const cursusDoelIds = new Set(doelen.map((d) => d.id));
  const deelVanCursus = deelevaluaties
    .filter(
      (d) =>
        d.schooljaar === HUIDIG_SCHOOLJAAR &&
        d.stroom === stroom &&
        d.leerdoelIds.some((id) => cursusDoelIds.has(id)),
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
        <div>
          <div className="ll-cursus-titel-rij">
            <h1>{cursus.naam}</h1>
          </div>
          <p>
            {doelen.length === 0
              ? "Voor deze cursus staan er nog geen badges klaar."
              : `${behaald} van ${doelen.length} behaald`}
          </p>
        </div>
        {doelen.length > 0 && <Voortgangsring behaald={behaald} totaal={doelen.length} />}
      </header>

      {doelen.length > 0 && (
        <section className="ll-rubriek">
          <div className="ll-badges">
            {doelen.map((doel) => {
              const notitie = graadNotitie(notities, leerling.id, doel.id);
              return (
                <div key={doel.id} className="ll-badge">
                  <div className="ll-badge-links">
                    <span className="ll-badge-tekst">{doel.omschrijving}</span>
                    {notitie && <MentorNotitie tekst={notitie} />}
                  </div>
                  <Status kleur={graadKleur(kleuren, leerling.id, doel.id)} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {rubrieken.length > 0 && (
        <section className="ll-deel-sectie ll-rubrieken">
          <h2>Waar we op letten</h2>
          <p className="ll-rubrieken-uitleg">
            Zo ziet elke kleur eruit voor deze cursus. Klik een onderdeel open om het te lezen.
          </p>
          {rubrieken.map((r) => (
            <details key={r.id} className="ll-rubriek-uit">
              <summary>{r.naam.replace(/^\s*RUBRIC\s*\d*\s*[-–:.]?\s*/i, "") || r.naam}</summary>
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
        </section>
      )}

      {deelVanCursus.length > 0 && (
        <section className="ll-deel-sectie">
          <h2>Recente deelbadges</h2>
          <ul className="ll-deel-lijst">
            {deelVanCursus.map((d) => {
              const dn = getDeelNotitie(deelNotities, d.id, leerling.id).zichtbaar;
              return (
                <li key={d.id} className="ll-deel">
                  <div className="ll-deel-links">
                    <span className="ll-deel-titel">{d.titel}</span>
                    {(d.datum || d.cursus) && (
                      <span className="ll-deel-meta">
                        {[d.datum, d.cursus].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {d.leerdoelIds.length > 0 && (
                      <div className="ll-deel-badges">
                        {d.leerdoelIds.map((id) => (
                          <span key={id} className="de-badge-chip" title={badgeTekst.get(id)}>
                            {badgeTekst.get(id) ?? "badge"}
                          </span>
                        ))}
                      </div>
                    )}
                    {dn && <MentorNotitie tekst={dn} />}
                  </div>
                  <Status kleur={getDeelKleur(deelKleuren, d.id, leerling.id)} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
