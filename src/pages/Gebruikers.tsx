import { useEffect, useMemo, useState } from "react";
import { PERSISTENTIE_MODUS, abonneerGebruikers, schrijfGebruiker, verwijderGebruiker } from "../lib/data";
import { useAuthStatus } from "../lib/firebaseAuth";
import {
  PERSONEEL_ROLLEN,
  PERSONEEL_ROL_LABEL,
  PERSONEEL_ROL_UITLEG,
  type Personeelslid,
  type PersoneelRol,
  isBootstrapAdmin,
} from "../lib/gebruikers";
import { useStore } from "../lib/store";
import { vestigingKeuzes } from "../lib/vestigingen";

const leegFormulier = (): Personeelslid => ({
  email: "",
  naam: "",
  rol: "mentor",
  vestiging: "",
  actief: true,
});

/**
 * Personeelsaccounts (beheerder-only). Elke leerkracht krijgt hier een account gekoppeld aan
 * zijn Google-e-mailadres + een rol. Geen wachtwoorden — Google doet de aanmelding, dit bepaalt
 * enkel wie binnen mag en met welke rechten. Schrijft naar Firestore `gebruikers/{email}`.
 */
export function Gebruikers() {
  useStore(); // hertekenen als de vestigingenlijst wijzigt
  const { gebruiker } = useAuthStatus();
  const [lijst, setLijst] = useState<Personeelslid[] | null>(null);
  const [bewerk, setBewerk] = useState<Personeelslid | null>(null);
  const [nieuw, setNieuw] = useState(false);
  const [melding, setMelding] = useState<string>("");

  useEffect(() => {
    if (PERSISTENTIE_MODUS !== "firebase") return;
    return abonneerGebruikers((l) => setLijst(l));
  }, []);

  const vestigingen = useMemo(
    () => vestigingKeuzes((lijst ?? []).map((p) => p.vestiging)),
    [lijst],
  );

  const gesorteerd = useMemo(
    () => [...(lijst ?? [])].sort((a, b) => a.naam.localeCompare(b.naam, "nl")),
    [lijst],
  );

  const bewaar = async (p: Personeelslid) => {
    const email = p.email.trim().toLowerCase();
    if (!/@keerpuntscholen\.be$/i.test(email)) {
      setMelding("Gebruik een @keerpuntscholen.be-adres.");
      return;
    }
    if (!p.naam.trim()) {
      setMelding("Vul een naam in.");
      return;
    }
    try {
      await schrijfGebruiker({ ...p, email, naam: p.naam.trim() });
      setMelding(`${p.naam.trim()} opgeslagen.`);
      setBewerk(null);
      setNieuw(false);
    } catch {
      setMelding("Opslaan mislukt (geen rechten of geen verbinding).");
    }
  };

  const verwijder = async (p: Personeelslid) => {
    if (!confirm(`${p.naam} (${p.email}) definitief verwijderen?`)) return;
    try {
      await verwijderGebruiker(p.email);
      setMelding(`${p.naam} verwijderd.`);
    } catch {
      setMelding("Verwijderen mislukt.");
    }
  };

  const magZichzelfBootstrappen =
    lijst !== null &&
    lijst.length === 0 &&
    isBootstrapAdmin(gebruiker?.email) &&
    !nieuw &&
    !bewerk;

  if (PERSISTENTIE_MODUS !== "firebase") {
    return (
      <section>
        <h2>Personeelsaccounts</h2>
        <p className="lege-staat">
          Accountbeheer werkt enkel met de Firestore-database (<code>VITE_PERSISTENTIE=firebase</code>).
          In de lokale demo-modus werkt iedereen als beheerder.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="pagina-kop">
        <h2>Personeelsaccounts</h2>
        <button
          type="button"
          className="knop-primair"
          onClick={() => {
            setNieuw(true);
            setBewerk(leegFormulier());
          }}
        >
          + Personeelslid
        </button>
      </div>
      <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
        Aanmelden gebeurt met Google. Deze lijst bepaalt <strong>wie</strong> toegang heeft en
        met <strong>welke rol</strong>. Er worden nooit wachtwoorden bewaard.
      </p>

      {melding && <div className="gegevens-melding is-ok">{melding}</div>}

      {magZichzelfBootstrappen && (
        <div className="gegevens-melding is-ok">
          De lijst is leeg. <button
            type="button"
            className="linkknop"
            onClick={() =>
              void bewaar({
                email: gebruiker?.email ?? "",
                naam: gebruiker?.displayName ?? gebruiker?.email ?? "Beheerder",
                rol: "beheerder",
                vestiging: "",
                actief: true,
              })
            }
          >
            Voeg jezelf toe als beheerder
          </button>{" "}
          om te beginnen.
        </div>
      )}

      {lijst === null ? (
        <p className="lege-staat">Laden…</p>
      ) : gesorteerd.length === 0 ? (
        <p className="lege-staat">Nog geen personeelsaccounts.</p>
      ) : (
        <ul className="gebruikers-lijst">
          {gesorteerd.map((p) => (
            <li key={p.email} className={`gebruikers-rij${p.actief ? "" : " is-inactief"}`}>
              <span className="gebruikers-naam">{p.naam}</span>
              <span className="gebruikers-mail">{p.email}</span>
              <span className="gebruikers-rol">
                {PERSONEEL_ROL_LABEL[p.rol]}
                {p.rol === "mentor" && p.vestiging ? ` · ${p.vestiging}` : ""}
              </span>
              <span className="gebruikers-status">{p.actief ? "actief" : "inactief"}</span>
              <span className="gebruikers-acties">
                <button type="button" className="linkknop" onClick={() => setBewerk(p)}>
                  Bewerken
                </button>
                <button
                  type="button"
                  className="linkknop"
                  onClick={() => void bewaar({ ...p, actief: !p.actief })}
                >
                  {p.actief ? "Deactiveren" : "Heractiveren"}
                </button>
                <button type="button" className="linkknop" onClick={() => void verwijder(p)}>
                  Verwijderen
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {bewerk && (
        <GebruikerForm
          waarde={bewerk}
          nieuw={nieuw}
          vestigingen={vestigingen}
          onBewaar={bewaar}
          onSluit={() => {
            setBewerk(null);
            setNieuw(false);
          }}
        />
      )}
    </section>
  );
}

function GebruikerForm({
  waarde,
  nieuw,
  vestigingen,
  onBewaar,
  onSluit,
}: {
  waarde: Personeelslid;
  nieuw: boolean;
  vestigingen: string[];
  onBewaar: (p: Personeelslid) => void;
  onSluit: () => void;
}) {
  const [p, setP] = useState<Personeelslid>(waarde);

  return (
    <div className="gebruikers-form">
      <h3>{nieuw ? "Nieuw personeelslid" : `${waarde.naam} bewerken`}</h3>
      <label className="de-veld">
        <span>E-mailadres (Google)</span>
        <input
          type="email"
          value={p.email}
          disabled={!nieuw}
          placeholder="voornaam.naam@keerpuntscholen.be"
          onChange={(e) => setP({ ...p, email: e.target.value })}
        />
      </label>
      <label className="de-veld">
        <span>Naam</span>
        <input value={p.naam} onChange={(e) => setP({ ...p, naam: e.target.value })} />
      </label>
      <label className="de-veld">
        <span>Rol</span>
        <select
          value={p.rol}
          onChange={(e) => setP({ ...p, rol: e.target.value as PersoneelRol })}
        >
          {PERSONEEL_ROLLEN.map((r) => (
            <option key={r} value={r}>
              {PERSONEEL_ROL_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <p className="gebruikers-roluitleg">{PERSONEEL_ROL_UITLEG[p.rol]}</p>
      {p.rol === "mentor" && (
        <label className="de-veld">
          <span>Vestiging</span>
          <select
            value={p.vestiging}
            onChange={(e) => setP({ ...p, vestiging: e.target.value })}
          >
            <option value="">— kies —</option>
            {vestigingen.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="gebruikers-actief">
        <input
          type="checkbox"
          checked={p.actief}
          onChange={(e) => setP({ ...p, actief: e.target.checked })}
        />
        <span>Account is actief</span>
      </label>
      <div className="gebruikers-form-acties">
        <button type="button" className="knop-primair" onClick={() => onBewaar(p)}>
          Opslaan
        </button>
        <button type="button" className="linkknop" onClick={onSluit}>
          Annuleren
        </button>
      </div>
    </div>
  );
}
