import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "../lib/popover";
import type { Rating } from "../lib/types";
import {
  RATINGS,
  RATING_EMPTY_LABEL,
  RATING_KORT,
  RATING_LABEL,
  STATUSSEN,
} from "../lib/ratings";
import type { GeschiedenisRegel } from "../lib/wijzigingslog";

/**
 * Eén cel in de doelenmatrix, in de stijl van een Notion "status"-eigenschap:
 * de cel toont de huidige kleur; klikken opent een klein menu om te kiezen of te wissen.
 * Het menu hangt aan document.body (portal) zodat het buiten het rooster kan vallen.
 */
export function RatingCell({
  value,
  onChange,
  label,
  readonly = false,
  geschiedenis,
}: {
  value: Rating | null;
  onChange: (next: Rating | null) => void;
  /** Toegankelijke omschrijving, bv. "Emma — Je bent gemotiveerd". */
  label: string;
  /** Alleen tonen, niet bewerkbaar (bv. bij een afgesloten schooljaar). */
  readonly?: boolean;
  /** Volledige wijzigingsgeschiedenis (nieuwste eerst), uitklapbaar onderaan het keuzemenu. */
  geschiedenis?: GeschiedenisRegel[];
}) {
  const [open, setOpen] = useState(false);
  const [toonGeschiedenis, setToonGeschiedenis] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const regels = geschiedenis ?? [];
  const heeftGeschiedenis = regels.length > 0;
  const pos = usePopover(open, trigger, () => setOpen(false), {
    breedte: heeftGeschiedenis ? 264 : 188,
    hoogte: toonGeschiedenis ? 610 : heeftGeschiedenis ? 470 : 420,
    uitlijn: "midden",
  });

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
        {value ? RATING_KORT[value] : "–"}
      </span>
    );
  }

  return (
    <div className="rating-cell">
      <button
        ref={trigger}
        type="button"
        className={`rating-cell-btn rating-${value ?? "empty"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} — ${value ? RATING_LABEL[value] : RATING_EMPTY_LABEL}`}
        onClick={() => setOpen((o) => !o)}
      >
        {value ? RATING_KORT[value] : "–"}
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
              className="rating-cell-menu zwevend-menu"
              role="menu"
              style={{ top: pos.top, left: pos.left }}
            >
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

              <div className="rating-cell-scheiding" role="separator" />
              {STATUSSEN.map((r) => (
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

              {heeftGeschiedenis && (
                <div className="rating-cell-historie">
                  <button
                    type="button"
                    className="rating-cell-historie-knop"
                    aria-expanded={toonGeschiedenis}
                    onClick={() => setToonGeschiedenis((v) => !v)}
                  >
                    <span className="grid-caret">{toonGeschiedenis ? "▾" : "▸"}</span>
                    Geschiedenis ({regels.length})
                  </button>
                  <ol className="rating-cell-historie-lijst">
                    {(toonGeschiedenis ? regels : regels.slice(0, 1)).map((r, i) => (
                      <li key={i}>
                        <span className="rating-cell-historie-kop">
                          <span className="rating-cell-historie-wie">{r.wie}</span>
                          <span className="rating-cell-historie-leader" aria-hidden="true" />
                          <span className="rating-cell-historie-moment">{r.moment}</span>
                        </span>
                        <span className="rating-cell-historie-overgang">{r.overgang}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
