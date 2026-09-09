import { HUIDIG_SCHOOLJAAR, SCHOOLJAREN, isAfgesloten } from "../lib/schooljaar";
import { setSchooljaar, useStore } from "../lib/store";
import { SlotIcoon } from "./SlotIcoon";

/**
 * Schooljaarkeuze in de topbar. Bepaalt welk schooljaar overal getoond en bewerkt wordt,
 * zodat je makkelijk terug in de tijd kan kijken. Een afgesloten schooljaar is alleen-lezen.
 */
export function SchooljaarKiezer() {
  const { schooljaar } = useStore();

  return (
    <label className="schooljaar-kiezer">
      <span className="schooljaar-kiezer-label">Schooljaar</span>
      <select value={schooljaar} onChange={(e) => setSchooljaar(e.target.value)}>
        {SCHOOLJAREN.map((j) => (
          <option key={j} value={j}>
            {j}
            {j === HUIDIG_SCHOOLJAAR ? " · huidig" : isAfgesloten(j) ? " · afgesloten" : ""}
          </option>
        ))}
      </select>
      {isAfgesloten(schooljaar) && (
        <span
          className="schooljaar-slot"
          title="Dit schooljaar is afgesloten"
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          <SlotIcoon />
        </span>
      )}
    </label>
  );
}
