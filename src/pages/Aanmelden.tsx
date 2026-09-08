import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GRAAD_LABEL, graadVan } from "../lib/leerlingen";
import { useAangemeld } from "../lib/sessie";
import { meldAan, meldAf, useStore } from "../lib/store";

/**
 * "Bekijk als": kies als wie je de badges bekijkt (mentor of leerling), of blijf beheerder.
 * De echte toegang tot de app verloopt via de Google-login (`<Toegangspoort>`); deze pagina is
 * beheerder-only en enkel om de leerling-/mentorweergave te testen.
 */
export function Aanmelden() {
  const { students, mentoren } = useStore();
  const aangemeld = useAangemeld();
  const navigate = useNavigate();
  const [zoek, setZoek] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [gekozen, setGekozen] = useState<{ rol: "leerling" | "mentor"; id: string } | null>(null);
  const [fout, setFout] = useState("");

  const resultaten = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    const mentorRijen = mentoren
      .filter((m) => !q || `${m.voornaam} ${m.naam} ${m.vestiging}`.toLowerCase().includes(q))
      .map((m) => ({
        rol: "mentor" as const,
        id: m.id,
        naam: `${m.voornaam} ${m.naam}`,
        sub: `Mentor · ${m.vestiging}`,
        wachtwoord: m.wachtwoord,
      }));
    const leerlingRijen = students
      .filter(
        (s) => !q || `${s.firstName} ${s.lastName} ${s.vestiging}`.toLowerCase().includes(q),
      )
      .map((s) => ({
        rol: "leerling" as const,
        id: s.id,
        naam: `${s.firstName} ${s.lastName}`,
        sub: `Leerling · ${GRAAD_LABEL[graadVan(s.leerjaar)]} ${s.klasgroep} · ${s.vestiging}`,
        wachtwoord: s.wachtwoord,
      }));
    return [...mentorRijen, ...leerlingRijen].slice(0, 40);
  }, [zoek, students, mentoren]);

  const gekozenRij = resultaten.find((r) => gekozen && r.id === gekozen.id && r.rol === gekozen.rol);

  const bevestig = () => {
    if (!gekozenRij) return;
    if (gekozenRij.wachtwoord && wachtwoord && wachtwoord !== gekozenRij.wachtwoord) {
      setFout("Wachtwoord klopt niet.");
      return;
    }
    meldAan(gekozenRij.rol, gekozenRij.id);
    navigate("/");
  };

  return (
    <section style={{ maxWidth: 520 }}>
      {aangemeld ? (
        <p className="jaar-melding jaar-melding-slot">
          Je bent aangemeld als{" "}
          <strong>
            {aangemeld.rol === "leerling"
              ? `${aangemeld.leerling.firstName} ${aangemeld.leerling.lastName}`
              : `${aangemeld.mentor.voornaam} ${aangemeld.mentor.naam}`}
          </strong>{" "}
          ({aangemeld.rol}).{" "}
          <button type="button" className="linkknop" onClick={() => meldAf()}>
            Terug naar beheerder
          </button>
        </p>
      ) : (
        <p style={{ color: "var(--text-muted)" }}>
          Je werkt nu als <strong>beheerder</strong> (volledige toegang). Kies hieronder een
          account om als mentor of leerling verder te gaan.
        </p>
      )}

      <input
        type="search"
        className="filterbar-zoek"
        style={{ width: "100%", margin: "12px 0" }}
        placeholder="Zoek op naam of vestiging…"
        value={zoek}
        onChange={(e) => setZoek(e.target.value)}
      />

      <div className="aanmeld-lijst">
        {resultaten.map((r) => (
          <button
            key={`${r.rol}:${r.id}`}
            type="button"
            className={`aanmeld-rij${gekozen?.id === r.id && gekozen.rol === r.rol ? " is-gekozen" : ""}`}
            onClick={() => {
              setGekozen({ rol: r.rol, id: r.id });
              setWachtwoord("");
              setFout("");
            }}
          >
            <span>{r.naam}</span>
            <span className="aanmeld-sub">{r.sub}</span>
          </button>
        ))}
        {resultaten.length === 0 && <p className="lege-staat">Geen accounts gevonden.</p>}
      </div>

      {gekozenRij && (
        <div className="aanmeld-bevestig">
          <div>
            Aanmelden als <strong>{gekozenRij.naam}</strong>
          </div>
          {gekozenRij.wachtwoord && (
            <input
              type="password"
              placeholder="Wachtwoord (optioneel in demo)"
              value={wachtwoord}
              onChange={(e) => setWachtwoord(e.target.value)}
            />
          )}
          {fout && <div style={{ color: "#b91c1c", fontSize: 13 }}>{fout}</div>}
          <button type="button" className="knop-primair" onClick={bevestig}>
            Aanmelden
          </button>
        </div>
      )}
    </section>
  );
}
