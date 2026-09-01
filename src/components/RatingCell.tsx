import { useEffect, useState } from "react";
import type { Rating } from "../lib/types";
import { RATINGS, RATING_EMPTY_LABEL, RATING_LABEL } from "../lib/ratings";

/**
 * Eén cel in de doelenmatrix, in de stijl van een Notion "status"-eigenschap:
 * de cel toont de huidige kleur; klikken opent een klein menu om te kiezen of te wissen.
 */
export function RatingCell({
  value,
  onChange,
  label,
  readonly = false,
}: {
  value: Rating | null;
  onChange: (next: Rating | null) => void;
  /** Toegankelijke omschrijving, bv. "Emma — Je bent gemotiveerd". */
  label: string;
  /** Alleen tonen, niet bewerkbaar (bv. bij een afgesloten schooljaar). */
  readonly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const kies = (next: Rating | null) => {
    onChange(next);
    setOpen(false);
  };

  if (readonly) {
    return (
      <span
        className={`rating-cell-btn rating-${value ?? "empty"} is-readonly`}
        title="Vergrendeld — dit schooljaar is afgesloten"
        aria-label={`${label} — ${value ? RATING_LABEL[value] : RATING_EMPTY_LABEL} (vergrendeld)`}
      >
        {value ? RATING_LABEL[value] : "–"}
      </span>
    );
  }

  return (
    <div className="rating-cell">
      <button
        type="button"
        className={`rating-cell-btn rating-${value ?? "empty"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} — ${value ? RATING_LABEL[value] : RATING_EMPTY_LABEL}`}
        onClick={() => setOpen((o) => !o)}
      >
        {value ? RATING_LABEL[value] : "–"}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="rating-cell-backdrop"
            aria-label="Sluiten"
            onClick={() => setOpen(false)}
          />
          <div className="rating-cell-menu" role="menu">
            {RATINGS.map((r) => (
              <button
                key={r}
                type="button"
                role="menuitem"
                className={`rating-cell-option rating-${r}${value === r ? " is-current" : ""}`}
                onClick={() => kies(r)}
              >
                <span className="rating-dot" />
                {RATING_LABEL[r]}
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              className={`rating-cell-option rating-empty${value === null ? " is-current" : ""}`}
              onClick={() => kies(null)}
            >
              <span className="rating-dot" />
              {RATING_EMPTY_LABEL}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
