import { useEffect, useMemo, useState } from "react";
import { PERSISTENTIE_MODUS, abonneerGebruikers, schrijfGebruiker } from "../lib/data";
import type { Personeelslid } from "../lib/gebruikers";
import {
  hernoemVestiging,
  ongekoppeldeVestigingen,
  useStore,
  verwijderVestiging,
  vestigingInGebruik,
  vestigingenLijst,
  voegVestigingToe,
  zetVestigingActief,
} from "../lib/store";

/**
 * Beheer van de vestigingen (campussen) — beheerder-only. Toevoegen, hernoemen, (de)activeren
 * en verwijderen. Leerlingen/mentoren/deelbadges bewaren de vestiging op naam; bij hernoemen
 * loopt er een cascade over alle betrokken documenten (ook de personeelsaccounts).
 */
export function Vestigingen() {
  // useStore() zodat de pagina hertekent bij elke wijziging aan de lijst.
  useStore();
  const lijst = vestigingenLijst();
  const ongekoppeld = ongekoppeldeVestigingen();
  const [nieuw, setNieuw] = useState("");
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [bewerkNaam, setBewerkNaam] = useState("");
  const [verwijderId, setVerwijderId] = useState<string | null>(null);
  const [melding, setMelding] = useState("");
  const [personeel, setPersoneel] = useState<Personeelslid[]>([]);

  useEffect(() => {
    if (PERSISTENTIE_MODUS !== "firebase") return;
    return abonneerGebruikers((l) => setPersoneel(l));
  }, []);

  const gebruik = useMemo(() => {
    const m = new Map<string, ReturnType<typeof vestigingInGebruik> & { personeel: number }>();
    for (const v of lijst) {
      m.set(v.id, {
        ...vestigingInGebruik(v.naam),
        personeel: personeel.filter((p) => p.vestiging === v.naam).length,
      });
    }
    return m;
  }, [lijst, personeel]);

  const voegToe = () => {
    if (voegVestigingToe(nieuw)) {
      setMelding(`Vestiging "${nieuw.trim()}" toegevoegd.`);
      setNieuw("");
    } else {
      setMelding("Die naam bestaat al of is leeg.");
    }
  };

  const bewaarHernoem = async (id: string, oudeNaam: string) => {
    const naam = bewerkNaam.trim();
    if (!hernoemVestiging(id, naam)) {
      setMelding("Hernoemen mislukt (lege of dubbele naam).");
      return;
    }
    // Personeelsaccounts staan buiten de store — die hier meenemen.
    if (PERSISTENTIE_MODUS === "firebase") {
      const raak = personeel.filter((p) => p.vestiging === oudeNaam);
      await Promise.all(raak.map((p) => schrijfGebruiker({ ...p, vestiging: naam })));
    }
    setMelding(`"${oudeNaam}" hernoemd naar "${naam}".`);
    setBewerkId(null);
  };

  const bevestigVerwijder = (id: string, naam: string) => {
    if (verwijderVestiging(id)) {
      setMelding(`"${naam}" verwijderd.`);
    } else {
      setMelding(`"${naam}" is nog in gebruik — deactiveer ze in plaats van te verwijderen.`);
    }
    setVerwijderId(null);
  };

  return (
    <section>
      <div className="pagina-kop">
        <h2>Vestigingen</h2>
      </div>
      <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
        De campussen van Keerpunt. Leerlingen, mentoren en deelbadges worden aan een vestiging
        gekoppeld. Werkt een vestiging niet meer? <strong>Deactiveer</strong> ze — dan verdwijnt
        ze uit de keuzelijsten maar blijft alle bestaande data en geschiedenis kloppen.
        Verwijderen is bijna nooit nodig en niet omkeerbaar.
      </p>

      {melding && <div className="gegevens-melding is-ok">{melding}</div>}

      <div className="vestiging-nieuw">
        <input
          value={nieuw}
          placeholder="Naam van de nieuwe vestiging"
          onChange={(e) => setNieuw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && voegToe()}
        />
        <button type="button" className="knop-primair" onClick={voegToe} disabled={!nieuw.trim()}>
          + Toevoegen
        </button>
      </div>

      {ongekoppeld.length > 0 && (
        <div className="gegevens-melding">
          <strong>Niet in de lijst:</strong> deze vestigingnamen staan wel op data maar niet
          hierboven —{" "}
          {ongekoppeld.map((n, i) => (
            <span key={n}>
              {i > 0 && ", "}
              <button
                type="button"
                className="linkknop"
                onClick={() => {
                  voegVestigingToe(n);
                  setMelding(`"${n}" toegevoegd aan de lijst.`);
                }}
              >
                {n} toevoegen
              </button>
            </span>
          ))}
        </div>
      )}

      <ul className="gebruikers-lijst vestiging-lijst">
        {lijst.map((v) => {
          const g = gebruik.get(v.id);
          const totaal = g ? g.leerlingen + g.mentoren + g.deelbadges + g.personeel : 0;
          return (
            <li key={v.id} className={`gebruikers-rij${v.actief ? "" : " is-inactief"}`}>
              {verwijderId === v.id ? (
                <div className="vestiging-gevaar">
                  <p>
                    <strong>“{v.naam}” definitief verwijderen?</strong> Dit doe je bijna nooit.
                    Het kan niet ongedaan gemaakt worden, en bestaande filters of verwijzingen
                    naar deze naam kunnen breken.{" "}
                    {totaal > 0
                      ? `Er hangen nog ${totaal} items aan deze vestiging — verwijderen kan niet. Deactiveer ze.`
                      : "Wil je ze gewoon uit de keuzelijsten? Deactiveer ze dan."}
                  </p>
                  <div className="gebruikers-acties">
                    <button
                      type="button"
                      className="knop-secundair"
                      onClick={() => {
                        zetVestigingActief(v.id, false);
                        setVerwijderId(null);
                        setMelding(`"${v.naam}" gedeactiveerd.`);
                      }}
                    >
                      Deactiveren (aanbevolen)
                    </button>
                    <button
                      type="button"
                      className="linkknop linkknop-gevaar"
                      disabled={totaal > 0}
                      onClick={() => bevestigVerwijder(v.id, v.naam)}
                    >
                      Toch definitief verwijderen
                    </button>
                    <button
                      type="button"
                      className="linkknop"
                      onClick={() => setVerwijderId(null)}
                    >
                      Annuleren
                    </button>
                  </div>
                </div>
              ) : bewerkId === v.id ? (
                <>
                  <input
                    className="vestiging-bewerk-veld"
                    value={bewerkNaam}
                    autoFocus
                    onChange={(e) => setBewerkNaam(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void bewaarHernoem(v.id, v.naam)}
                  />
                  <span className="gebruikers-acties">
                    <button
                      type="button"
                      className="linkknop"
                      onClick={() => void bewaarHernoem(v.id, v.naam)}
                    >
                      Bewaren
                    </button>
                    <button type="button" className="linkknop" onClick={() => setBewerkId(null)}>
                      Annuleren
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span className="gebruikers-naam">{v.naam}</span>
                  <span className="gebruikers-mail">
                    {totaal === 0
                      ? "geen gekoppelde data"
                      : [
                          g?.leerlingen && `${g.leerlingen} leerlingen`,
                          g?.mentoren && `${g.mentoren} mentoren`,
                          g?.personeel && `${g.personeel} accounts`,
                          g?.deelbadges && `${g.deelbadges} deelbadges`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </span>
                  <span className="gebruikers-status">{v.actief ? "actief" : "inactief"}</span>
                  <span className="gebruikers-acties">
                    <button
                      type="button"
                      className="linkknop"
                      onClick={() => {
                        setBewerkId(v.id);
                        setBewerkNaam(v.naam);
                      }}
                    >
                      Hernoemen
                    </button>
                    <button
                      type="button"
                      className="linkknop"
                      onClick={() => zetVestigingActief(v.id, !v.actief)}
                    >
                      {v.actief ? "Deactiveren" : "Heractiveren"}
                    </button>
                    <button
                      type="button"
                      className="linkknop linkknop-gevaar"
                      onClick={() => setVerwijderId(v.id)}
                    >
                      Verwijderen…
                    </button>
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
