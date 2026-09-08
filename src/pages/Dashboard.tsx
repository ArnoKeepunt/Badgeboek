import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GroepOpenen } from "../components/GroepOpenen";
import {
  type GroepDef,
  type GroepSoort,
  SOORT_LABEL,
  alleGroepDefs,
  stromenVanGroep,
  systeemGroepen,
} from "../lib/groepen";
import { LEEG_FILTER, useLeerlingFilter } from "../lib/leerlingen";
import { useZichtbareLeerlingen } from "../lib/rechten";
import { useEffectieveRol } from "../lib/sessie";
import { RATINGS } from "../lib/ratings";
import { setMatrixCursus, setMatrixStromen, useStore } from "../lib/store";
import { type Voortgang, voortgangVoor } from "../lib/voortgang";

const OVERZICHT_KEY = "keerpunt-badgeboek:overzicht-groepen";
const SOORT_VOLGORDE: GroepSoort[] = [
  "eigen",
  "graad",
  "leerjaar",
  "vestiging",
  "klasgroep",
  "graad-vestiging",
  "leerjaar-vestiging",
];

function loadOverzicht(): string[] {
  try {
    const raw = localStorage.getItem(OVERZICHT_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // niets bewaard
  }
  return [];
}

/** Mentor-/beheerderoverzicht: eigen gekozen groepen + de vaste indeling per graad en jaar. */
export function Dashboard() {
  const { groepen, kleuren, schooljaar } = useStore();
  const students = useZichtbareLeerlingen();
  // Een leerkracht krijgt een compact overzicht: enkel de eigen gekozen groepen, niet de
  // volledige indeling per graad en per leerjaar (die is er "voor iedereen").
  const isMentor = useEffectieveRol() === "mentor";
  const navigate = useNavigate();
  const [, setFilter] = useLeerlingFilter();
  const [gekozen, setGekozen] = useState<string[]>(loadOverzicht);

  const studById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const leden = (ids: string[]) =>
    ids.map((id) => studById.get(id)).filter((s): s is (typeof students)[number] => !!s);

  const alleDefs = useMemo(() => alleGroepDefs(students, groepen), [students, groepen]);
  const systeem = useMemo(() => systeemGroepen(students), [students]);

  useEffect(() => {
    try {
      localStorage.setItem(OVERZICHT_KEY, JSON.stringify(gekozen));
    } catch {
      // opslag niet beschikbaar
    }
  }, [gekozen]);

  const voegToe = (id: string) => setGekozen((v) => [...v.filter((x) => x !== id), id]);
  const verwijder = (id: string) => setGekozen((v) => v.filter((x) => x !== id));

  const metVoortgang = (defs: GroepDef[]) =>
    defs.map((def) => ({
      def,
      v: voortgangVoor(leden(def.leerlingIds), kleuren, schooljaar),
    }));

  const mijnRijen = useMemo(
    () =>
      metVoortgang(
        gekozen.map((id) => alleDefs.find((d) => d.id === id)).filter((d): d is GroepDef => !!d),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gekozen, alleDefs, kleuren, schooljaar, students],
  );
  const graadRijen = useMemo(
    () => metVoortgang(systeem.filter((d) => d.soort === "graad")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [systeem, kleuren, schooljaar, students],
  );
  const leerjaarRijen = useMemo(
    () => metVoortgang(systeem.filter((d) => d.soort === "leerjaar")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [systeem, kleuren, schooljaar, students],
  );

  const toevoegbaar = alleDefs.filter((d) => !gekozen.includes(d.id));

  // De groep als actieve filter zetten en naar de gekozen pagina springen (badges,
  // deelevaluaties, later rubrics). De filter is gedeeld, dus blijft ook daar staan.
  const openGroep = (def: GroepDef, pad: string) => {
    setFilter({ ...LEEG_FILTER, groepId: def.id });
    const stromen = stromenVanGroep(def.id, students, groepen);
    if (stromen.length > 0) setMatrixStromen(stromen);
    setMatrixCursus(""); // hele groep tonen, niet één cursus
    navigate(pad);
  };

  const kaarten = (
    rijen: { def: GroepDef; v: Voortgang }[],
    opVerwijder?: (id: string) => void,
  ) => (
    <div className="voortgang-kaarten">
      {rijen.map(({ def, v }) => (
        <VoortgangKaart
          key={def.id}
          titel={def.naam}
          sub={`${def.leerlingIds.length} leerlingen`}
          v={v}
          onOpen={(pad) => openGroep(def, pad)}
          onVerwijder={opVerwijder ? () => opVerwijder(def.id) : undefined}
        />
      ))}
    </div>
  );

  return (
    <section>
      <div className="pagina-kop">
        <h2>Mijn groepen</h2>
        {toevoegbaar.length > 0 && (
          <select
            className="overzicht-toevoeg"
            value=""
            aria-label="Groep aan mijn groepen toevoegen"
            onChange={(e) => {
              if (e.target.value) voegToe(e.target.value);
              e.currentTarget.value = "";
            }}
          >
            <option value="">+ Groep toevoegen…</option>
            {SOORT_VOLGORDE.map((soort) => {
              const opts = toevoegbaar.filter((d) => d.soort === soort);
              if (opts.length === 0) return null;
              return (
                <optgroup key={soort} label={SOORT_LABEL[soort]}>
                  {opts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.naam} ({d.leerlingIds.length})
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        )}
      </div>

      {mijnRijen.length === 0 ? (
        <p className="lege-staat">
          Nog geen eigen groepen gekozen. Voeg er hierboven toe — je eigen klas, een groepje
          leerlingen…{isMentor ? "" : " De vaste indeling per graad en jaar staat er sowieso onder."}
        </p>
      ) : (
        kaarten(mijnRijen, verwijder)
      )}

      {!isMentor && (
        <>
          <h2 style={{ marginTop: 30 }}>Per graad</h2>
          {kaarten(graadRijen)}

          <h2 style={{ marginTop: 30 }}>Per leerjaar</h2>
          {kaarten(leerjaarRijen)}
        </>
      )}
    </section>
  );
}

function VoortgangKaart({
  titel,
  sub,
  v,
  onOpen,
  onVerwijder,
}: {
  titel: string;
  sub: string;
  v: Voortgang;
  onOpen: (pad: string) => void;
  onVerwijder?: () => void;
}) {
  const pct = v.totaal > 0 ? Math.round((v.ingevuld / v.totaal) * 100) : null;
  return (
    <div className="voortgang-kaart">
      <div className="voortgang-kaart-kop">
        <span className="voortgang-kaart-titel">{titel}</span>
      </div>

      {(pct !== null || onVerwijder) && (
        <div className={`voortgang-kaart-hoek${onVerwijder ? " heeft-x" : ""}`}>
          {pct !== null && <span className="voortgang-kaart-pct">{pct}%</span>}
          {onVerwijder && (
            <button
              type="button"
              className="voortgang-kaart-x"
              title="Uit mijn groepen halen"
              aria-label={`${titel} uit mijn groepen halen`}
              onClick={onVerwijder}
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className="voortgang-kaart-onder">
        <div className="voortgang-kaart-progressie">
          <span className="voortgang-kaart-sub">
            {sub} · {v.ingevuld}/{v.totaal} ingevuld
          </span>
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
        </div>
        <GroepOpenen naam={titel} onOpen={onOpen} />
      </div>
    </div>
  );
}
