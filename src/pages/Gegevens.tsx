import { useState } from "react";
import { NavLink } from "react-router-dom";
import { SlotIcoon } from "../components/SlotIcoon";
import { datumStempel, downloadTekst } from "../lib/download";
import {
  exportDoelen,
  exportEvaluaties,
  exportLeerlingen,
  exportRubrieken,
  importLeerlingen,
  importRubrieken,
} from "../lib/gegevens";
import { alleMinimumdoelen, metWijzigingen } from "../lib/minimumdoelen";
import { HUIDIG_SCHOOLJAAR, SCHOOLJAREN, isAfgesloten } from "../lib/schooljaar";
import {
  gebundeldCurriculum,
  rubriekenLijst,
  upsertStudenten,
  useStore,
  vestigingenLijst,
  wisRubriekenOverride,
  zetCurriculumOverride,
  zetRubriekenInDatabase,
  zetRubriekenUitImport,
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
    schooljaar,
    doelWijzigingen,
    doelenImport,
    curriculumOverride,
    rubriekenOverride,
    vestigingen,
  } = useStore();
  const [melding, setMelding] = useState<Melding>(null);

  const doelen = metWijzigingen(doelenImport ?? alleMinimumdoelen, doelWijzigingen);

  /**
   * De database-versie wegschrijven overschrijft wat er in Firestore staat met de kopie die
   * deze app vasthoudt — dus achter een dubbele bevestiging, zodat het niet "voor de zekerheid"
   * gebeurt terwijl de app een verouderde of halve versie vasthoudt.
   */
  const bevestigWegschrijven = (wat: string, uitvoeren: () => void) => {
    if (
      !confirm(
        `${wat} naar de database schrijven?\n\nDit overschrijft wat er nu in Firestore staat met de versie die deze app op dit moment vasthoudt.`,
      )
    )
      return;
    if (
      !confirm(
        `Zeker weten? Doe dit alleen als je wéét dat de database-versie fout of leeg is — niet "voor de zekerheid". Bij twijfel: eerst een CSV-back-up downloaden.`,
      )
    )
      return;
    uitvoeren();
  };

  /**
   * Terug naar de bundel wist de database-versie (Firestore-docs verdwijnen bij de volgende
   * save) — nodig omdat "wegschrijven" hierboven de HUIDIGE (database- of bundel-)versie
   * herschrijft: staat er al een database-versie, dan overschrijft die knop zichzelf en komt
   * een nieuwe/aangepaste bundel (bv. na een nieuwe rubrics_overzicht.xlsx) er niet doorheen
   * zonder eerst hier te resetten.
   */
  const bevestigWissen = (wat: string, uitvoeren: () => void) => {
    if (
      !confirm(
        `${wat}: terug naar de ingebouwde bundel?\n\nDit wist de database-versie in Firestore — iedereen valt dan terug op de bundel die in de app zelf zit.`,
      )
    )
      return;
    uitvoeren();
  };

  /**
   * Leerlingen importeren is een upsert (op `id`) — bestaande leerlingen die niet in het
   * bestand staan, blijven gewoon staan. Rechtstreeks bedoeld voor de échte leerlingendata,
   * los van de Smartschool-synchronisatie (die er misschien voorlopig niet komt).
   */
  const importeerLeerlingenBestand = async (input: HTMLInputElement) => {
    const bestand = input.files?.[0];
    input.value = ""; // zelfde bestand nog eens kiezen moet opnieuw een change-event geven
    if (!bestand) return;
    const tekst = await bestand.text();
    const { rijen, fouten } = importLeerlingen(tekst);
    if (rijen.length === 0) {
      setMelding({ soort: "fout", tekst: `Geen leerlingen gevonden in "${bestand.name}".`, details: fouten });
      return;
    }
    if (
      !confirm(
        `${rijen.length} leerling(en) uit "${bestand.name}" importeren?\n\nBestaande leerlingen met dezelfde id worden bijgewerkt; leerlingen die niet in het bestand staan, blijven gewoon staan.`,
      )
    ) {
      return;
    }
    const { toegevoegd, bijgewerkt } = upsertStudenten(rijen);
    setMelding({
      soort: "ok",
      tekst: `Leerlingen geïmporteerd: ${toegevoegd} nieuw, ${bijgewerkt} bijgewerkt.`,
      details: fouten.length > 0 ? fouten : undefined,
    });
  };

  /**
   * Rubrics importeren zet de geïmporteerde lijst meteen als nieuwe databaseversie (zelfde
   * effect als "Rubrics wegschrijven" hieronder, maar met de net geüploade data i.p.v. de
   * huidige bundel/database-stand) — vandaar dezelfde dubbele bevestiging.
   */
  const importeerRubricsBestand = async (input: HTMLInputElement) => {
    const bestand = input.files?.[0];
    input.value = "";
    if (!bestand) return;
    const tekst = await bestand.text();
    const { rijen, fouten } = importRubrieken(tekst);
    if (rijen.length === 0) {
      setMelding({ soort: "fout", tekst: `Geen rubrics gevonden in "${bestand.name}".`, details: fouten });
      return;
    }
    const perStroom = new Map<string, number>();
    for (const r of rijen) perStroom.set(r.stroom, (perStroom.get(r.stroom) ?? 0) + 1);
    const samenvatting = [...perStroom.entries()].map(([s, n]) => `${s}: ${n}`).join(", ");
    bevestigWegschrijven(`Rubrics (${rijen.length} stuks uit "${bestand.name}": ${samenvatting})`, () => {
      zetRubriekenUitImport(rijen);
      setMelding({
        soort: "ok",
        tekst: `Rubrics geïmporteerd: ${rijen.length} stuks (${samenvatting}).`,
        details: fouten.length > 0 ? fouten : undefined,
      });
    });
  };

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
          <p>
            Elke ingevulde kleur, per leerling / badge — voor het <strong>geopende schooljaar
            ({schooljaar})</strong>. Kies bovenaan een ander schooljaar om dat te downloaden.
          </p>
          <button
            type="button"
            className="knop-primair"
            onClick={() =>
              downloadTekst(
                `keerpunt-evaluaties-${schooljaar}-${datumStempel()}.csv`,
                exportEvaluaties(students, kleuren, schooljaar),
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

      <h2 style={{ marginTop: 32 }}>Importeren</h2>
      <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
        Rechtstreeks vanuit de browser, geen script nodig. Bestanden zijn <strong>CSV</strong>
        (geen xlsx) — sla een Excel-/Numbers-bestand eerst op als CSV.
      </p>
      <div className="gegevens-kaarten">
        <div className="gegevens-kaart">
          <div className="gegevens-kaart-naam">Leerlingen</div>
          <p>
            De échte leerlingendata (upsert op <code>id</code>) — los van of we straks nog
            overstappen op een Smartschool-synchronisatie. Kolommen: <code>id, voornaam,
            achternaam, vestiging, leerjaar, klasgroep</code>. <code>id</code> is <strong>verplicht
            en moet een nummer zijn</strong> (het stamnummer/leerlingnummer — nooit een naam), en
            bepaalt bij een volgend bestand of een leerling bijgewerkt wordt of nieuw is. Zet die
            kolom in Excel/Numbers als <strong>tekst</strong> op (niet als getal), anders vallen
            voorloopnullen weg of verschijnt er "12345.0". Bestaande leerlingen die niet in het
            bestand staan, blijven gewoon staan.
          </p>
          <label className="knop-secundair gegevens-upload-knop">
            CSV kiezen…
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void importeerLeerlingenBestand(e.currentTarget)}
            />
          </label>
        </div>

        <div className="gegevens-kaart">
          <div className="gegevens-kaart-naam">Rubrics</div>
          <p>
            Voor terwijl de rubrics nog volop in ontwikkeling zijn — een nieuwe versie
            rechtstreeks uploaden i.p.v. mij een nieuwe <code>rubrics_overzicht.xlsx</code> te
            geven. Kolommen: <code>cursus, stroom, naam, doelen, blauw, groen, geel, rood,
            leerlijn</code> (<code>doelen</code> komma-gescheiden). Wordt meteen de nieuwe
            databaseversie, net als "Rubrics wegschrijven" hieronder.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label className="knop-secundair gegevens-upload-knop">
              CSV kiezen…
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void importeerRubricsBestand(e.currentTarget)}
              />
            </label>
            <button
              type="button"
              className="linkknop"
              onClick={() =>
                downloadTekst(
                  `keerpunt-rubrics-${datumStempel()}.csv`,
                  exportRubrieken(rubriekenLijst()),
                )
              }
            >
              Sjabloon downloaden
            </button>
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: 32 }}>Badges, rubrics en vestigingen in de database</h2>
      <div className="gegevens-kaarten">
        <div className="gegevens-kaart">
          <div className="gegevens-kaart-naam">Database-versie wegschrijven</div>
          <p>
            De badges (<code>curriculum/…</code>), rubrics (<code>rubrieken/…</code>) en
            vestigingen (<code>vestigingen/…</code>) staan als losse documenten in Firestore. De
            app houdt de laatst ontvangen versie vast — bij een storing blijft ze daarmee werken
            in plaats van terug te vallen op de ingebouwde bundel. Een badge zelf hernoemen,
            toevoegen of verwijderen doe je bij <NavLink to="/badges-beheer">Badges beheren</NavLink>.
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
              onClick={() =>
                bevestigWegschrijven("Badges", () => {
                  const set = curriculumOverride ?? gebundeldCurriculum();
                  zetCurriculumOverride(set);
                  setMelding({
                    soort: "ok",
                    tekst: `Badges weggeschreven: ${set.cursussen.length} cursussen, ${set.badges.length} badges.`,
                  });
                })
              }
            >
              Badges wegschrijven
            </button>
            <button
              type="button"
              className="knop-primair"
              onClick={() =>
                bevestigWegschrijven("Rubrics", () => {
                  zetRubriekenInDatabase();
                  setMelding({
                    soort: "ok",
                    tekst: `Rubrics weggeschreven: ${rubriekenLijst().length} stuks.`,
                  });
                })
              }
            >
              Rubrics wegschrijven
            </button>
            {rubriekenOverride && (
              <button
                type="button"
                className="knop-secundair"
                onClick={() =>
                  bevestigWissen("Rubrics", () => {
                    wisRubriekenOverride();
                    setMelding({
                      soort: "ok",
                      tekst: "Rubrics: database-versie gewist, terug op de ingebouwde bundel.",
                    });
                  })
                }
              >
                Rubrics: terug naar de bundel
              </button>
            )}
            <button
              type="button"
              className="knop-primair"
              onClick={() =>
                bevestigWegschrijven("Vestigingen", () => {
                  zetVestigingenInDatabase();
                  setMelding({
                    soort: "ok",
                    tekst: `Vestigingen weggeschreven: ${vestigingenLijst().length} stuks.`,
                  });
                })
              }
            >
              Vestigingen wegschrijven
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
