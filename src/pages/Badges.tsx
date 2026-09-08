import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BulkKnop } from "../components/BulkKnop";
import { ColorBar } from "../components/ColorBar";
import { DeelPaneel } from "../components/DeelPaneel";
import { LeerlingFilterBar } from "../components/LeerlingFilterBar";
import { NotitieVeld } from "../components/NotitieVeld";
import { RatingCell } from "../components/RatingCell";
import { StroomBalk } from "../components/StroomBalk";
import {
  alleCursussen,
  cursussenVoorStroom,
  leerdoelenVoorCursus,
  leerdoelenVoorStroom,
} from "../lib/curriculum";
import { deelevaluatiesVoorBadge } from "../lib/deelevaluaties";
import { alleGroepDefs, groepLeden, stromenVanGroep } from "../lib/groepen";
import { aantalBehaald, telKleuren } from "../lib/kleurstats";
import { filterLeerlingen, stroomVan, useLeerlingFilter } from "../lib/leerlingen";
import type { LeerlingFilter } from "../lib/leerlingen";
import { useZichtbareLeerlingen } from "../lib/rechten";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "../lib/schooljaar";
import { useScrollSync } from "../lib/useScrollSync";
import { useGeschiedenis, useWijzigingLabel } from "../lib/wijzigingslog";
import {
  getDoelKleur,
  getNotitie,
  setDoelKleur,
  setDoelKleurBulk,
  setMatrixCursus,
  setMatrixStromen,
  useStore,
  zetNotitie,
} from "../lib/store";
import { STROOM_LABEL, doelSleutel } from "../lib/types";
import type { Deelevaluatie, DoelKleuren, Leerdoel, Notities, Stroom, Student } from "../lib/types";

/**
 * Badgematrix: badges (plat per cursus) als rijen, leerlingen als kolommen.
 * Cursussen zijn in- en uitklapbaar zodat een mentor enkel toont wat relevant is
 * (bv. wiskunde zonder de talen). De inklapstand wordt lokaal onthouden.
 *
 * De stroomkeuze bepaalt zowel welke badges als welke leerlingen zichtbaar zijn: sta je op
 * "1e graad A", dan zie je enkel A-leerlingen. Meerdere stromen tegelijk kan (bv. 1A + 1B):
 * elke stroom krijgt dan zijn eigen tabel — badges én leerlingen apart, allebei bewerkbaar.
 *
 * (In de code heten de badges nog `leerdoel` — enkel de labels zijn "badge".)
 */

const FOLD_KEY = "keerpunt-badgeboek:matrix-fold:v2";

/** Standaard: alle cursussen toegeklapt, zodat je niet langs alles moet scrollen. */
const alleCursusIds = () => alleCursussen().map((c) => c.id);

interface Fold {
  /** Ingeklapte cursussen (badges eronder verborgen). */
  cursus: string[];
}

function loadFold(): Fold {
  try {
    const raw = localStorage.getItem(FOLD_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Fold>;
      return { cursus: p.cursus ?? alleCursusIds() };
    }
  } catch {
    // geen opgeslagen stand
  }
  return { cursus: alleCursusIds() };
}

const zonder = (arr: string[], id: string) => arr.filter((x) => x !== id);
const met = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id]);

interface StroomMatrixProps {
  stroom: Stroom;
  leerlingen: Student[];
  fold: Fold;
  toggleCursus: (id: string) => void;
  kleuren: DoelKleuren;
  notities: Notities;
  deelevaluaties: Deelevaluatie[];
  schooljaar: string;
  vergrendeld: boolean;
  toonTitel: boolean;
  /** Cursusfilter op naam; "" = alle. */
  cursusFilter: string;
  /** Leerdoel-id van de badge waarvan het deelevaluatie-zijpaneel open staat. */
  gekozenBadge: string | null;
  onKiesBadge: (leerdoelId: string) => void;
  /** Koppelt het scroll-kader aan de gesynchroniseerde horizontale scroll met het zijpaneel. */
  scrollRef?: (el: HTMLDivElement | null) => void;
}

/** Eén badgematrix voor precies één stroom: die stroom zijn cursussen × die stroom zijn leerlingen. */
function StroomMatrix({
  stroom,
  leerlingen,
  fold,
  toggleCursus,
  kleuren,
  notities,
  deelevaluaties,
  schooljaar,
  vergrendeld,
  toonTitel,
  cursusFilter,
  gekozenBadge,
  onKiesBadge,
  scrollRef,
}: StroomMatrixProps) {
  const wijzigingLabel = useWijzigingLabel();
  const geschiedenis = useGeschiedenis();
  const cursussen = cursussenVoorStroom(stroom).filter(
    (c) => !cursusFilter || c.naam === cursusFilter,
  );
  const stroomDeelevaluaties = useMemo(
    () => deelevaluaties.filter((d) => d.schooljaar === schooljaar && d.stroom === stroom),
    [deelevaluaties, schooljaar, stroom],
  );
  // De samenvatting onderaan telt de badges van de getoonde cursussen (dus mee gefilterd).
  const stroomLeerdoelen = useMemo(
    () =>
      cursusFilter
        ? cursussenVoorStroom(stroom)
            .filter((c) => c.naam === cursusFilter)
            .flatMap((c) => leerdoelenVoorCursus(c.id))
        : leerdoelenVoorStroom(stroom),
    [stroom, cursusFilter],
  );
  const alleIds = leerlingen.map((s) => s.id);

  /** De kleurcellen (RatingCell + notitie-vierkantje per leerling) voor één node. */
  const kleurCellen = (nodeId: string, naam: string) =>
    leerlingen.map((s) => {
      const kleur = getDoelKleur(kleuren, schooljaar, s.id, nodeId);
      const sleutel = doelSleutel(schooljaar, s.id, nodeId);
      const wLabel = wijzigingLabel(sleutel) ?? undefined;
      return (
        <td key={s.id} className="grid-cel" title={wLabel}>
          {/* rating-klasse op de wrapper: het notitie-vierkantje pikt die kleur op */}
          <div className={`grid-cel-inhoud rating-${kleur ?? "empty"}`}>
            <RatingCell
              label={`${s.firstName} — ${naam}`}
              readonly={vergrendeld}
              value={kleur}
              geschiedenis={geschiedenis(sleutel)}
              onChange={(next) => setDoelKleur(schooljaar, s.id, nodeId, next)}
            />
            <NotitieVeld
              notitie={getNotitie(notities, schooljaar, s.id, nodeId)}
              onSave={(patch) => zetNotitie(schooljaar, s.id, nodeId, patch)}
              readonly={vergrendeld}
            />
          </div>
        </td>
      );
    });

  /** De eerste kolom van een cursusrij: inklaptoggle + bulk-knop. */
  const nodeKop = (
    nodeId: string,
    naam: string,
    aantal: number,
    dicht: boolean,
    onToggle: () => void,
  ) => (
    <th className="grid-col-doel">
      <div className="grid-doel-rij">
        <button type="button" className="grid-toggle" onClick={onToggle}>
          <span className="grid-caret">{dicht ? "▶" : "▼"}</span>
          {naam}
          <span className="grid-count">{aantal}</span>
        </button>
        <BulkKnop
          aantal={leerlingen.length}
          disabled={vergrendeld}
          onKies={(kleur) => setDoelKleurBulk(schooljaar, alleIds, nodeId, kleur)}
        />
      </div>
    </th>
  );

  const doelRij = (doel: Leerdoel) => {
    const aantalDeel = deelevaluatiesVoorBadge(
      stroomDeelevaluaties,
      doel.id,
      schooljaar,
      cursusFilter,
    ).length;
    const gekozen = gekozenBadge === doel.id;
    return (
      <tr key={doel.id} className={gekozen ? "is-gekozen" : undefined}>
        <td className="grid-col-doel grid-doel grid-doel-n1">
          <div className="grid-doel-rij">
            <span className="grid-doel-tekst">{doel.omschrijving}</span>
            <button
              type="button"
              className={`grid-deel-chip${gekozen ? " is-actief" : ""}${
                aantalDeel === 0 ? " is-leeg" : ""
              }`}
              title={
                aantalDeel > 0
                  ? `${aantalDeel} gekoppelde deelbadge${aantalDeel === 1 ? "" : "s"} — bekijk in het zijpaneel`
                  : "Deelbadges bij deze badge — bekijk of maak er een aan"
              }
              aria-label={
                aantalDeel > 0
                  ? `Deelbadges bij deze badge (${aantalDeel})`
                  : "Deelbadges bij deze badge"
              }
              aria-pressed={gekozen}
              onClick={() => onKiesBadge(doel.id)}
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M5 2.5h6M4 4.5h8v9H4zM6.5 7.5h5M6.5 10h5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {aantalDeel > 0 && aantalDeel}
            </button>
            <BulkKnop
              aantal={leerlingen.length}
              disabled={vergrendeld}
              onKies={(kleur) => setDoelKleurBulk(schooljaar, alleIds, doel.id, kleur)}
            />
          </div>
        </td>
        {kleurCellen(doel.id, doel.omschrijving)}
      </tr>
    );
  };

  const kolomTotalen = leerlingen.map((s) =>
    telKleuren(stroomLeerdoelen.map((d) => getDoelKleur(kleuren, schooljaar, s.id, d.id))),
  );

  const titel = toonTitel ? (
    <h2 className="stroom-matrix-titel">
      {STROOM_LABEL[stroom]}
      <span>
        {leerlingen.length} {leerlingen.length === 1 ? "leerling" : "leerlingen"} ·{" "}
        {stroomLeerdoelen.length} badges
      </span>
    </h2>
  ) : null;

  if (cursussen.length === 0) {
    return (
      <div className="stroom-matrix">
        {titel}
        <p className="lege-staat">
          {cursusFilter
            ? `De cursus "${cursusFilter}" komt niet voor in ${STROOM_LABEL[stroom]}.`
            : `Nog geen badges voor ${STROOM_LABEL[stroom]}. Dit badgeboek is nog niet verwerkt.`}
        </p>
      </div>
    );
  }
  if (leerlingen.length === 0) {
    return (
      <div className="stroom-matrix">
        {titel}
        <p className="lege-staat">Geen leerlingen in {STROOM_LABEL[stroom]} voor deze filter.</p>
      </div>
    );
  }

  return (
    <div className="stroom-matrix">
      {titel}
      <div className="grid-wrap" ref={scrollRef}>
        <table className="grid">
          <thead>
            <tr>
              <th className="grid-col-doel">Badge</th>
              {leerlingen.map((s) => (
                <th
                  key={s.id}
                  className="grid-col-leerling"
                  title={`${s.firstName} ${s.lastName}`}
                >
                  <Link to={`/students/${s.id}`}>{s.firstName}</Link>
                  <span className="grid-col-leerling-sub">
                    {s.lastName} · {s.leerjaar}e · {s.klasgroep}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {cursussen.map((cursus) => {
            // Filter je op één cursus, dan staat die sowieso open.
            const cursusDicht = !cursusFilter && fold.cursus.includes(cursus.id);
            const cursusDoelen = leerdoelenVoorCursus(cursus.id);
            return (
              <tbody key={cursus.id}>
                <tr className="grid-cursus">
                  {nodeKop(
                    cursus.id,
                    cursus.naam,
                    cursusDoelen.length,
                    cursusDicht,
                    () => toggleCursus(cursus.id),
                  )}
                  {/* Geen evaluatie op cursusniveau, wel een leesbare samenvatting per leerling:
                      hoeveel badges van deze cursus al behaald + de kleurverdeling. */}
                  {leerlingen.map((s) => {
                    const t = telKleuren(
                      cursusDoelen.map((d) => getDoelKleur(kleuren, schooljaar, s.id, d.id)),
                    );
                    return (
                      <td
                        key={s.id}
                        className="grid-cel grid-cel-cursus"
                        title={`${s.firstName} — ${aantalBehaald(t)} van ${cursusDoelen.length} badges behaald in ${cursus.naam}`}
                      >
                        <div className="grid-cursus-samenvatting">
                          <span>
                            {aantalBehaald(t)}/{cursusDoelen.length}
                          </span>
                          <ColorBar telling={t} />
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {!cursusDicht && cursusDoelen.map((d) => doelRij(d))}
              </tbody>
            );
          })}

          <tfoot>
            <tr>
              <th className="grid-col-doel">Samenvatting</th>
              {kolomTotalen.map((t, i) => (
                <td key={leerlingen[i].id} className="grid-foot-cel">
                  <div>
                    {stroomLeerdoelen.length - t.leeg}/{stroomLeerdoelen.length} ingevuld
                  </div>
                  <ColorBar telling={t} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function Badges() {
  const { kleuren, notities, deelevaluaties, groepen, schooljaar, matrixStromen, matrixCursus } =
    useStore();
  const students = useZichtbareLeerlingen();
  const [filter, setFilter] = useLeerlingFilter();
  const [fold, setFold] = useState<Fold>(loadFold);
  const [gekozenBadge, setGekozenBadge] = useState<string | null>(null);
  const vergrendeld = isAfgesloten(schooljaar);
  const archief = !vergrendeld && schooljaar !== HUIDIG_SCHOOLJAAR;

  const groepDefs = useMemo(() => alleGroepDefs(students, groepen), [students, groepen]);

  // Kies je een groep in de filterbalk, dan schuift de stroomkeuze automatisch mee naar de
  // stromen van díé groep — anders kun je "1e graad" aanduiden en toch een groep uit het
  // 3e jaar kiezen, waarna de matrix niemand toont.
  const onFilterChange = (next: LeerlingFilter) => {
    setFilter(next);
    if (next.groepId && next.groepId !== filter.groepId) {
      const stromen = stromenVanGroep(next.groepId, students, groepen);
      if (stromen.length > 0) setMatrixStromen(stromen);
    }
  };

  // Cursusnamen over alle gekozen stromen (voor de cursusfilter).
  const cursusOpties = useMemo(() => {
    const uit: string[] = [];
    for (const s of matrixStromen) {
      for (const c of cursussenVoorStroom(s)) if (!uit.includes(c.naam)) uit.push(c.naam);
    }
    return uit;
  }, [matrixStromen]);
  const cursusFilter = cursusOpties.includes(matrixCursus) ? matrixCursus : "";

  // De stroomchips bepalen al de graad/klasgroep-as, dus die velden in de filterbalk laten
  // we weg en negeren we hier — geen dubbel systeem.
  const stroomLeerlingen = useMemo(
    () => students.filter((s) => matrixStromen.includes(stroomVan(s))),
    [students, matrixStromen],
  );
  const zichtbaar = useMemo(() => {
    const leden = groepLeden(filter.groepId, students, groepen);
    const zonderStroomvelden = { ...filter, graad: "", klasgroep: "" };
    return filterLeerlingen(stroomLeerlingen, zonderStroomvelden, leden);
  }, [students, groepen, filter, stroomLeerlingen]);

  const leerlingenPerStroom = useMemo(
    () =>
      matrixStromen.map((s) => ({
        stroom: s,
        leerlingen: zichtbaar.filter((l) => stroomVan(l) === s),
      })),
    [matrixStromen, zichtbaar],
  );

  // Het zijpaneel toont de deelevaluaties van de gekozen badge, met de leerlingen van díé
  // badge zijn stroom (de badge-id begint met de stroomcode).
  const paneelStroom = gekozenBadge
    ? matrixStromen.find((s) => gekozenBadge.startsWith(`${s}-`))
    : undefined;
  const paneelLeerlingen =
    leerlingenPerStroom.find((x) => x.stroom === paneelStroom)?.leerlingen ?? [];
  const toonPaneel = Boolean(gekozenBadge && paneelStroom && paneelLeerlingen.length > 0);

  // Horizontaal scrollen loopt gelijk tussen de badgematrix en het deelevaluatie-zijpaneel.
  const syncScroll = useScrollSync();

  useEffect(() => {
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify(fold));
    } catch {
      // opslag niet beschikbaar — stand blijft enkel voor deze sessie
    }
  }, [fold]);

  const toggleCursus = (id: string) =>
    setFold((f) => ({
      cursus: f.cursus.includes(id) ? zonder(f.cursus, id) : met(f.cursus, id),
    }));

  const allesDicht = () => {
    const cursusIds = matrixStromen.flatMap((s) => cursussenVoorStroom(s).map((c) => c.id));
    setFold({ cursus: cursusIds });
  };
  const allesOpen = () => setFold({ cursus: [] });

  return (
    <section>
      <StroomBalk hint="meerdere mogelijk" />

      {vergrendeld && (
        <p className="jaar-melding jaar-melding-slot">
          🔒 Schooljaar <strong>{schooljaar}</strong> is afgesloten. De evaluaties staan vast en
          kunnen niet meer gewijzigd worden.
        </p>
      )}
      {archief && (
        <p className="jaar-melding">
          Je bekijkt schooljaar <strong>{schooljaar}</strong> (niet het lopende schooljaar).
          Wijzigingen worden bewaard bij dat schooljaar. Wissel bovenaan van schooljaar.
        </p>
      )}

      <LeerlingFilterBar
        alle={stroomLeerlingen}
        zichtbaar={zichtbaar.length}
        groepen={groepDefs}
        filter={filter}
        onChange={onFilterChange}
        verbergVelden={["graad", "klasgroep"]}
        cursusOpties={cursusOpties}
        cursus={cursusFilter}
        onCursusChange={setMatrixCursus}
      />

      <div className="matrix-acties">
        <button type="button" className="linkknop" onClick={allesOpen}>
          Alles uitklappen
        </button>
        <button type="button" className="linkknop" onClick={allesDicht}>
          Alles inklappen
        </button>
      </div>

      <div className={toonPaneel ? "badges-split" : undefined}>
        <div className="badges-hoofd">
          {zichtbaar.length === 0 ? (
            <p className="lege-staat">
              Geen leerlingen voor deze stroom en filter. Duid de juiste stroom aan of pas de
              filter aan.
            </p>
          ) : (
            leerlingenPerStroom.map(({ stroom, leerlingen }) => (
              <StroomMatrix
                key={stroom}
                stroom={stroom}
                leerlingen={leerlingen}
                fold={fold}
                toggleCursus={toggleCursus}
                kleuren={kleuren}
                notities={notities}
                deelevaluaties={deelevaluaties}
                schooljaar={schooljaar}
                vergrendeld={vergrendeld}
                toonTitel={matrixStromen.length > 1}
                cursusFilter={cursusFilter}
                gekozenBadge={gekozenBadge}
                onKiesBadge={(id) => setGekozenBadge((cur) => (cur === id ? null : id))}
                scrollRef={toonPaneel && stroom === paneelStroom ? syncScroll : undefined}
              />
            ))
          )}
        </div>

        {toonPaneel && gekozenBadge && (
          <DeelPaneel
            leerdoelId={gekozenBadge}
            leerlingen={paneelLeerlingen}
            schooljaar={schooljaar}
            cursusFilter={cursusFilter}
            vergrendeld={vergrendeld}
            onSluit={() => setGekozenBadge(null)}
            scrollRef={syncScroll}
          />
        )}
      </div>
    </section>
  );
}
