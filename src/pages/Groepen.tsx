import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GroepEditor } from "../components/GroepEditor";
import { SOORT_LABEL, SYSTEEM_SOORTEN, systeemGroepen } from "../lib/groepen";
import { LEEG_FILTER, stroomVan, useLeerlingFilter } from "../lib/leerlingen";
import { useAangemeld } from "../lib/sessie";
import { useStore, verwijderGroep } from "../lib/store";
import type { Student } from "../lib/types";

const init = (s: Student) =>
  `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}`.toUpperCase();

/**
 * Groepenpagina: zelfgemaakte groepen beheren + alle standaardgroepen. Elke groep toont
 * wie erin zit (avatars) en de samenstelling per stroom.
 */
export function Groepen() {
  const { students, mentoren, groepen } = useStore();
  const [, setFilter] = useLeerlingFilter();
  const navigate = useNavigate();
  const aangemeld = useAangemeld();
  const mentorId = aangemeld?.rol === "mentor" ? aangemeld.mentor.id : undefined;
  const [editor, setEditor] = useState<null | { id?: string }>(null);
  const [alleenVanMij, setAlleenVanMij] = useState(false);

  const studById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const leden = (ids: string[]) =>
    ids.map((id) => studById.get(id)).filter((s): s is Student => !!s);

  const systeem = useMemo(() => systeemGroepen(students), [students]);
  const mentorNaam = (id?: string): string => {
    const m = mentoren.find((x) => x.id === id);
    return m ? `${m.voornaam} ${m.naam}` : "";
  };
  const zichtbareGroepen =
    alleenVanMij && mentorId ? groepen.filter((g) => g.mentorId === mentorId) : groepen;
  const teBewerken = editor?.id ? groepen.find((g) => g.id === editor.id) : undefined;

  const toonInMatrix = (groepDefId: string) => {
    setFilter({ ...LEEG_FILTER, groepId: groepDefId });
    navigate("/badges");
  };

  return (
    <section>
      <div className="pagina-kop">
        <h1>Groepen</h1>
        {!editor && (
          <button type="button" className="knop-primair" onClick={() => setEditor({})}>
            + Groep aanmaken
          </button>
        )}
      </div>

      {editor && (
        <GroepEditor groep={teBewerken} mentorId={mentorId} onSluit={() => setEditor(null)} />
      )}

      <div className="pagina-kop">
        <h2>Eigen groepen</h2>
        {mentorId && groepen.some((g) => g.mentorId === mentorId) && (
          <label style={{ fontSize: 13, color: "var(--text-muted)" }}>
            <input
              type="checkbox"
              checked={alleenVanMij}
              onChange={(e) => setAlleenVanMij(e.target.checked)}
            />{" "}
            Alleen mijn groepen
          </label>
        )}
      </div>

      {zichtbareGroepen.length === 0 ? (
        <p className="lege-staat">
          Nog geen eigen groepen. Maak er een aan met een naam en een zelfgekozen set leerlingen.
        </p>
      ) : (
        <div className="groep-kaarten">
          {zichtbareGroepen.map((g) => {
            const ll = leden(g.leerlingIds);
            return (
              <div key={g.id} className="groep-kaart">
                <div className="groep-kaart-naam">{g.naam}</div>
                <div className="groep-kaart-meta">
                  {g.leerlingIds.length} leerlingen
                  {g.mentorId && (
                    <> · {g.mentorId === mentorId ? "van mij" : mentorNaam(g.mentorId)}</>
                  )}
                </div>

                <Avatars leden={ll} />
                <Samenstelling leden={ll} />

                <div className="groep-kaart-acties">
                  <button
                    type="button"
                    className="linkknop"
                    onClick={() => toonInMatrix(`eigen:${g.id}`)}
                  >
                    Toon in matrix
                  </button>
                  <button
                    type="button"
                    className="linkknop"
                    onClick={() => setEditor({ id: g.id })}
                  >
                    Bewerken
                  </button>
                  <button
                    type="button"
                    className="linkknop linkknop-gevaar"
                    onClick={() => {
                      if (confirm(`Groep "${g.naam}" verwijderen?`)) verwijderGroep(g.id);
                    }}
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Standaardgroepen</h2>
      <p style={{ color: "var(--text-muted)" }}>
        Automatisch afgeleid uit de leerlinggegevens. Niet bewerkbaar, wel bruikbaar als filter.
      </p>
      {SYSTEEM_SOORTEN.map((soort) => {
        const rijen = systeem.filter((d) => d.soort === soort);
        if (rijen.length === 0) return null;
        return (
          <div key={soort} style={{ marginTop: 18 }}>
            <h3 className="groep-soort-kop">{SOORT_LABEL[soort]}</h3>
            <div className="groep-mini-kaarten">
              {rijen.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="groep-mini-kaart"
                  onClick={() => toonInMatrix(d.id)}
                >
                  <span className="groep-mini-naam">{d.naam}</span>
                  <span className="groep-mini-aantal">
                    {d.leerlingIds.length} <span>leerlingen</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Avatars({ leden }: { leden: Student[] }) {
  if (leden.length === 0) return null;
  const toon = leden.slice(0, 8);
  const rest = leden.length - toon.length;
  return (
    <div className="groep-avatars">
      {toon.map((s) => (
        <span key={s.id} className="groep-avatar" title={`${s.firstName} ${s.lastName}`}>
          {init(s)}
        </span>
      ))}
      {rest > 0 && <span className="groep-avatar groep-avatar-rest">+{rest}</span>}
    </div>
  );
}

function Samenstelling({ leden }: { leden: Student[] }) {
  const perStroom = useMemo(() => {
    const t = new Map<string, number>();
    for (const s of leden) {
      const k = stroomVan(s);
      t.set(k, (t.get(k) ?? 0) + 1);
    }
    return [...t.entries()].sort((a, b) => b[1] - a[1]);
  }, [leden]);

  if (perStroom.length === 0) return null;
  return (
    <div className="groep-samenstelling">
      {perStroom.map(([stroom, aantal]) => (
        <span key={stroom} className="groep-chip">
          {stroom} <strong>{aantal}</strong>
        </span>
      ))}
    </div>
  );
}
