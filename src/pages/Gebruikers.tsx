import { useEffect, useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { PERSISTENTIE_MODUS, abonneerGebruikers, schrijfGebruiker, verwijderGebruiker } from "../lib/data";
import { useAuthStatus, useDevToegang } from "../lib/firebaseAuth";
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

const svgBasis = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const PotloodIcoon = () => (
  <svg {...svgBasis}>
    <path d="M10.5 2.5l3 3L6 13l-3.5.5L3 10z" />
  </svg>
);

/** Deactiveren — "uit de keuzelijsten halen". */
const OogUitIcoon = () => (
  <svg {...svgBasis}>
    <path d="M2 8s2.4-4.3 6-4.3S14 8 14 8s-2.4 4.3-6 4.3S2 8 2 8z" />
    <circle cx="8" cy="8" r="1.7" />
    <path d="M2.5 2.5l11 11" />
  </svg>
);

/** Heractiveren. */
const OogIcoon = () => (
  <svg {...svgBasis}>
    <path d="M2 8s2.4-4.3 6-4.3S14 8 14 8s-2.4 4.3-6 4.3S2 8 2 8z" />
    <circle cx="8" cy="8" r="1.7" />
  </svg>
);

const PrullenbakIcoon = () => (
  <svg {...svgBasis}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.6 4.5l.5 8.1a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.5-8.1M6.8 6.8v4.4M9.2 6.8v4.4" />
  </svg>
);

const leegFormulier = (): Personeelslid => ({
  email: "",
  naam: "",
  rol: "mentor",
  vestigingen: [],
  actief: true,
  dev: false,
});

/**
 * Personeelsaccounts (beheerder-only). Elke leerkracht krijgt hier een account gekoppeld aan
 * zijn Google-e-mailadres + een rol. Geen wachtwoorden — Google doet de aanmelding, dit bepaalt
 * enkel wie binnen mag en met welke rechten. Schrijft naar Firestore `gebruikers/{email}`.
 */
export function Gebruikers() {
  useStore(); // hertekenen als de vestigingenlijst wijzigt
  const { gebruiker } = useAuthStatus();
  const magVerwijderen = useDevToegang();
  const [lijst, setLijst] = useState<Personeelslid[] | null>(null);
  const [bewerk, setBewerk] = useState<Personeelslid | null>(null);
  const [nieuw, setNieuw] = useState(false);
  const [melding, setMelding] = useState<string>("");

  useEffect(() => {
    if (PERSISTENTIE_MODUS !== "firebase") return;
    return abonneerGebruikers((l) => setLijst(l));
  }, []);

  const vestigingen = useMemo(
    () => vestigingKeuzes((lijst ?? []).flatMap((p) => p.vestigingen)),
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
    if (p.rol === "mentor" && p.vestigingen.length === 0) {
      setMelding("Vink minstens één vestiging aan voor een mentor.");
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
                vestigingen: [],
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
              <span
                className="gebruikers-rol"
                title={
                  p.rol === "mentor" && p.vestigingen.length > 0
                    ? p.vestigingen.join(", ")
                    : undefined
                }
              >
                {PERSONEEL_ROL_LABEL[p.rol]}
                {p.rol === "mentor" && p.vestigingen.length > 0 && (
                  <span className="gebruikers-rol-vestiging">
                    {" · "}
                    {p.vestigingen.length <= 2
                      ? p.vestigingen.join(", ")
                      : `${p.vestigingen.length} vestigingen`}
                  </span>
                )}
              </span>
              <span className="gebruikers-status">{p.actief ? "actief" : "inactief"}</span>
              <span className="gebruikers-acties">
                <button
                  type="button"
                  className="knop-icoon knop-icoon-klein knop-icoon--plat"
                  title="Bewerken"
                  aria-label={`${p.naam} bewerken`}
                  onClick={() => setBewerk(p)}
                >
                  <PotloodIcoon />
                </button>
                <button
                  type="button"
                  className="knop-icoon knop-icoon-klein knop-icoon--plat"
                  title={p.actief ? "Deactiveren" : "Heractiveren"}
                  aria-label={`${p.naam} ${p.actief ? "deactiveren" : "heractiveren"}`}
                  onClick={() => void bewaar({ ...p, actief: !p.actief })}
                >
                  {p.actief ? <OogUitIcoon /> : <OogIcoon />}
                </button>
                {magVerwijderen && (
                  <button
                    type="button"
                    className="knop-icoon knop-icoon-klein knop-icoon--plat is-gevaar"
                    title="Verwijderen"
                    aria-label={`${p.naam} verwijderen`}
                    onClick={() => void verwijder(p)}
                  >
                    <PrullenbakIcoon />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {bewerk && (
        <Modal
          label={nieuw ? "Nieuw personeelslid" : `${bewerk.naam || "Personeelslid"} bewerken`}
          onClose={() => {
            setBewerk(null);
            setNieuw(false);
          }}
        >
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
        </Modal>
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
  // `dev` (toegang tot pagina's in ontwikkeling) staat bewust NIET in dit formulier — te
  // makkelijk aan te vinken. Zet het rechtstreeks op het `gebruikers/{email}`-doc in de
  // Firestore-console. Bestaande waarde blijft behouden bij het opslaan.
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
        <div className="de-veld">
          <span>Vestigingen</span>
          {vestigingen.length === 0 ? (
            <p className="gebruikers-roluitleg">
              Nog geen vestigingen bekend. Voeg ze eerst toe bij <strong>Vestigingen</strong>.
            </p>
          ) : (
            <ul className="keuzelijst" aria-label="Vestigingen voor deze mentor">
              {vestigingen.map((v) => {
                const aan = p.vestigingen.includes(v);
                return (
                  <li key={v}>
                    <label className={`keuzelijst-optie${aan ? " is-aan" : ""}`}>
                      <input
                        type="checkbox"
                        className="keuzelijst-input"
                        checked={aan}
                        onChange={(e) =>
                          setP({
                            ...p,
                            vestigingen: e.target.checked
                              ? [...p.vestigingen, v]
                              : p.vestigingen.filter((x) => x !== v),
                          })
                        }
                      />
                      <span className="keuzelijst-vink" aria-hidden="true" />
                      <span className="keuzelijst-label">{v}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {vestigingen.length > 0 && p.vestigingen.length === 0 && (
            <p className="gebruikers-roluitleg">Kies minstens één vestiging.</p>
          )}
        </div>
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
