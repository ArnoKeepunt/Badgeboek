import { Link, useParams } from "react-router-dom";
import { Voortgangsring } from "../components/Voortgangsring";
import {
  cursussenVoorStroom,
  leerdoelenVoorCursus,
  leerdoelenVoorStroom,
  rubricsVoorCursus,
  subgroepenVoorRubric,
} from "../lib/curriculum";
import { aantalBehaald, telKleuren } from "../lib/kleurstats";
import { stroomVan } from "../lib/leerlingen";
import { graadKleur, graadNotitie } from "../lib/leerlingVoortgang";
import { HUIDIG_SCHOOLJAAR } from "../lib/schooljaar";
import { useAangemeld } from "../lib/sessie";
import { RATING_LABEL } from "../lib/ratings";
import { getDeelKleur, getDeelNotitie, useStore } from "../lib/store";
import type { Rating } from "../lib/types";

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

const subgroepSleutel = (rubricId: string, naam: string) => `${rubricId}|${naam}`;

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

  const doelen = leerdoelenVoorCursus(cursus.id);
  const telling = telKleuren(doelen.map((d) => graadKleur(kleuren, leerling.id, d.id)));
  // "Behaald" = de badge staat op groen of blauw. Geel/rood tellen niet mee.
  const behaald = aantalBehaald(telling);

  // De graadsbadge: dezelfde kleur die de mentor op cursusniveau kan zetten sinds de periode-as
  // weg is (bv. op "Basisvaardigheden"). Rubric- en subgroepniveau hebben zo'n subgraadbadge.
  const cursusKleur = graadKleur(kleuren, leerling.id, cursus.id);
  const cursusNotitie = graadNotitie(notities, leerling.id, cursus.id);

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
            {cursusKleur && <Status kleur={cursusKleur} />}
          </div>
          <p>
            {doelen.length === 0
              ? "Voor deze cursus staan er nog geen badges klaar."
              : `${behaald} van ${doelen.length} behaald`}
          </p>
          {cursusNotitie && <MentorNotitie tekst={cursusNotitie} />}
        </div>
        {doelen.length > 0 && <Voortgangsring behaald={behaald} totaal={doelen.length} />}
      </header>

      {rubricsVoorCursus(cursus.id).map((rubric, _i, alle) => {
        // Eén rubriek = overbodig tussenniveau — net als in de mentormatrix geen eigen kop
        // (en dus ook geen apart subgraadbadge-plekje op dat niveau).
        const meerdereRubrics = alle.length > 1;
        const rubricKleur = graadKleur(kleuren, leerling.id, rubric.id);
        const rubricNotitie = graadNotitie(notities, leerling.id, rubric.id);
        return (
          <section key={rubric.id} className="ll-rubriek">
            {meerdereRubrics && (
              <div className="ll-rubriek-kop">
                <h2>{rubric.naam}</h2>
                {rubricKleur && <Status kleur={rubricKleur} />}
              </div>
            )}
            {meerdereRubrics && rubricNotitie && <MentorNotitie tekst={rubricNotitie} />}

            {subgroepenVoorRubric(rubric.id).map((groep) => {
              const sgKleur = groep.naam
                ? graadKleur(kleuren, leerling.id, subgroepSleutel(rubric.id, groep.naam))
                : null;
              return (
                <div
                  key={groep.naam ? subgroepSleutel(rubric.id, groep.naam) : `${rubric.id}|los`}
                  className={`ll-subgroep-blok${groep.naam ? " heeft-naam" : ""}`}
                >
                  {groep.naam && (
                    <div className="ll-subgroep-kop">
                      <h3>{groep.naam}</h3>
                      {sgKleur && <Status kleur={sgKleur} />}
                    </div>
                  )}
                  <div className="ll-badges">
                    {groep.leerdoelen.map((doel) => {
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
                </div>
              );
            })}
          </section>
        );
      })}

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
