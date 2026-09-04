import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "../lib/popover";
import type { Notitie } from "../lib/types";

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
 * Notitie bij één cel (badge, graadsbadge of deelevaluatie) voor één leerling: een tekst die
 * de leerling ziet en een interne notitie enkel voor mentoren/beheerders. Een klein vierkant
 * knopje naast de kleurcel dat een paneeltje opent (portal). De data (`notitie`) en het
 * wegschrijven (`onSave`) komen van de bovenliggende component — `NotitieVeld` weet niet waar
 * het bewaard wordt en abonneert niet zelf op de store (perf in een matrix met veel cellen).
 */
export function NotitieVeld({
  notitie,
  onSave,
  readonly = false,
}: {
  notitie: Notitie;
  onSave: (patch: Partial<Notitie>) => void;
  readonly?: boolean;
}) {
  const heeft = Boolean(notitie.zichtbaar || notitie.verborgen);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pos = usePopover(open, trigger, () => setOpen(false), { breedte: 360, hoogte: 260 });

  return (
    <span className="notitie">
      <button
        ref={trigger}
        type="button"
        className={`notitie-mini${heeft ? " heeft-notitie" : ""}`}
        aria-expanded={open}
        title={heeft ? "Notitie bekijken/bewerken" : "Notitie toevoegen"}
        aria-label={heeft ? "Notitie bekijken/bewerken" : "Notitie toevoegen"}
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
            <div className="notitie-panel zwevend-menu" style={{ top: pos.top, left: pos.left }}>
              <label className="notitie-veld">
                <span>Zichtbaar voor de leerling</span>
                <textarea
                  rows={2}
                  readOnly={readonly}
                  defaultValue={notitie.zichtbaar}
                  onBlur={(e) => onSave({ zichtbaar: e.target.value })}
                />
              </label>
              <label className="notitie-veld">
                <span>Interne notitie · niet zichtbaar voor de leerling</span>
                <textarea
                  rows={2}
                  readOnly={readonly}
                  defaultValue={notitie.verborgen}
                  onBlur={(e) => onSave({ verborgen: e.target.value })}
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
