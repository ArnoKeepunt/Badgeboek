import { useMemo, useState } from "react";
import { DoelEditor } from "../components/DoelEditor";
import { useEffectieveRol } from "../lib/sessie";
import {
  type DoelSoort,
  type Stroom,
  SOORT_KLEUR,
  SOORT_LABEL,
  STROMEN,
  STROOM_LABEL,
  alleMinimumdoelen,
  competentieKort,
  competenties,
  metWijzigingen,
} from "../lib/minimumdoelen";
import { useStore } from "../lib/store";

const SOORTEN: DoelSoort[] = ["standaard", "basisgeletterdheid", "uitbreiding", "freinet"];

/** "alle" = alle stromen samen. */
type StroomKeuze = Stroom | "alle";

/**
 * Doelen: de minimumdoelen / eindtermen (los van de badges). Bovenaan kies je de graad/stroom
 * (zoals de periodes bij de badges); daaronder zoek en filter je per soort. Gegroepeerd per
 * sleutelcompetentie. De beheerder kan elk doel bewerken; een mentor kan enkel bekijken
 * (en de uitleg openklappen).
 */
export function Doelen() {
  const { doelWijzigingen, doelenImport } = useStore();
  const magBewerken = useEffectieveRol() === "beheerder";
  const minimumdoelen = useMemo(
    () => metWijzigingen(doelenImport ?? alleMinimumdoelen, doelWijzigingen),
    [doelenImport, doelWijzigingen],
  );
  const [stroom, setStroom] = useState<StroomKeuze>("1A");
  const [zoek, setZoek] = useState("");
  const [soort, setSoort] = useState<DoelSoort | "">("");
  const [dicht, setDicht] = useState<Set<number>>(new Set());
  const [bewerken, setBewerken] = useState<string | null>(null);
  const [uitlegOpen, setUitlegOpen] = useState<Set<string>>(new Set());

  const toggleUitleg = (code: string) =>
    setUitlegOpen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const alleStromen = stroom === "alle";

  const stroomDoelen = useMemo(
    () => (alleStromen ? minimumdoelen : minimumdoelen.filter((d) => d.stroom === stroom)),
    [minimumdoelen, stroom, alleStromen],
  );

  const filterActief = Boolean(zoek.trim() || soort);

  const gefilterd = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return stroomDoelen.filter((d) => {
      if (soort && d.soort !== soort) return false;
      if (q) {
        const hooi = `${d.code} ${d.nummer} ${d.omschrijving} ${d.uitleg}`.toLowerCase();
        if (!hooi.includes(q)) return false;
      }
      return true;
    });
  }, [stroomDoelen, zoek, soort]);

  const comps = useMemo(() => competenties(gefilterd), [gefilterd]);

  const perSoort = useMemo(() => {
    const t: Record<string, number> = {};
    for (const d of stroomDoelen) t[d.soort] = (t[d.soort] ?? 0) + 1;
    return t;
  }, [stroomDoelen]);

  const toggleComp = (nr: number) =>
    setDicht((prev) => {
      const next = new Set(prev);
      if (next.has(nr)) next.delete(nr);
      else next.add(nr);
      return next;
    });

  return (
    <section>
      <div className="periode-balk">
        <span className="periode-balk-label">Stroom</span>
        <button
          type="button"
          className={`chip${alleStromen ? " is-active" : ""}`}
          onClick={() => {
            setStroom("alle");
            setBewerken(null);
          }}
        >
          Alle stromen ({minimumdoelen.length})
        </button>
        {STROMEN.map((s) => {
          const aantal = minimumdoelen.filter((d) => d.stroom === s).length;
          return (
            <button
              key={s}
              type="button"
              className={`chip${s === stroom ? " is-active" : ""}`}
              onClick={() => {
                setStroom(s);
                setBewerken(null);
              }}
            >
              {STROOM_LABEL[s]} ({aantal})
            </button>
          );
        })}
      </div>

      <div className="filterbar">
        <input
          type="search"
          className="filterbar-zoek"
          placeholder="Zoek op code of tekst…"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <button
          type="button"
          className={`chip${soort === "" ? " is-active" : ""}`}
          onClick={() => setSoort("")}
        >
          Alle ({stroomDoelen.length})
        </button>
        {SOORTEN.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip soort-chip rating-${SOORT_KLEUR[s]}${soort === s ? " is-active" : ""}`}
            onClick={() => setSoort(soort === s ? "" : s)}
          >
            {SOORT_LABEL[s]} ({perSoort[s] ?? 0})
          </button>
        ))}
      </div>

      {!alleStromen && stroomDoelen.length === 0 ? (
        <p className="lege-staat">
          Nog geen doelen voor {STROOM_LABEL[stroom]}. Dit bestand is nog niet aangeleverd.
        </p>
      ) : comps.length === 0 ? (
        <p className="lege-staat">Geen doelen voor deze zoekopdracht.</p>
      ) : (
        comps.map((c) => {
          const open = filterActief || !dicht.has(c.nr);
          return (
            <div key={c.nr} className="doel-comp">
              <button
                type="button"
                className="doel-comp-kop"
                onClick={() => toggleComp(c.nr)}
              >
                <span className="grid-caret">{open ? "▾" : "▸"}</span>
                <span className="doel-comp-nr">{c.nr}</span>
                {competentieKort(c.naam)}
                <span className="grid-count">{c.doelen.length}</span>
              </button>

              {open && (
                <ul className="doel-lijst">
                  {c.doelen.map((d) => {
                    const heeftUitleg = Boolean(d.uitleg || d.opmerking);
                    const toonUitleg = uitlegOpen.has(d.code);
                    return (
                      <li key={d.code} className="doel-item">
                        {magBewerken && bewerken === d.code ? (
                          <DoelEditor doel={d} onSluit={() => setBewerken(null)} />
                        ) : (
                          <>
                            <div className="doel-item-rij">
                              <span
                                className={`soort-tag rating-${SOORT_KLEUR[d.soort]}`}
                                title={SOORT_LABEL[d.soort]}
                              >
                                {SOORT_LABEL[d.soort]}
                              </span>
                              {alleStromen && (
                                <span className="doel-stroom" title={STROOM_LABEL[d.stroom]}>
                                  {d.stroom}
                                </span>
                              )}
                              <span className="doel-nr">{d.nummer}</span>
                              <span className="doel-omschrijving">{d.omschrijving}</span>
                              {magBewerken ? (
                                <button
                                  type="button"
                                  className="linkknop doel-uitleg-knop"
                                  onClick={() => setBewerken(d.code)}
                                >
                                  Bewerk
                                </button>
                              ) : (
                                heeftUitleg && (
                                  <button
                                    type="button"
                                    className="linkknop doel-uitleg-knop"
                                    onClick={() => toggleUitleg(d.code)}
                                  >
                                    {toonUitleg ? "Verberg uitleg" : "Uitleg"}
                                  </button>
                                )
                              )}
                            </div>
                            {!magBewerken && toonUitleg && heeftUitleg && (
                              <div className="doel-uitleg-lezen">
                                {d.uitleg && <p>{d.uitleg}</p>}
                                {d.opmerking && (
                                  <p className="doel-uitleg-opmerking">Opmerking: {d.opmerking}</p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
