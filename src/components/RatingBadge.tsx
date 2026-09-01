import type { Rating } from "../lib/types";
import { RATING_EMPTY_LABEL, RATING_LABEL } from "../lib/ratings";

/** Alleen-lezen gekleurde pil. `null` toont de lege / niet-aangeboden staat. */
export function RatingBadge({ rating }: { rating: Rating | null }) {
  if (rating === null) {
    return (
      <span className="rating rating-empty">
        <span className="rating-dot" />
        {RATING_EMPTY_LABEL}
      </span>
    );
  }

  return (
    <span className={`rating rating-${rating}`}>
      <span className="rating-dot" />
      {RATING_LABEL[rating]}
    </span>
  );
}
