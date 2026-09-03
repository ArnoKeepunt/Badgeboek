import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { aantalOngelezen, markMeldingenGezien, meldingenVoor, useStore } from "../lib/store";
import type { Melding } from "../lib/types";

function geleden(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 2) return "net";
  if (min < 60) return `${min} min geleden`;
  const uur = Math.round(min / 60);
  if (uur < 24) return `${uur} u geleden`;
  const dag = Math.round(uur / 24);
  return dag === 1 ? "gisteren" : `${dag} dagen geleden`;
}

/**
 * Meldingencentrum voor de leerling: een klokje in de bovenbalk dat toont hoeveel nieuwe
 * beoordelingen er zijn. Enkel in de app zichtbaar (geen push). Klik een melding aan om naar
 * de betrokken cursus te springen.
 */
export function MeldingenKlok({ studentId }: { studentId: string }) {
  const { meldingen, meldingGezien } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [gezienBijOpen, setGezienBijOpen] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const mijn = meldingenVoor(meldingen, studentId).slice(0, 15);
  const ongelezen = aantalOngelezen(meldingen, meldingGezien, studentId);

  const wissel = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setGezienBijOpen(meldingGezien[studentId] ?? 0);
    setOpen(true);
    if (ongelezen > 0) markMeldingenGezien(studentId);
  };

  const ga = (m: Melding) => {
    setOpen(false);
    navigate(m.cursusId ? `/vak/${m.cursusId}` : "/");
  };

  return (
    <div className="ll-klok">
      <button
        type="button"
        className={`ll-klok-knop${ongelezen > 0 ? " is-actief" : ""}`}
        aria-label={ongelezen > 0 ? `Meldingen: ${ongelezen} nieuw` : "Meldingen"}
        aria-expanded={open}
        onClick={wissel}
      >
        <svg className="ll-klok-icoon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.3 21a1.94 1.94 0 0 0 3.4 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {ongelezen > 0 && (
          <span className="ll-klok-badge">{ongelezen > 9 ? "9+" : ongelezen}</span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="ll-klok-backdrop"
            aria-label="Sluiten"
            onClick={() => setOpen(false)}
          />
          <div className="ll-klok-paneel" role="dialog" aria-label="Meldingen">
            <div className="ll-klok-kop">Meldingen</div>
            {mijn.length === 0 ? (
              <p className="ll-klok-leeg">
                Nog geen beoordelingen. Zodra je mentor iets invult, verschijnt het hier.
              </p>
            ) : (
              <ul className="ll-klok-lijst">
                {mijn.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={`ll-klok-item${m.ts > gezienBijOpen ? " is-nieuw" : ""}`}
                      onClick={() => ga(m)}
                    >
                      <span className="ll-klok-item-tekst">
                        {m.aantal > 1
                          ? `${m.aantal} nieuwe beoordelingen`
                          : "Nieuwe beoordeling"}{" "}
                        bij <strong>{m.cursusNaam}</strong>
                      </span>
                      <span className="ll-klok-item-tijd">{geleden(m.ts)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
