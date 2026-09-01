import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GroepEditor } from "../components/GroepEditor";
import { LEEG_FILTER, useLeerlingFilter } from "../lib/leerlingen";
import {
  SOORT_LABEL,
  SYSTEEM_SOORTEN,
  systeemGroepen,
} from "../lib/groepen";
import { useStore, verwijderGroep } from "../lib/store";

/**
 * Groepenpagina: zelfgemaakte groepen beheren + alle standaardgroepen (graad, leerjaar,
 * vestiging, klasgroep). Vanaf hier open je een groep in de badgematrix.
 */
export function Groepen() {
  const { students, groepen } = useStore();
  const [, setFilter] = useLeerlingFilter();
  const navigate = useNavigate();
  const [editor, setEditor] = useState<null | { id?: string }>(null);

  const systeem = useMemo(() => systeemGroepen(students), [students]);
  const teBewerken = editor?.id
    ? groepen.find((g) => g.id === editor.id)
    : undefined;

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
        <GroepEditor groep={teBewerken} onSluit={() => setEditor(null)} />
      )}

      <h2>Mijn groepen</h2>
      {groepen.length === 0 ? (
        <p className="lege-staat">
          Nog geen eigen groepen. Maak er een aan met een naam en een zelfgekozen set leerlingen.
        </p>
      ) : (
        <div className="groep-kaarten">
          {groepen.map((g) => (
            <div key={g.id} className="groep-kaart">
              <div className="groep-kaart-naam">{g.naam}</div>
              <div className="groep-kaart-meta">{g.leerlingIds.length} leerlingen</div>
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
          ))}
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
          <div key={soort} style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 6px" }}>
              {SOORT_LABEL[soort]}
            </h3>
            <div className="groep-lijst">
              {rijen.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="groep-rij"
                  onClick={() => toonInMatrix(d.id)}
                >
                  <span>{d.naam}</span>
                  <span className="groep-rij-meta">{d.leerlingIds.length} leerlingen →</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
