import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "../lib/popover";
import type { Rating } from "../lib/types";
import {
  RATINGS,
  RATING_EMPTY_LABEL,
  RATING_KORT,
  RATING_LABEL,
  STATUSSEN_AANGEBODEN,
} from "../lib/ratings";
import type { GeschiedenisRegel } from "../lib/wijzigingslog";

/** Klein klokje: "te laat ingediend" (naast de kleur). */
export function TeLaatIcoon({ className = "te-laat-icoon" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

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
  readonlyTitel = "Vergrendeld — dit schooljaar is afgesloten",
  geschiedenis,
  teLaat = false,
  onTeLaatChange,
}: {
  value: Rating | null;
  onChange: (next: Rating | null) => void;
  /** Toegankelijke omschrijving, bv. "Emma — Je bent gemotiveerd". */
  label: string;
  /** Alleen tonen, niet bewerkbaar (bv. bij een afgesloten schooljaar). */
  readonly?: boolean;
  /** Tooltip bij een alleen-lezen cel (standaard: afgesloten schooljaar). */
  readonlyTitel?: string;
  /** Volledige wijzigingsgeschiedenis (nieuwste eerst), uitklapbaar onderaan het keuzemenu. */
  geschiedenis?: GeschiedenisRegel[];
  /** "Te laat ingediend" — een markering naast de kleur, geen kleur op zich. */
  teLaat?: boolean;
  /** Zonder deze callback toont het menu geen "te laat"-schakelaar (bv. in het rapport). */
  onTeLaatChange?: (aan: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [toonGeschiedenis, setToonGeschiedenis] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const paneel = useRef<HTMLDivElement>(null);
  const regels = geschiedenis ?? [];
  const heeftGeschiedenis = regels.length > 0;
  // `paneel`: op een laag scherm scrollt het menu intern — dat mag het niet sluiten.
  const pos = usePopover(open, trigger, () => setOpen(false), {
    paneel,
    breedte: heeftGeschiedenis ? 264 : 188,
    hoogte: (toonGeschiedenis ? 680 : heeftGeschiedenis ? 540 : 490) + (onTeLaatChange ? 40 : 0),
    uitlijn: "midden",
  });

  const kies = (next: Rating | null) => {
    onChange(next);
    setOpen(false);
  };

  // De oude status "Te laat ingediend" (verving de kleur) enkel nog tonen als de cel hem heeft.
  const statussen =
    value && !STATUSSEN_AANGEBODEN.includes(value) && !RATINGS.includes(value)
      ? [...STATUSSEN_AANGEBODEN, value]
      : STATUSSEN_AANGEBODEN;
  const waardeTekst = `${value ? RATING_LABEL[value] : RATING_EMPTY_LABEL}${
    teLaat ? ", te laat ingediend" : ""
  }`;
  const inhoud = (
    <>
      {value ? RATING_KORT[value] : "–"}
      {teLaat && <TeLaatIcoon />}
    </>
  );

  if (readonly) {
    return (
      <span
        className={`rating-cell-btn rating-${value ?? "empty"} is-readonly${teLaat ? " is-te-laat" : ""}`}
        title={teLaat ? `Te laat ingediend · ${readonlyTitel}` : readonlyTitel}
        aria-label={`${label} — ${waardeTekst} (vergrendeld)`}
      >
        {inhoud}
      </span>
    );
  }

  return (
    <div className="rating-cell">
      <button
        ref={trigger}
        type="button"
        className={`rating-cell-btn rating-${value ?? "empty"}${teLaat ? " is-te-laat" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} — ${waardeTekst}`}
        onClick={() => setOpen((o) => !o)}
      >
        {inhoud}
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
              className="rating-cell-menu zwevend-menu"
              role="menu"
              style={pos}
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

              {onTeLaatChange && (
                <>
                  <div className="rating-cell-scheiding" role="separator" />
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={teLaat}
                    className={`rating-cell-option rating-cell-telaat${teLaat ? " is-aan" : ""}`}
                    title="Markering naast de kleur: de kleur blijft gewoon staan"
                    onClick={() => onTeLaatChange(!teLaat)}
                  >
                    <span className="rating-cell-vinkje" aria-hidden="true">
                      {teLaat ? "✓" : ""}
                    </span>
                    Te laat ingediend
                    <TeLaatIcoon />
                  </button>
                </>
              )}

              <div className="rating-cell-scheiding" role="separator" />
              {statussen.map((r) => (
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
