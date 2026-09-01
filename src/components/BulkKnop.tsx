import { useEffect, useState } from "react";
import { RATINGS, RATING_EMPTY_LABEL, RATING_LABEL } from "../lib/ratings";
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

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  if (disabled || aantal === 0) return null;

  const kies = (kleur: Rating | null) => {
    onKies(kleur);
    setOpen(false);
  };

  return (
    <span className="bulk-knop">
      <button
        type="button"
        className="bulk-knop-trigger"
        aria-expanded={open}
        title={`Zet een kleur voor alle ${aantal} zichtbare leerlingen`}
        onClick={() => setOpen((o) => !o)}
      >
        alle ▾
      </button>
      {open && (
        <>
          <button
            type="button"
            className="rating-cell-backdrop"
            aria-label="Sluiten"
            onClick={() => setOpen(false)}
          />
          <div className="rating-cell-menu bulk-menu" role="menu">
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
          </div>
        </>
      )}
    </span>
  );
}
