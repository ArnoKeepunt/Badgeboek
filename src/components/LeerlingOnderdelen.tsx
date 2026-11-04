import { cursusInitialen, cursusKleur } from "../lib/cursusKleur";
import type { KleurTelling } from "../lib/kleurstats";
import { RATINGS, RATING_LABEL } from "../lib/ratings";
import type { Rating } from "../lib/types";
import { TeLaatIcoon } from "./RatingCell";

/** Gekleurd icoontje met de initialen van een cursus (leerlingweergave). */
export function CursusIcoon({ id, naam, groot = false }: { id: string; naam: string; groot?: boolean }) {
  const { bg, fg } = cursusKleur(id);
  return (
    <span
      className={`ll-cursus-icoon${groot ? " is-groot" : ""}`}
      style={{ background: bg, color: fg }}
      aria-hidden="true"
    >
      {cursusInitialen(naam)}
    </span>
  );
}

/** Horizontale strook: hoeveel badges in welke kleur staan (+ nog niet beoordeeld). */
export function KleurStrook({ telling }: { telling: KleurTelling }) {
  return (
    <div className="ll-strook" aria-hidden="true">
      {RATINGS.map((r) =>
        telling[r] > 0 ? (
          <span key={r} className={`rating-${r}`} style={{ flexGrow: telling[r] }} />
        ) : null,
      )}
      {telling.leeg > 0 && <span className="ll-strook-leeg" style={{ flexGrow: telling.leeg }} />}
    </div>
  );
}

/** Legende bij een strook: een bolletje + aantal per kleur die voorkomt (geen "nog niet beoordeeld"). */
export function KleurLegende({ telling }: { telling: KleurTelling }) {
  return (
    <ul className="ll-legende">
      {RATINGS.map((r) =>
        telling[r] > 0 ? (
          <li key={r} className={`rating-${r}`}>
            <span className="ll-bol" />
            {telling[r]} {RATING_LABEL[r].toLowerCase()}
          </li>
        ) : null,
      )}
    </ul>
  );
}

/**
 * Kleurlabel (pil met bolletje) — zelfde tint als de cellen in de mentormatrix. `teLaat` zet er
 * een apart labeltje "Te laat ingediend" naast: de kleur blijft gewoon staan.
 */
export function Status({
  kleur,
  klein = false,
  teLaat = false,
}: {
  kleur: Rating | null;
  klein?: boolean;
  teLaat?: boolean;
}) {
  const pil = (
    <span className={`ll-status rating-${kleur ?? "empty"}${klein ? " is-klein" : ""}`}>
      {kleur && <span className="ll-bol" />}
      {kleur ? RATING_LABEL[kleur] : "Nog niet beoordeeld"}
    </span>
  );
  if (!teLaat) return pil;
  return (
    <span className="ll-status-groep">
      {pil}
      <span className={`ll-telaat${klein ? " is-klein" : ""}`}>
        <TeLaatIcoon />
        Te laat ingediend
      </span>
    </span>
  );
}
