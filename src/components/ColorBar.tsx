import { RATINGS, RATING_LABEL } from "../lib/ratings";
import { aantalIngevuld, type KleurTelling } from "../lib/kleurstats";

/** Dunne gestapelde balk met de verhouding rood/geel/groen/blauw. */
export function ColorBar({ telling }: { telling: KleurTelling }) {
  if (aantalIngevuld(telling) === 0) {
    return <div className="colorbar colorbar-empty" title="Nog niets ingevuld" />;
  }
  return (
    <div
      className="colorbar"
      title={RATINGS.map((r) => `${RATING_LABEL[r]}: ${telling[r]}`).join(" · ")}
    >
      {RATINGS.map((r) =>
        telling[r] > 0 ? (
          <i
            key={r}
            className={`rating-${r}`}
            style={{ flexGrow: telling[r], background: "var(--rating-solid)" }}
          />
        ) : null,
      )}
    </div>
  );
}
