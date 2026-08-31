import type { Rating } from '../lib/types'
import { RATING_EMPTY_LABEL, RATING_EMPTY_MEANING, RATING_LABEL, RATING_MEANING } from '../lib/ratings'

/** Read-only colored pill for a rating. `null` renders the empty / not-yet-offered state. */
export function RatingBadge({ rating }: { rating: Rating | null }) {
  if (rating === null) {
    return (
      <span className="rating rating-empty" title={RATING_EMPTY_MEANING}>
        <span className="rating-dot" />
        {RATING_EMPTY_LABEL}
      </span>
    )
  }

  return (
    <span className={`rating rating-${rating}`} title={RATING_MEANING[rating]}>
      <span className="rating-dot" />
      {RATING_LABEL[rating]}
    </span>
  )
}
