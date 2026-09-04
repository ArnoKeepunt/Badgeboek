import type { Rubriek } from "./types";
import { rubrieken } from "./rubriekenData";

export { rubrieken };
export type { Rubriek };

/** De rubriekenlijst met de opgeslagen per-rubric-bewerkingen erover gelegd (op id). */
export function metRubriekWijzigingen(
  basis: Rubriek[],
  wijzigingen: Record<string, Partial<Rubriek>>,
): Rubriek[] {
  return basis.map((r) => {
    const patch = wijzigingen[r.id];
    return patch ? { ...r, ...patch, criteria: { ...r.criteria, ...patch.criteria } } : r;
  });
}
