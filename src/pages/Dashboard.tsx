import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type GroepDef,
  type GroepSoort,
  SOORT_LABEL,
  SYSTEEM_SOORTEN,
  systeemGroepen,
} from "../lib/groepen";
import { LEEG_FILTER, stroomVan, useLeerlingFilter } from "../lib/leerlingen";
import { PERIODES, periodeLabel } from "../lib/periode";
import { RATINGS } from "../lib/ratings";
import { isAfgesloten } from "../lib/schooljaar";
import { setMatrixStromen, setPeriode, useStore } from "../lib/store";
import { type Voortgang, voortgangVoor } from "../lib/voortgang";

/** Mentor-/beheerderoverzicht: snel je periode kiezen en van een groep naar de matrix springen. */
export function Dashboard() {
  const { students, groepen, kleuren, schooljaar, periode } = useStore();
  const navigate = useNavigate();
  const [, setFilter] = useLeerlingFilter();
  const [dimensie, setDimensie] = useState<GroepSoort>("graad");

  const studById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const leden = (ids: string[]) =>
    ids.map((id) => studById.get(id)).filter((s): s is (typeof students)[number] => !!s);

  const eigenGroepen: GroepDef[] = useMemo(
    () =>
      groepen.map((g) => ({
        id: `eigen:${g.id}`,
        naam: g.naam,
        soort: "eigen",
        leerlingIds: g.leerlingIds,
      })),
    [groepen],
  );
  const systeem = useMemo(() => systeemGroepen(students), [students]);

  const metVoortgang = (defs: GroepDef[]) =>
    defs.map((def) => ({
      def,
      v: voortgangVoor(leden(def.leerlingIds), kleuren, schooljaar, periode),
    }));

  const eigenRijen = useMemo(
    () => metVoortgang(eigenGroepen),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eigenGroepen, kleuren, schooljaar, periode, students],
  );
  const systeemRijen = useMemo(
    () => metVoortgang(systeem.filter((d) => d.soort === dimensie)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [systeem, dimensie, kleuren, schooljaar, periode, students],
  );

  const openInMatrix = (def: GroepDef) => {
    setFilter({ ...LEEG_FILTER, groepId: def.id });
    const stromen = [...new Set(leden(def.leerlingIds).map((s) => stroomVan(s)))];
    if (stromen.length > 0) setMatrixStromen(stromen);
    navigate("/badges");
  };

  return (
    <section>
      <h1>Overzicht</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Schooljaar <strong>{schooljaar}</strong>
        {isAfgesloten(schooljaar) ? " (afgesloten)" : ""}. Kies de periode waar je aan werkt en
        spring van een groep naar de badgematrix.
      </p>

      <div className="periode-balk">
        <span className="periode-balk-label">Periode</span>
        {PERIODES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip${p.id === periode ? " is-active" : ""}`}
            onClick={() => setPeriode(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="knop-primair"
        style={{ margin: "4px 0 8px" }}
        onClick={() => navigate("/badges")}
      >
        Naar de badgematrix →
      </button>

      {eigenRijen.length > 0 && (
        <>
          <h2 style={{ marginTop: 28 }}>Mijn groepen · {periodeLabel(periode)}</h2>
          <div className="voortgang-kaarten">
            {eigenRijen.map(({ def, v }) => (
              <VoortgangKaart
                key={def.id}
                titel={def.naam}
                sub={`${def.leerlingIds.length} leerlingen`}
                v={v}
                onOpen={() => openInMatrix(def)}
              />
            ))}
          </div>
        </>
      )}

      <div className="periode-balk" style={{ marginTop: 28 }}>
        <span className="periode-balk-label">Toon per</span>
        {SYSTEEM_SOORTEN.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip${s === dimensie ? " is-active" : ""}`}
            onClick={() => setDimensie(s)}
          >
            {SOORT_LABEL[s].replace(/^Per /, "")}
          </button>
        ))}
      </div>

      <div className="voortgang-kaarten">
        {systeemRijen.map(({ def, v }) => (
          <VoortgangKaart
            key={def.id}
            titel={def.naam}
            sub={`${def.leerlingIds.length} leerlingen`}
            v={v}
            onOpen={() => openInMatrix(def)}
          />
        ))}
      </div>
    </section>
  );
}

function VoortgangKaart({
  titel,
  sub,
  v,
  onOpen,
}: {
  titel: string;
  sub: string;
  v: Voortgang;
  onOpen: () => void;
}) {
  const pct = v.totaal > 0 ? Math.round((v.ingevuld / v.totaal) * 100) : 0;
  return (
    <div className="voortgang-kaart">
      <div className="voortgang-kaart-kop">
        <span className="voortgang-kaart-titel">{titel}</span>
        <span className="voortgang-kaart-pct">{pct}%</span>
      </div>
      <div className="voortgang-kaart-sub">
        {sub} · {v.ingevuld}/{v.totaal} ingevuld
      </div>
      <div className="voortgang-strook" aria-hidden="true">
        {RATINGS.map((r) =>
          v.telling[r] > 0 ? (
            <span
              key={r}
              className={`rating-${r}`}
              style={{ flexGrow: v.telling[r], background: "var(--rating-solid)" }}
            />
          ) : null,
        )}
        {v.telling.leeg > 0 && <span style={{ flexGrow: v.telling.leeg }} />}
      </div>
      <button type="button" className="linkknop" onClick={onOpen}>
        Openen in matrix →
      </button>
    </div>
  );
}
