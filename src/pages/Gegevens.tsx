import { useState } from "react";
import { SlotIcoon } from "../components/SlotIcoon";
import { datumStempel, downloadTekst } from "../lib/download";
import { exportDoelen, exportEvaluaties, exportLeerlingen } from "../lib/gegevens";
import { alleMinimumdoelen, metWijzigingen } from "../lib/minimumdoelen";
import { HUIDIG_SCHOOLJAAR, SCHOOLJAREN, isAfgesloten } from "../lib/schooljaar";
import {
  gebundeldCurriculum,
  rubriekenLijst,
  useStore,
  vestigingenLijst,
  zetCurriculumOverride,
  zetRubriekenInDatabase,
  zetSchooljaarAfgesloten,
  zetVestigingenInDatabase,
} from "../lib/store";

type Melding = { soort: "ok" | "fout"; tekst: string; details?: string[] } | null;

/**
 * Gegevens (beheerder-only, `<AlleenBeheerder>`): schooljaren vastzetten, CSV-back-ups
 * downloaden, en de database-versie van badges / rubrics / vestigingen beheren en herstellen.
 */
export function Gegevens() {
  const {
    students,
    kleuren,
    doelWijzigingen,
    doelenImport,
    curriculumOverride,
    rubriekenOverride,
    vestigingen,
  } = useStore();
  const [melding, setMelding] = useState<Melding>(null);

  const doelen = metWijzigingen(doelenImport ?? alleMinimumdoelen, doelWijzigingen);

  return (
    <section>
      {melding && (
        <div className={`gegevens-melding ${melding.soort === "ok" ? "is-ok" : "is-fout"}`}>
          <strong>{melding.tekst}</strong>
          {melding.details && melding.details.length > 0 && (
            <ul>
              {melding.details.slice(0, 12).map((d, i) => (
                <li key={i}>{d}</li>
              ))}
              {melding.details.length > 12 && <li>… en {melding.details.length - 12} meer</li>}
            </ul>
          )}
        </div>
      )}

      <h2>Schooljaren vastzetten</h2>
      <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
        Sluit een voorbij schooljaar af (in september) zodat de evaluaties ervan alleen-lezen
        worden. De data blijft raadpleegbaar; heropenen kan indien er nog iets rechtgezet moet
        worden.
      </p>
      <ul className="gebruikers-lijst vestiging-lijst">
        {[...SCHOOLJAREN].reverse().map((sj) => {
          const dicht = isAfgesloten(sj);
          const lopend = sj === HUIDIG_SCHOOLJAAR;
          return (
            <li key={sj} className={`gebruikers-rij${dicht ? " is-inactief" : ""}`}>
              <span className="gebruikers-naam">{sj}</span>
              <span className="gebruikers-mail">
                {lopend ? "lopend schooljaar" : dicht ? "afgesloten — alleen-lezen" : "open"}
              </span>
              <span className="gebruikers-status">{dicht && <SlotIcoon />}</span>
              <span className="gebruikers-acties">
                <button
                  type="button"
                  className="linkknop"
                  onClick={() => {
                    if (
                      dicht ||
                      confirm(
                        `Schooljaar ${sj} afsluiten? De evaluaties worden alleen-lezen (heropenen kan later).`,
                      )
                    ) {
                      zetSchooljaarAfgesloten(sj, !dicht);
                    }
                  }}
                >
                  {dicht ? "Heropenen" : "Afsluiten"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <h2 style={{ marginTop: 32 }}>Exporteren</h2>
      <div className="gegevens-kaarten">
        <div className="gegevens-kaart">
          <div className="gegevens-kaart-naam">Evaluaties (back-up)</div>
          <p>Elke ingevulde kleur, per leerling / schooljaar / badge (ook de graadsbadges).</p>
          <button
            type="button"
            className="knop-primair"
            onClick={() =>
              downloadTekst(
                `keerpunt-evaluaties-${datumStempel()}.csv`,
                exportEvaluaties(students, kleuren),
              )
            }
          >
            Download CSV
          </button>
        </div>

        <div className="gegevens-kaart">
          <div className="gegevens-kaart-naam">Leerlingen</div>
          <p>{students.length} leerlingen — id, naam, vestiging, leerjaar, klasgroep.</p>
          <button
            type="button"
            className="knop-primair"
            onClick={() =>
              downloadTekst(`keerpunt-leerlingen-${datumStempel()}.csv`, exportLeerlingen(students))
            }
          >
            Download CSV
          </button>
        </div>

        <div className="gegevens-kaart">
          <div className="gegevens-kaart-naam">Doelen</div>
          <p>{doelen.length} minimumdoelen / eindtermen.</p>
          <button
            type="button"
            className="knop-primair"
            onClick={() =>
              downloadTekst(`keerpunt-doelen-${datumStempel()}.csv`, exportDoelen(doelen))
            }
          >
            Download CSV
          </button>
        </div>
      </div>

      <h2 style={{ marginTop: 32 }}>Badges, rubrics en vestigingen in de database</h2>
      <div className="gegevens-kaarten">
        <div className="gegevens-kaart">
          <div className="gegevens-kaart-naam">Database-versie wegschrijven</div>
          <p>
            De badges (<code>curriculum/…</code>), rubrics (<code>rubrieken/…</code>) en
            vestigingen (<code>vestigingen/…</code>) staan als losse documenten in Firestore en
            worden daar of in de app bewerkt. De app houdt de laatst ontvangen versie vast — bij
            een storing blijft ze daarmee werken in plaats van terug te vallen op de ingebouwde
            bundel.
          </p>
          <p>
            Een knop hieronder schrijft de versie die de app nu heeft naar de database: de laatst
            ontvangen database-versie, of de ingebouwde bundel als er nog geen database-versie is.
            Gebruik dit om ze de eerste keer klaar te zetten, of om na een probleem te herstellen.
            Staat de database al in orde, dan verandert er niets.
          </p>
          <p style={{ color: "var(--text-muted)" }}>
            Nu: badges <strong>{curriculumOverride ? "database" : "bundel"}</strong> · rubrics{" "}
            <strong>{rubriekenOverride ? "database" : "bundel"}</strong> · vestigingen{" "}
            <strong>{vestigingen ? "database" : "bundel"}</strong>
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className="knop-primair"
              onClick={() => {
                const set = curriculumOverride ?? gebundeldCurriculum();
                zetCurriculumOverride(set);
                setMelding({
                  soort: "ok",
                  tekst: `Badges weggeschreven: ${set.cursussen.length} cursussen, ${set.badges.length} badges.`,
                });
              }}
            >
              Badges wegschrijven
            </button>
            <button
              type="button"
              className="knop-primair"
              onClick={() => {
                zetRubriekenInDatabase();
                setMelding({
                  soort: "ok",
                  tekst: `Rubrics weggeschreven: ${rubriekenLijst().length} stuks.`,
                });
              }}
            >
              Rubrics wegschrijven
            </button>
            <button
              type="button"
              className="knop-primair"
              onClick={() => {
                zetVestigingenInDatabase();
                setMelding({
                  soort: "ok",
                  tekst: `Vestigingen weggeschreven: ${vestigingenLijst().length} stuks.`,
                });
              }}
            >
              Vestigingen wegschrijven
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
