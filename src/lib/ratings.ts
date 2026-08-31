import type { Rating } from './types'

/** Ordered worst → best. */
export const RATINGS: Rating[] = ['red', 'yellow', 'green', 'blue']

export const RATING_LABEL: Record<Rating, string> = {
  red: 'Rood',
  yellow: 'Geel',
  green: 'Groen',
  blue: 'Blauw',
}

/** Keerpunt's meaning per color (see badgeboek). */
export const RATING_MEANING: Record<Rating, string> = {
  red: 'zwaar onvoldoende',
  yellow: 'nog niet behaald, op weg',
  green: 'goed, de doelen werden behaald',
  blue: 'excellent',
}

/** Shown for the empty / `null` state. */
export const RATING_EMPTY_LABEL = 'Niet aangeboden'
export const RATING_EMPTY_MEANING = 'werd nog niet aangeboden of geëvalueerd'

/** 0 = worst (rood) … 3 = best (blauw). Useful for sorting/comparing. */
export const ratingRank = (r: Rating): number => RATINGS.indexOf(r)
