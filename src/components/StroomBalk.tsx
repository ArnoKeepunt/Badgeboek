import { toggleMatrixStroom, useStore } from "../lib/store";
import { STROMEN, STROOM_LABEL } from "../lib/types";

/**
 * De stroomchipbalk bovenaan de matrix-pagina's (Badges / Deelevaluaties / Rubrics): meerdere
 * stromen (graden) tegelijk aanduidbaar, minstens één. De keuze (`matrixStromen`) leeft in de
 * store en gaat mee als je van pagina wisselt. De cursusfilter zit in de gewone filterbalk.
 */
export function StroomBalk({ hint }: { hint?: string }) {
  const { matrixStromen } = useStore();
  return (
    <div className="periode-balk">
      <span className="periode-balk-label">Stroom</span>
      {STROMEN.map((s) => {
        const actief = matrixStromen.includes(s);
        return (
          <button
            key={s}
            type="button"
            className={`chip${actief ? " is-active" : ""}`}
            aria-pressed={actief}
            onClick={() => toggleMatrixStroom(s)}
          >
            {STROOM_LABEL[s]}
          </button>
        );
      })}
      {hint && <span className="periode-balk-hint">{hint}</span>}
    </div>
  );
}
