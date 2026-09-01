import { Link, useParams } from "react-router-dom";
import { Voortgangsring } from "../components/Voortgangsring";
import {
  cursussenVoorStroom,
  leerdoelenVoorCursus,
  leerdoelenVoorRubric,
  rubricsVoorCursus,
} from "../lib/curriculum";
import { telKleuren } from "../lib/kleurstats";
import { stroomVan } from "../lib/leerlingen";
import { graadKleur, graadNotitie } from "../lib/leerlingVoortgang";
import { useAangemeld } from "../lib/sessie";
import { useStore } from "../lib/store";
import type { Rating } from "../lib/types";

const STATUS: Record<string, { klasse: string; tekst: string }> = {
  blue: { klasse: "st-blauw", tekst: "Blauw" },
  green: { klasse: "st-groen", tekst: "Groen" },
  yellow: { klasse: "st-geel", tekst: "Geel" },
  red: { klasse: "st-rood", tekst: "Rood" },
  leeg: { klasse: "st-leeg", tekst: "Nog niet gestart" },
};

function Status({ kleur }: { kleur: Rating | null }) {
  const s = STATUS[kleur ?? "leeg"];
  return <span className={`ll-status ${s.klasse}`}>{s.tekst}</span>;
}

export function LeerlingCursus() {
  const { cursusId } = useParams();
  const { kleuren, notities } = useStore();
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
  const cursus = cursussenVoorStroom(stroomVan(leerling)).find((c) => c.id === cursusId);

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
  const inOrde = telling.green + telling.blue;

  return (
    <div className="ll-cursus">
      <Link to="/" className="ll-terug">
        ← Mijn badges
      </Link>

      <header className="ll-cursus-hero">
        <div>
          <h1>{cursus.naam}</h1>
          <p>
            {doelen.length === 0
              ? "Voor deze cursus staan er nog geen badges klaar."
              : `${inOrde} van ${doelen.length} in orde`}
          </p>
        </div>
        <Voortgangsring behaald={inOrde} totaal={doelen.length} groot />
      </header>

      {rubricsVoorCursus(cursus.id).map((rubric) => {
        const rd = leerdoelenVoorRubric(rubric.id);
        return (
          <section key={rubric.id} className="ll-rubriek">
            <h2>{rubric.naam}</h2>
            <div className="ll-badges">
              {rd.map((doel) => {
                const notitie = graadNotitie(notities, leerling.id, doel.id);
                return (
                  <div key={doel.id} className="ll-badge">
                    <div className="ll-badge-links">
                      <span className="ll-badge-tekst">{doel.omschrijving}</span>
                      {notitie && <p className="ll-badge-notitie">“{notitie}”</p>}
                    </div>
                    <Status kleur={graadKleur(kleuren, leerling.id, doel.id)} />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
