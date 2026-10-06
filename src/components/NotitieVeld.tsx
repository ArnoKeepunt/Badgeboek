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
  const paneel = useRef<HTMLDivElement>(null);
  const zichtbaarVak = useRef<HTMLTextAreaElement>(null);
  const verborgenVak = useRef<HTMLTextAreaElement>(null);
  /** Wat er laatst bewaard is (of bij het openen al stond) — om dubbel bewaren te vermijden. */
  const bewaard = useRef<Notitie>(notitie);

  const bewaarVeld = (veld: keyof Notitie, waarde: string) => {
    if (readonly || waarde === bewaard.current[veld]) return;
    bewaard.current = { ...bewaard.current, [veld]: waarde };
    onSave({ [veld]: waarde });
  };

  const openen = () => {
    bewaard.current = notitie;
    setOpen(true);
  };

  /**
   * Sluiten bewaart altijd eerst wat er in de vakken staat. Op `onBlur` alleen rekenen volstaat
   * niet: sluiten via de achtergrond (Safari/iPad focust een knop niet bij een klik), Escape of
   * scrollen haalt het tekstvak weg zonder blur-event, en dan ging de nieuwe tekst verloren.
   */
  const sluit = () => {
    if (zichtbaarVak.current) bewaarVeld("zichtbaar", zichtbaarVak.current.value);
    if (verborgenVak.current) bewaarVeld("verborgen", verborgenVak.current.value);
    setOpen(false);
  };

  // `paneel` meegeven: anders leest `usePopover` het interne scrollen van een tekstvak dat
  // volloopt (de cursor duwt de inhoud omhoog) als "de pagina scrolt" en sluit het paneel toe.
  const pos = usePopover(open, trigger, sluit, {
    breedte: 360,
    hoogte: 260,
    paneel,
  });

  return (
    <span className="notitie">
      <button
        ref={trigger}
        type="button"
        className={`notitie-mini${heeft ? " heeft-notitie" : ""}`}
        aria-expanded={open}
        title={heeft ? "Notitie bekijken/bewerken" : "Notitie toevoegen"}
        aria-label={heeft ? "Notitie bekijken/bewerken" : "Notitie toevoegen"}
        onClick={() => (open ? sluit() : openen())}
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
              onClick={sluit}
            />
            <div
              ref={paneel}
              className="notitie-panel zwevend-menu"
              style={{ top: pos.top, left: pos.left }}
            >
              <label className="notitie-veld">
                <span>Zichtbaar voor de leerling</span>
                <textarea
                  rows={2}
                  readOnly={readonly}
                  ref={zichtbaarVak}
                  defaultValue={notitie.zichtbaar}
                  onBlur={(e) => bewaarVeld("zichtbaar", e.target.value)}
                />
              </label>
              <label className="notitie-veld">
                <span>Interne notitie · niet zichtbaar voor de leerling</span>
                <textarea
                  rows={2}
                  readOnly={readonly}
                  ref={verborgenVak}
                  defaultValue={notitie.verborgen}
                  onBlur={(e) => bewaarVeld("verborgen", e.target.value)}
                />
              </label>
              <button type="button" className="linkknop" onClick={sluit}>
                Sluiten
              </button>
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}
