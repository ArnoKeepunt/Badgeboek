import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "../lib/popover";

function BubbelIcoon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 3.5h10a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1H7l-3 2.5V11H3a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Eén opmerkingveld bij een cursus binnen een rapport — zelfde mini-knop-met-paneel als
 * `NotitieVeld`, maar met één tekstveld i.p.v. zichtbaar/verborgen (een rapport is er sowieso
 * voor bedoeld om (uiteindelijk) getoond/geprint te worden, dus geen apart "verborgen" veld).
 */
export function RapportOpmerkingVeld({
  opmerking,
  onSave,
  readonly = false,
  label,
}: {
  opmerking: string;
  onSave: (tekst: string) => void;
  readonly?: boolean;
  /** Toegankelijke omschrijving, bv. "Opmerking bij Actua". */
  label: string;
}) {
  const heeft = Boolean(opmerking);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const paneel = useRef<HTMLDivElement>(null);
  // `paneel` meegeven: anders leest `usePopover` het interne scrollen van het tekstvak dat
  // volloopt (de cursor duwt de inhoud omhoog) als "de pagina scrolt" en sluit het paneel toe.
  const pos = usePopover(open, trigger, () => setOpen(false), {
    breedte: 360,
    hoogte: 180,
    paneel,
  });

  return (
    <span className="notitie">
      <button
        ref={trigger}
        type="button"
        className={`notitie-mini${heeft ? " heeft-notitie" : ""}`}
        aria-expanded={open}
        title={heeft ? "Opmerking bekijken/bewerken" : "Opmerking toevoegen"}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <BubbelIcoon />
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <button
              type="button"
              className="rating-cell-backdrop"
              aria-label="Sluiten"
              onClick={() => setOpen(false)}
            />
            <div
              ref={paneel}
              className="notitie-panel zwevend-menu"
              style={{ top: pos.top, left: pos.left }}
            >
              <label className="notitie-veld">
                <span>{label}</span>
                <textarea
                  rows={4}
                  readOnly={readonly}
                  defaultValue={opmerking}
                  onBlur={(e) => onSave(e.target.value)}
                />
              </label>
              <button type="button" className="linkknop" onClick={() => setOpen(false)}>
                Sluiten
              </button>
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}
