import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { abonneerAuth, meldAanMetGoogle, meldAfVanFirebase } from "../lib/data";
import { GRAAD_LABEL, graadVan } from "../lib/leerlingen";
import { useAangemeld } from "../lib/sessie";
import { meldAan, meldAf, useStore } from "../lib/store";
import type { User } from "firebase/auth";

/**
 * Aanmelden:
 * 1. Firebase Google Authentication voor live synchronisatie naar de Firestore database.
 * 2. School-account wissel: kies als wie je de badges bekijkt (mentor, leerling of beheerder).
 */
export function Aanmelden() {
  const { students, mentoren } = useStore();
  const aangemeld = useAangemeld();
  const navigate = useNavigate();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [googleLaden, setGoogleLaden] = useState(false);
  const [googleFout, setGoogleFout] = useState("");
  const [zoek, setZoek] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [gekozen, setGekozen] = useState<{ rol: "leerling" | "mentor"; id: string } | null>(null);
  const [fout, setFout] = useState("");

  useEffect(() => {
    return abonneerAuth((u) => setFirebaseUser(u));
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLaden(true);
    setGoogleFout("");
    try {
      await meldAanMetGoogle();
    } catch (err: any) {
      setGoogleFout(err?.message || "Inloggen met Google mislukt.");
    } finally {
      setGoogleLaden(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await meldAfVanFirebase();
    } catch (err: any) {
      console.error(err);
    }
  };


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
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "16px",
          background: "var(--surface)",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <strong style={{ fontSize: "14px" }}>Firebase Cloud-synchronisatie</strong>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "999px",
              backgroundColor: firebaseUser ? "#dcfce7" : "#f3f4f6",
              color: firebaseUser ? "#15803d" : "#4b5563",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: firebaseUser ? "#16a34a" : "#9ca3af",
              }}
            />
            {firebaseUser ? "Verbonden" : "Lokale opslag"}
          </span>
        </div>

        {firebaseUser ? (
          <div>
            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--text-muted)" }}>
              Ingelogd als <strong>{firebaseUser.email ?? firebaseUser.displayName}</strong>. Wijzigingen in evaluaties worden realtime gesynchroniseerd met Firestore.
            </p>
            <button
              type="button"
              className="chip"
              onClick={handleGoogleLogout}
              style={{ fontSize: "13px" }}
            >
              Afmelden bij Google
            </button>
          </div>
        ) : (
          <div>
            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--text-muted)" }}>
              Meld je aan met je Keerpunt Google-account om de gedeelde schoolgegevens en evaluaties via Firebase Firestore live te synchroniseren.
            </p>
            {googleFout && (
              <div style={{ color: "#b91c1c", fontSize: "13px", marginBottom: "8px" }}>
                {googleFout}
              </div>
            )}
            <button
              type="button"
              className="knop-primair"
              onClick={handleGoogleLogin}
              disabled={googleLaden}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.56 0 2.98.54 4.1 1.6l3.07-3.07C17.3 1.8 14.85 1 12 1 7.5 1 3.65 3.6 1.8 7.37l3.75 2.91C6.46 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.07-1.55-.2-2.3H12v4.5h6.5c-.28 1.5-1.12 2.8-2.4 3.65l3.7 2.88c2.16-2 3.7-4.93 3.7-8.73z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.55 14.72c-.24-.72-.37-1.49-.37-2.72s.13-2 .37-2.72L1.8 6.37C.65 8.65 0 10.25 0 12s.65 3.35 1.8 5.63l3.75-2.91z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.96-1.08 7.95-2.93l-3.7-2.88c-1.08.73-2.46 1.16-4.25 1.16-3 0-5.54-2.4-6.45-5.28L1.8 15.98C3.65 19.75 7.5 23 12 23z"
                />
              </svg>
              {googleLaden ? "Aanmelden..." : "Aanmelden met Google"}
            </button>
          </div>
        )}
      </div>

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
