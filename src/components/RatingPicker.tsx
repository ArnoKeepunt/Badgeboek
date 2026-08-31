import type { Rating } from "../lib/types";
import {
  RATINGS,
  RATING_EMPTY_LABEL,
  RATING_EMPTY_MEANING,
  RATING_LABEL,
  RATING_MEANING,
} from "../lib/ratings";

/**
 * Klik een kleur aan om die te zetten; klik de actieve kleur opnieuw aan (of
 * "Niet aangeboden") om terug naar de lege staat te gaan.
 *
 * `compact` toont enkel gekleurde bolletjes zonder labels — handig in een matrix.
 */
export function RatingPicker({
  value,
  onChange,
  compact = false,
}: {
  value: Rating | null;
  onChange: (next: Rating | null) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`rating-picker${compact ? " compact" : ""}`}
      role="group"
      aria-label="Kies een kleur"
    >
      {RATINGS.map((r) => (
        <button
          key={r}
          type="button"
          className={`rating-swatch rating-${r}${value === r ? " is-selected" : ""}`}
          aria-pressed={value === r}
          aria-label={`${RATING_LABEL[r]} — ${RATING_MEANING[r]}`}
          title={`${RATING_LABEL[r]} — ${RATING_MEANING[r]}`}
          onClick={() => onChange(value === r ? null : r)}
        >
          <span className="rating-dot" />
          {!compact && RATING_LABEL[r]}
        </button>
      ))}

      <button
        type="button"
        className={`rating-swatch rating-empty${value === null ? " is-selected" : ""}`}
        aria-pressed={value === null}
        aria-label={RATING_EMPTY_MEANING}
        title={RATING_EMPTY_MEANING}
        onClick={() => onChange(null)}
      >
        <span className="rating-dot" />
        {!compact && RATING_EMPTY_LABEL}
      </button>
    </div>
  );
}
