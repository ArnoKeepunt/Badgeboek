import { useMemo, useState } from "react";
import {
  type DoelSoort,
  SOORT_KLEUR,
  SOORT_LABEL,
  competentieKort,
  competenties,
  minimumdoelen,
} from "../lib/minimumdoelen";

const SOORTEN: DoelSoort[] = ["standaard", "basisgeletterdheid", "uitbreiding", "freinet"];

/**
 * Doelen: de minimumdoelen / eindtermen (los van de badges). Voorlopig om in te kijken —
 * gegroepeerd per sleutelcompetentie, met zoeken en een filter per soort. De soort krijgt
 * dezelfde kleurcode als de badge-evaluatie.
 */
export function Doelen() {
  const [zoek, setZoek] = useState("");
  const [soort, setSoort] = useState<DoelSoort | "">("");
  const [dicht, setDicht] = useState<Set<number>>(new Set());
  const [uitlegOpen, setUitlegOpen] = useState<Set<string>>(new Set());

  const filterActief = Boolean(zoek.trim() || soort);

  const gefilterd = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return minimumdoelen.filter((d) => {
      if (soort && d.soort !== soort) return false;
      if (q) {
        const hooi = `${d.code} ${d.nummer} ${d.omschrijving} ${d.uitleg}`.toLowerCase();
        if (!hooi.includes(q)) return false;
      }
      return true;
    });
  }, [zoek, soort]);

  const comps = useMemo(() => competenties(gefilterd), [gefilterd]);

  const perSoort = useMemo(() => {
    const t: Record<string, number> = {};
    for (const d of minimumdoelen) t[d.soort] = (t[d.soort] ?? 0) + 1;
    return t;
  }, []);

  const toggleComp = (nr: number) =>
    setDicht((prev) => {
      const next = new Set(prev);
      if (next.has(nr)) next.delete(nr);
      else next.add(nr);
      return next;
    });

  const toggleUitleg = (code: string) =>
    setUitlegOpen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <section>
      <h1>Doelen</h1>
      <p style={{ color: "var(--text-muted)" }}>
        {minimumdoelen.length} minimumdoelen en eindtermen voor de eerste graad A, per
        sleutelcompetentie. Voorlopig om in te kijken — later ook aanpasbaar. Los van de badges.
      </p>

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
          Alle ({minimumdoelen.length})
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

      {comps.length === 0 ? (
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
                    const toon = uitlegOpen.has(d.code);
                    return (
                      <li key={d.code} className="doel-item">
                        <div className="doel-item-rij">
                          <span
                            className={`soort-tag rating-${SOORT_KLEUR[d.soort]}`}
                            title={SOORT_LABEL[d.soort]}
                          >
                            {SOORT_LABEL[d.soort]}
                          </span>
                          <span className="doel-nr">{d.nummer}</span>
                          <span className="doel-omschrijving">{d.omschrijving}</span>
                          {heeftUitleg && (
                            <button
                              type="button"
                              className="linkknop doel-uitleg-knop"
                              onClick={() => toggleUitleg(d.code)}
                            >
                              {toon ? "Minder" : "Meer"}
                            </button>
                          )}
                        </div>
                        {heeftUitleg && toon && (
                          <div className="doel-uitleg">
                            {d.uitleg && <p>{d.uitleg}</p>}
                            {d.opmerking && (
                              <p className="doel-opmerking">
                                <strong>Opmerking:</strong> {d.opmerking}
                              </p>
                            )}
                            <p className="doel-code">Code: {d.code}</p>
                          </div>
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
