import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "../lib/popover";
import { RATINGS, RATING_EMPTY_LABEL, RATING_LABEL, STATUSSEN } from "../lib/ratings";
import type { Rating } from "../lib/types";

/** Zet in één keer dezelfde kleur voor alle zichtbare leerlingen op deze badge-rij. */
export function BulkKnop({
  aantal,
  onKies,
  disabled = false,
}: {
  aantal: number;
  onKies: (kleur: Rating | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pos = usePopover(open, trigger, () => setOpen(false), {
    breedte: 214,
    hoogte: 330,
    uitlijn: "rechts",
  });

  if (disabled || aantal === 0) return null;

  const kies = (kleur: Rating | null) => {
    onKies(kleur);
    setOpen(false);
  };

  return (
    <span className="bulk-knop">
      <button
        ref={trigger}
        type="button"
        className="bulk-knop-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Zet een kleur voor alle ${aantal} zichtbare leerlingen`}
        onClick={() => setOpen((o) => !o)}
      >
        alle ▾
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
              className="rating-cell-menu zwevend-menu bulk-menu"
              role="menu"
              style={{ top: pos.top, left: pos.left }}
            >
              <div className="bulk-menu-kop">Alle {aantal} zichtbare leerlingen</div>
              {RATINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="menuitem"
                  className={`rating-cell-option rating-${r}`}
                  onClick={() => kies(r)}
                >
                  <span className="rating-dot" />
                  {RATING_LABEL[r]}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className="rating-cell-option rating-empty"
                onClick={() => kies(null)}
              >
                <span className="rating-dot" />
                {RATING_EMPTY_LABEL}
              </button>

              <div className="rating-cell-scheiding" role="separator" />
              {STATUSSEN.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="menuitem"
                  className={`rating-cell-option rating-${r}`}
                  onClick={() => kies(r)}
                >
                  <span className="rating-dot" />
                  {RATING_LABEL[r]}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}
