import { useMemo, useState } from "react";
import { BadgeEditor } from "../components/BadgeEditor";
import { Modal } from "../components/Modal";
import { PotloodIcoon } from "../components/RijIcoontjes";
import { StroomBalk } from "../components/StroomBalk";
import type { BadgeRuw } from "../lib/curriculum";
import { SOORT_KLEUR, SOORT_LABEL } from "../lib/minimumdoelen";
import { gebundeldCurriculum, useStore, verplaatsBadge } from "../lib/store";
import { STROOM_LABEL } from "../lib/types";

/**
 * Beheer van de échte badges (leerdoelen) — beheerder-only, analoog aan de deelbadges-editor
 * maar dan voor de vaste curriculumstructuur (Cursus → Badge) i.p.v. de mentor-gemaakte toetsen.
 * Schrijft via `maakBadge`/`wijzigBadge`/`verwijderBadge`/`verplaatsBadge` (`store.ts`) naar
 * dezelfde database-versie als "Zet de ingebouwde badges in de database" (/gegevens) — de eerste
 * bewerking start dus vanaf de ingebouwde set, niet vanaf leeg.
 */
export function BadgesBeheer() {
  const { curriculumOverride, matrixStromen } = useStore();
  const basis = curriculumOverride ?? gebundeldCurriculum();
  const [dicht, setDicht] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<null | { cursusId: string; badge?: BadgeRuw }>(null);

  const cursussenPerStroom = useMemo(
    () =>
      matrixStromen.map((stroom) => ({
        stroom,
        cursussen: basis.cursussen
          .filter((c) => c.stroom === stroom)
          .sort((a, b) => a.volgorde - b.volgorde),
      })),
    [basis.cursussen, matrixStromen],
  );

  const badgesVoor = (cursusId: string): BadgeRuw[] =>
    [...basis.badges]
      .filter((b) => b.cursusId === cursusId)
      .sort((a, b) => a.volgorde - b.volgorde);

  const toggleCursus = (sleutel: string) =>
    setDicht((prev) => {
      const next = new Set(prev);
      if (next.has(sleutel)) next.delete(sleutel);
      else next.add(sleutel);
      return next;
    });

  const meerdereStromen = matrixStromen.length > 1;

  return (
    <section>
      <div className="pagina-kop">
        <h2>Badges beheren</h2>
      </div>
      <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
        De echte badges (leerdoelen) per cursus — dit is de vaste structuur die de
        badgeboek-matrix en de rubrics gebruiken. Badges met dezelfde <strong>groep</strong>{" "}
        binnen een cursus vormen samen één deelbadge-type. Wijzigingen hier gelden voor de hele
        school.
      </p>

      <StroomBalk hint="meerdere mogelijk" />

      {cursussenPerStroom.map(({ stroom, cursussen }) =>
        cursussen.length === 0 ? null : (
          <div key={stroom} style={{ marginTop: 8 }}>
            {meerdereStromen && (
              <h2 className="stroom-matrix-titel rubriek-stroom-titel">{STROOM_LABEL[stroom]}</h2>
            )}
            {cursussen.map((c) => {
              const badges = badgesVoor(c.id);
              const sleutel = `${stroom}|${c.id}`;
              const open = !dicht.has(sleutel);
              return (
                <div key={c.id} className="doel-comp">
                  <button type="button" className="doel-comp-kop" onClick={() => toggleCursus(sleutel)}>
                    <span className="grid-caret">{open ? "▾" : "▸"}</span>
                    {c.naam}
                    <span className="grid-count">{badges.length}</span>
                  </button>
                  {open && (
                    <div className="badge-beheer-lijst-wrap">
                      {badges.length === 0 ? (
                        <p className="lege-staat">Nog geen badges voor deze cursus.</p>
                      ) : (
                        <ul className="badge-lijst">
                          {badges.map((b, i) => (
                            <li key={b.id} className="badge-rij">
                              <span className="badge-rij-omschrijving">{b.omschrijving}</span>
                              <span className="badge-rij-groep">{b.groep}</span>
                              <span className={`soort-tag rating-${SOORT_KLEUR[b.categorie]}`}>
                                {SOORT_LABEL[b.categorie]}
                              </span>
                              <span className="badge-rij-acties">
                                <button
                                  type="button"
                                  className="knop-icoon knop-icoon-klein knop-icoon--plat"
                                  title="Naar boven"
                                  aria-label={`"${b.omschrijving}" naar boven`}
                                  disabled={i === 0}
                                  onClick={() => verplaatsBadge(b.id, "omhoog")}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="knop-icoon knop-icoon-klein knop-icoon--plat"
                                  title="Naar beneden"
                                  aria-label={`"${b.omschrijving}" naar beneden`}
                                  disabled={i === badges.length - 1}
                                  onClick={() => verplaatsBadge(b.id, "omlaag")}
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  className="knop-icoon knop-icoon-klein knop-icoon--plat"
                                  title="Bewerken"
                                  aria-label={`"${b.omschrijving}" bewerken`}
                                  onClick={() => setEditor({ cursusId: c.id, badge: b })}
                                >
                                  <PotloodIcoon />
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        className="linkknop"
                        onClick={() => setEditor({ cursusId: c.id })}
                      >
                        + Badge toevoegen
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ),
      )}

      {editor && (
        <Modal
          label={editor.badge ? "Badge bewerken" : "Nieuwe badge"}
          onClose={() => setEditor(null)}
        >
          <BadgeEditor
            cursusId={editor.cursusId}
            bestaand={editor.badge}
            onSluit={() => setEditor(null)}
          />
        </Modal>
      )}
    </section>
  );
}
