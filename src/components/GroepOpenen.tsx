import { Icoon } from "./Icoon";

/** De drie icoonknoppen om een groep in Badges / Deelevaluaties / Rubrics te openen. */
export function GroepOpenen({
  naam,
  onOpen,
}: {
  naam: string;
  onOpen: (pad: string) => void;
}) {
  return (
    <div className="groep-openen">
      <button
        type="button"
        className="voortgang-kaart-ikn"
        title={`${naam} openen in Badges`}
        aria-label={`${naam} openen in Badges`}
        onClick={() => onOpen("/badges")}
      >
        <Icoon naam="badges" />
      </button>
      <button
        type="button"
        className="voortgang-kaart-ikn"
        title={`${naam} openen in Deelevaluaties`}
        aria-label={`${naam} openen in Deelevaluaties`}
        onClick={() => onOpen("/deelevaluaties")}
      >
        <Icoon naam="deelevaluaties" />
      </button>
      <button
        type="button"
        className="voortgang-kaart-ikn"
        title={`${naam} openen in Rubrics`}
        aria-label={`${naam} openen in Rubrics`}
        onClick={() => onOpen("/rubrics")}
      >
        <Icoon naam="rubrics" />
      </button>
    </div>
  );
}
