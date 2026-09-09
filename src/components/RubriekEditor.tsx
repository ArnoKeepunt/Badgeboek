import { useState } from "react";
import { RATING_LABEL } from "../lib/ratings";
import { herstelRubriek, rubriekIsBewerkt, useStore, wijzigRubriek } from "../lib/store";
import type { Kleurcriteria, Rubriek } from "../lib/types";

const NAAM_MAX = 120;

/** Rubrics beschrijven enkel de vier kleuren (geen witte statussen). */
const KLEUREN = ["blue", "green", "yellow", "red"] as const;

/** Kleur → sleutel in `Kleurcriteria`. */
const KLEUR_KEY: Record<(typeof KLEUREN)[number], keyof Kleurcriteria> = {
  red: "rood",
  yellow: "geel",
  green: "groen",
  blue: "blauw",
};

/**
 * Formulier om één uitgeschreven rubric te bewerken (alleen voor de beheerder). Cursus en
 * stroom liggen vast; naam, doelen, de vier kleurcriteria en de leerlijntekst zijn bewerkbaar.
 * Zonder database-versie gebeurt bewaren als patch bovenop de brontekst (`rubriekWijzigingen`),
 * zodat een nieuwe generatie van het bronbestand de bewerking niet wist. Staat de rubriekenlijst
 * wél in de database, dan schrijft `wijzigRubriek` rechtstreeks naar het `rubrieken/{id}`-doc.
 */
export function RubriekEditor({ rubriek, onSluit }: { rubriek: Rubriek; onSluit: () => void }) {
  // Op de store abonneren zodat de "bewerkt"-status meebeweegt.
  useStore();
  const isBewerkt = rubriekIsBewerkt(rubriek.id);

  const [naam, setNaam] = useState(rubriek.naam);
  const [doelen, setDoelen] = useState(rubriek.doelen.join(", "));
  const [criteria, setCriteria] = useState<Kleurcriteria>(rubriek.criteria);
  const [leerlijn, setLeerlijn] = useState(rubriek.leerlijn);

  const zetCriterium = (sleutel: keyof Kleurcriteria, waarde: string) =>
    setCriteria((c) => ({ ...c, [sleutel]: waarde }));

  const bewaar = () => {
    wijzigRubriek(rubriek.id, {
      naam: naam.trim() || rubriek.naam,
      doelen: doelen
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
      criteria,
      leerlijn: leerlijn.trim(),
    });
    onSluit();
  };

  return (
    <div className="de-editor">
      <h2>Rubric bewerken</h2>
      <p className="rubriek-editor-context">
        {rubriek.cursus} · {rubriek.stroom}
      </p>

      <label className="de-veld">
        <span>
          Naam van de rubric
          <span className="de-veld-tel">
            {naam.length}/{NAAM_MAX}
          </span>
        </span>
        <input maxLength={NAAM_MAX} value={naam} onChange={(e) => setNaam(e.target.value)} />
      </label>

      <label className="de-veld">
        <span>Doelen — codes, gescheiden door komma's</span>
        <textarea
          rows={2}
          value={doelen}
          onChange={(e) => setDoelen(e.target.value)}
          placeholder="bv. 16.01, 16.02, BG04.02"
        />
      </label>

      {KLEUREN.map((kleur) => (
        <label key={kleur} className="de-veld">
          <span>
            <span className={`rubriek-editor-kleur rating-${kleur}`}>{RATING_LABEL[kleur]}</span>
          </span>
          <textarea
            rows={3}
            value={criteria[KLEUR_KEY[kleur]]}
            onChange={(e) => zetCriterium(KLEUR_KEY[kleur], e.target.value)}
          />
        </label>
      ))}

      <label className="de-veld">
        <span>Leerlijn (waar komt de leerling vandaan, waar gaat het naartoe)</span>
        <textarea
          rows={6}
          value={leerlijn}
          onChange={(e) => setLeerlijn(e.target.value)}
          placeholder="Laat leeg om geen leerlijntekst te tonen."
        />
      </label>

      <div className="de-editor-acties">
        <button type="button" className="knop-primair" onClick={bewaar}>
          Opslaan
        </button>
        <button type="button" className="linkknop" onClick={onSluit}>
          Annuleren
        </button>
        {isBewerkt && (
          <button
            type="button"
            className="linkknop linkknop-gevaar de-editor-verwijder"
            onClick={() => {
              if (confirm("De bewerkingen van deze rubric ongedaan maken?")) {
                herstelRubriek(rubriek.id);
                onSluit();
              }
            }}
          >
            Terug naar de brontekst
          </button>
        )}
      </div>
    </div>
  );
}
