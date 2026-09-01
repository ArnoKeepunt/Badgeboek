import { useRef, useState } from "react";
import { datumStempel, downloadTekst } from "../lib/download";
import {
  exportDoelen,
  exportEvaluaties,
  exportLeerlingen,
  importDoelen,
  importGebruikers,
  importLeerlingen,
} from "../lib/gegevens";
import { alleMinimumdoelen, metWijzigingen } from "../lib/minimumdoelen";
import { importeerGebruikers, upsertStudenten, useStore, zetDoelenImport } from "../lib/store";

type Melding = { soort: "ok" | "fout"; tekst: string; details?: string[] } | null;

/**
 * Gegevens: alles in en uit de app via CSV. Geen backend — de export is meteen de
 * "download op elk moment"-back-up van de evaluaties.
 */
export function Gegevens() {
  const { students, mentoren, kleuren, doelWijzigingen, doelenImport } = useStore();
  const [melding, setMelding] = useState<Melding>(null);

  const doelen = metWijzigingen(doelenImport ?? alleMinimumdoelen, doelWijzigingen);

  const gebruikerInput = useRef<HTMLInputElement>(null);
  const leerlingInput = useRef<HTMLInputElement>(null);
  const doelInput = useRef<HTMLInputElement>(null);

  const lees = (bestand: File, klaar: (tekst: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => klaar(String(reader.result ?? ""));
    reader.onerror = () => setMelding({ soort: "fout", tekst: "Kon het bestand niet lezen." });
    reader.readAsText(bestand, "utf-8");
  };

  const importeerGebruikersBestand = (bestand: File) => {
    lees(bestand, (tekst) => {
      const { leerlingen, mentoren: nieuweMentoren, fouten } = importGebruikers(tekst);
      if (leerlingen.length === 0 && nieuweMentoren.length === 0) {
        setMelding({ soort: "fout", tekst: "Geen gebruikers ingeladen.", details: fouten });
        return;
      }
      importeerGebruikers(leerlingen, nieuweMentoren);
      setMelding({
        soort: "ok",
        tekst: `${leerlingen.length} leerlingen en ${nieuweMentoren.length} mentoren ingeladen (op id).`,
        details: fouten,
      });
    });
  };

  const importeerLeerlingen = (bestand: File) => {
    lees(bestand, (tekst) => {
      const { rijen, fouten } = importLeerlingen(tekst);
      if (rijen.length === 0) {
        setMelding({ soort: "fout", tekst: "Geen leerlingen ingeladen.", details: fouten });
        return;
      }
      upsertStudenten(rijen);
      setMelding({
        soort: "ok",
        tekst: `${rijen.length} leerlingen ingeladen (toegevoegd of bijgewerkt op id).`,
        details: fouten,
      });
    });
  };

  const importeerDoelen = (bestand: File) => {
    lees(bestand, (tekst) => {
      const { rijen, fouten } = importDoelen(tekst);
      if (rijen.length === 0) {
        setMelding({ soort: "fout", tekst: "Geen doelen ingeladen.", details: fouten });
        return;
      }
      zetDoelenImport(rijen);
      setMelding({
        soort: "ok",
        tekst: `${rijen.length} doelen ingeladen. De vorige doelenlijst is vervangen.`,
        details: fouten,
      });
    });
  };

  return (
    <section>
      <h1>Gegevens</h1>
      <p style={{ color: "var(--text-muted)" }}>
        In- en uitvoer via CSV (met <code>;</code> als scheidingsteken; <code>,</code> wordt ook
        gelezen). De leerling-<strong>id</strong> is de vaste sleutel: bij een naams- of
        klaswissel of jaarovergang blijven de evaluaties gekoppeld.
      </p>

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

      <h2>Exporteren</h2>
      <div className="gegevens-kaarten">
        <div className="gegevens-kaart">
          <div className="gegevens-kaart-naam">Evaluaties (back-up)</div>
          <p>Elke ingevulde kleur, per leerling / schooljaar / periode / badge.</p>
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

      <h2 style={{ marginTop: 32 }}>Importeren</h2>
      <div className="gegevens-kaarten">
        <div className="gegevens-kaart">
          <div className="gegevens-kaart-naam">Gebruikers (leerlingen + mentoren)</div>
          <p>
            Kolommen: <code>gebruikersnaam, voornaam, naam, basisrol, vestiging, leerjaar,
            e-mail, wachtwoord</code>. <code>basisrol</code> = leerling of mentor; <code>leerjaar</code>
            zoals <code>4A</code>. Nu: {students.length} leerlingen, {mentoren.length} mentoren.
          </p>
          <input
            ref={gebruikerInput}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importeerGebruikersBestand(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="knop-primair"
            onClick={() => gebruikerInput.current?.click()}
          >
            Kies CSV-bestand
          </button>
        </div>

        <div className="gegevens-kaart">
          <div className="gegevens-kaart-naam">Leerlingen</div>
          <p>
            Kolommen: <code>id, voornaam, achternaam, vestiging, leerjaar, klasgroep</code>.
            Bestaande id's worden bijgewerkt, nieuwe toegevoegd, de rest blijft staan.
          </p>
          <input
            ref={leerlingInput}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importeerLeerlingen(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="knop-primair"
            onClick={() => leerlingInput.current?.click()}
          >
            Kies CSV-bestand
          </button>
        </div>

        <div className="gegevens-kaart">
          <div className="gegevens-kaart-naam">Doelen</div>
          <p>
            Kolommen: <code>code, omschrijving</code> verplicht; <code>stroom, competentie,
            nummer, soort, uitleg, opmerking</code> optioneel. Vervangt de volledige doelenlijst.
          </p>
          <input
            ref={doelInput}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importeerDoelen(f);
              e.target.value = "";
            }}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="knop-primair"
              onClick={() => doelInput.current?.click()}
            >
              Kies CSV-bestand
            </button>
            {doelenImport && (
              <button
                type="button"
                className="linkknop"
                onClick={() => {
                  zetDoelenImport(null);
                  setMelding({ soort: "ok", tekst: "Terug naar de standaard doelenlijst." });
                }}
              >
                Herstel standaardlijst
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
