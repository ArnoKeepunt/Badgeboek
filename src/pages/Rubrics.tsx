import { Fragment, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../components/Modal";
import { RubriekEditor } from "../components/RubriekEditor";
import { StroomBalk } from "../components/StroomBalk";
import { usePopover } from "../lib/popover";
import { RATING_LABEL } from "../lib/ratings";
import {
  DOEL_SOORTEN,
  type DoelSoort,
  type DoelTreffer,
  SOORT_KLEUR,
  SOORT_LABEL,
  codeMatchtPrefix,
  zoekDoel,
} from "../lib/rubriekDoelen";
import { useEffectieveRol } from "../lib/sessie";
import { rubriekIsBewerkt, rubriekenLijst, setMatrixCursus, useStore } from "../lib/store";
import { STROOM_LABEL, type Kleurcriteria, type Rubriek } from "../lib/types";

function PotloodIcoon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.5 2.5l3 3L6 13l-3.5.5L3 10z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Rubrics beschrijven enkel de vier kleuren (geen witte statussen). */
const KLEUREN = ["blue", "green", "yellow", "red"] as const;

/** Kleur → sleutel in `Kleurcriteria`. */
const KLEUR_KEY: Record<(typeof KLEUREN)[number], keyof Kleurcriteria> = {
  red: "rood",
  yellow: "geel",
  green: "groen",
  blue: "blauw",
};

interface KaartItem {
  r: Rubriek;
  treffers: DoelTreffer[];
}

/**
 * Rubrics: de uitgeschreven beoordelingsrubrieken. Bovenaan de gedeelde stroom+cursus-balk
 * (meerdere graden aanduidbaar); daaronder filteren op doelcode en soort. Per rubric: de
 * omschrijving per kleur, de gekoppelde doelen (kleur = soort, klik = nalezen) en de leerlijn.
 * Alleen-lezen, behalve voor de beheerder (potlood → overlay).
 */
export function Rubrics() {
  const { rubriekWijzigingen, rubriekenOverride, matrixStromen, matrixCursus } = useStore();
  const magBewerken = useEffectieveRol() === "beheerder";
  // rubriekenLijst() leest de store; herbereken als de bron of de patches wijzigen.
  const alle = useMemo(
    () => rubriekenLijst(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rubriekenOverride, rubriekWijzigingen],
  );

  const [doelFilter, setDoelFilter] = useState("");
  const [soortFilter, setSoortFilter] = useState<Set<DoelSoort>>(new Set());
  const [dicht, setDicht] = useState<Set<string>>(new Set()); // sleutel = `${stroom}|${cursus}`
  const [leerlijnOpen, setLeerlijnOpen] = useState<Set<string>>(new Set());
  const [doelOpen, setDoelOpen] = useState<Set<string>>(new Set());
  const [bewerk, setBewerk] = useState<Rubriek | null>(null);

  const cursusOpties = useMemo(() => {
    const uit: string[] = [];
    for (const r of alle) {
      if (matrixStromen.includes(r.stroom) && !uit.includes(r.cursus)) uit.push(r.cursus);
    }
    return uit;
  }, [alle, matrixStromen]);
  const cursusFilter = cursusOpties.includes(matrixCursus) ? matrixCursus : "";
  const filterActief = Boolean(cursusFilter || doelFilter.trim() || soortFilter.size);

  const perStroom = useMemo(
    () =>
      matrixStromen.map((stroom) => {
        const items: KaartItem[] = alle
          .filter((r) => r.stroom === stroom)
          .map((r) => ({ r, treffers: r.doelen.map((code) => zoekDoel(code, r.stroom)) }))
          .filter(({ r, treffers }) => {
            if (cursusFilter && r.cursus !== cursusFilter) return false;
            if (doelFilter.trim() && !treffers.some((t) => codeMatchtPrefix(t.code, doelFilter)))
              return false;
            if (soortFilter.size && !treffers.some((t) => soortFilter.has(t.soort))) return false;
            return true;
          });
        const kaart = new Map<string, KaartItem[]>();
        for (const it of items) {
          const lijst = kaart.get(it.r.cursus) ?? [];
          lijst.push(it);
          kaart.set(it.r.cursus, lijst);
        }
        return {
          stroom,
          totaal: alle.filter((r) => r.stroom === stroom).length,
          getoond: items.length,
          perCursus: [...kaart.entries()],
        };
      }),
    [alle, matrixStromen, cursusFilter, doelFilter, soortFilter],
  );

  const totaalGetoond = perStroom.reduce((n, s) => n + s.getoond, 0);
  const totaalAlles = perStroom.reduce((n, s) => n + s.totaal, 0);
  const meerdereStromen = matrixStromen.length > 1;

  const alleCursusSleutels = useMemo(
    () => perStroom.flatMap((s) => s.perCursus.map(([cursus]) => `${s.stroom}|${cursus}`)),
    [perStroom],
  );

  const toggleCursus = (sleutel: string) => setDicht((prev) => vervang(prev, sleutel));
  const allesOpen = () => setDicht(new Set());
  const allesDicht = () => setDicht(new Set(alleCursusSleutels));
  const toggleLeerlijn = (id: string) => setLeerlijnOpen((prev) => vervang(prev, id));
  const toggleDoel = (sleutel: string) => setDoelOpen((prev) => vervang(prev, sleutel));
  const toggleSoort = (s: DoelSoort) =>
    setSoortFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  const wisFilters = () => {
    setMatrixCursus("");
    setDoelFilter("");
    setSoortFilter(new Set());
  };

  if (alle.length === 0) {
    return (
      <section>
        <p className="lege-staat">
          Er zijn nog geen rubrieken uitgeschreven. Zodra het bronbestand aangevuld is,
          verschijnen ze hier.
        </p>
      </section>
    );
  }

  return (
    <section>
      <StroomBalk hint="meerdere mogelijk" />

      <div className="filterbar">
        <select
          className="filterbar-cursus"
          value={cursusFilter}
          aria-label="Filter op cursus"
          onChange={(e) => setMatrixCursus(e.target.value)}
        >
          <option value="">Alle cursussen</option>
          {cursusOpties.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="search"
          className="filterbar-zoek"
          placeholder="Doel bevat… (bv. 16. of BG04)"
          value={doelFilter}
          onChange={(e) => setDoelFilter(e.target.value)}
        />
        <SoortDropdown
          waarde={soortFilter}
          onToggle={toggleSoort}
          onWisAlle={() => setSoortFilter(new Set())}
        />
        {filterActief && (
          <button type="button" className="linkknop" onClick={wisFilters}>
            Filters wissen
          </button>
        )}
      </div>

      <p className="rubriek-intro">
        {totaalGetoond} van {totaalAlles} rubrieken · klik een doel aan om het na te lezen. De
        doelkleur toont de soort:
      </p>
      <div className="rubriek-legende">
        {DOEL_SOORTEN.map((s) => (
          <span key={s} className={`soort-tag rating-${SOORT_KLEUR[s]}`}>
            {SOORT_LABEL[s]}
          </span>
        ))}
      </div>

      {!filterActief && totaalGetoond > 0 && (
        <div className="matrix-acties">
          <button type="button" className="linkknop" onClick={allesOpen}>
            Alles uitklappen
          </button>
          <button type="button" className="linkknop" onClick={allesDicht}>
            Alles inklappen
          </button>
        </div>
      )}

      {totaalGetoond === 0 ? (
        <p className="lege-staat">Geen rubrieken voor deze filter.</p>
      ) : (
        perStroom.map(({ stroom, totaal, perCursus }) => (
          <Fragment key={stroom}>
            {meerdereStromen && (
              <h2 className="stroom-matrix-titel rubriek-stroom-titel">
                {STROOM_LABEL[stroom]}
                <span>{totaal} rubrieken</span>
              </h2>
            )}
            {perCursus.length === 0
              ? meerdereStromen && (
                  <p className="lege-staat">
                    {totaal === 0
                      ? `Nog geen rubrieken uitgeschreven voor ${STROOM_LABEL[stroom]}.`
                      : "Geen rubrieken voor deze filter."}
                  </p>
                )
              : perCursus.map(([cursus, lijst]) => {
                  const sleutel = `${stroom}|${cursus}`;
                  const open = filterActief || !dicht.has(sleutel);
                  return (
                    <div key={sleutel} className="doel-comp">
                      <button
                        type="button"
                        className="doel-comp-kop"
                        onClick={() => toggleCursus(sleutel)}
                      >
                        <span className="grid-caret">{open ? "▾" : "▸"}</span>
                        {cursus}
                        <span className="grid-count">{lijst.length}</span>
                      </button>
                      {open && (
                        <div className="rubriek-lijst">
                          {lijst.map(({ r, treffers }) => (
                            <RubriekKaart
                              key={r.id}
                              r={r}
                              treffers={treffers}
                              magBewerken={magBewerken}
                              bewerkt={rubriekIsBewerkt(r.id)}
                              doelFilter={doelFilter}
                              leerlijnOpen={leerlijnOpen.has(r.id)}
                              doelOpen={doelOpen}
                              onBewerk={() => setBewerk(r)}
                              onLeerlijn={() => toggleLeerlijn(r.id)}
                              onDoel={toggleDoel}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
          </Fragment>
        ))
      )}

      {bewerk && (
        <Modal groot label="Rubric bewerken" onClose={() => setBewerk(null)}>
          <RubriekEditor rubriek={bewerk} onSluit={() => setBewerk(null)} />
        </Modal>
      )}
    </section>
  );
}

/** Eén rubric-kaart: naam, doelchips (aanklikbaar), criteria per kleur, leerlijn. */
function RubriekKaart({
  r,
  treffers,
  magBewerken,
  bewerkt,
  doelFilter,
  leerlijnOpen,
  doelOpen,
  onBewerk,
  onLeerlijn,
  onDoel,
}: {
  r: Rubriek;
  treffers: DoelTreffer[];
  magBewerken: boolean;
  bewerkt: boolean;
  doelFilter: string;
  leerlijnOpen: boolean;
  doelOpen: Set<string>;
  onBewerk: () => void;
  onLeerlijn: () => void;
  onDoel: (sleutel: string) => void;
}) {
  const ietsOpen = treffers.some((_, i) => doelOpen.has(`${r.id}|${i}`));
  return (
    <article className="rubriek">
      {magBewerken && (
        <button
          type="button"
          className="knop-icoon knop-icoon-klein rubriek-bewerk"
          title="Rubric bewerken"
          aria-label={`"${r.naam}" bewerken`}
          onClick={onBewerk}
        >
          <PotloodIcoon />
        </button>
      )}
      <div className="rubriek-kop">
        <h3 className="rubriek-naam">{r.naam}</h3>
        {bewerkt && <span className="rubriek-bewerkt">bewerkt</span>}
      </div>

      {treffers.length > 0 && (
        <div className="rubriek-doelen">
          {treffers.map((t, i) => {
            const sleutel = `${r.id}|${i}`;
            const isOpen = doelOpen.has(sleutel);
            const isTreffer = Boolean(doelFilter.trim()) && codeMatchtPrefix(t.code, doelFilter);
            return (
              <button
                key={sleutel}
                type="button"
                className={`rubriek-doel soort-tag rating-${SOORT_KLEUR[t.soort]}${
                  isOpen ? " is-open" : ""
                }${isTreffer ? " is-treffer" : ""}`}
                title={`${SOORT_LABEL[t.soort]} — klik om na te lezen`}
                aria-expanded={isOpen}
                onClick={() => onDoel(sleutel)}
              >
                {t.code}
              </button>
            );
          })}
        </div>
      )}

      {ietsOpen && (
        <dl className="rubriek-doel-detail">
          {treffers.map((t, i) =>
            doelOpen.has(`${r.id}|${i}`) ? (
              <div key={`d${i}`} className="rubriek-doel-detail-rij">
                <dt>
                  <span
                    className={`soort-tag rating-${SOORT_KLEUR[t.soort]}`}
                    title={SOORT_LABEL[t.soort]}
                  >
                    {t.code}
                  </span>
                </dt>
                <dd>
                  {t.doel ? (
                    <>
                      {t.doel.omschrijving}
                      <span className="rubriek-doel-detail-meta">
                        {SOORT_LABEL[t.soort]} ·{" "}
                        {t.doel.competentie.replace(/^\s*\d+\.\s*/, "").toLowerCase()}
                      </span>
                    </>
                  ) : (
                    <span className="rubriek-doel-detail-leeg">
                      Deze code staat nog niet in de doelenlijst ({SOORT_LABEL[t.soort]}).
                    </span>
                  )}
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      )}

      <dl className="rubriek-criteria">
        {KLEUREN.map((kleur) => (
          <div key={kleur} className={`rubriek-criterium rating-${kleur}`}>
            <dt className="rubriek-criterium-kleur">{RATING_LABEL[kleur]}</dt>
            <dd className="rubriek-criterium-tekst">{r.criteria[KLEUR_KEY[kleur]] || "—"}</dd>
          </div>
        ))}
      </dl>

      {r.leerlijn && (
        <>
          <button type="button" className="linkknop" onClick={onLeerlijn}>
            {leerlijnOpen ? "Verberg leerlijn" : "Toon leerlijn"}
          </button>
          {leerlijnOpen && (
            <div className="doel-uitleg-lezen">
              {r.leerlijn.split(/\n{2,}/).map((alinea, i) => (
                <p key={i}>{alinea.trim()}</p>
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}

/** Voegt een sleutel toe aan of verwijdert ze uit een set (nieuwe set terug). */
function vervang(set: Set<string>, sleutel: string): Set<string> {
  const next = new Set(set);
  if (next.has(sleutel)) next.delete(sleutel);
  else next.add(sleutel);
  return next;
}

/**
 * Dropdown om op doelsoort te filteren. "Elke soort" = niets aangeduid; verder mogen er
 * meerdere tegelijk aangevinkt staan (het menu blijft dan open).
 */
function SoortDropdown({
  waarde,
  onToggle,
  onWisAlle,
}: {
  waarde: Set<DoelSoort>;
  onToggle: (s: DoelSoort) => void;
  onWisAlle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pos = usePopover(open, trigger, () => setOpen(false), { breedte: 224, hoogte: 216 });

  const gekozen = [...waarde];
  const samenvatting =
    gekozen.length === 0
      ? "Soort: alle"
      : gekozen.length === 1
        ? `Soort: ${SOORT_LABEL[gekozen[0]]}`
        : `Soort: ${gekozen.length} gekozen`;

  return (
    <span className="rubriek-soort-dd">
      <button
        ref={trigger}
        type="button"
        className="filterbar-select-knop"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {samenvatting} ▾
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <button
              type="button"
              className="rating-cell-backdrop"
              aria-label="Sluiten"
              onClick={() => setOpen(false)}
            />
            <div
              className="zwevend-menu rubriek-soort-menu"
              role="listbox"
              style={{ top: pos.top, left: pos.left }}
            >
              <button
                type="button"
                className={`rubriek-soort-optie${waarde.size === 0 ? " is-actief" : ""}`}
                onClick={onWisAlle}
              >
                Elke soort
              </button>
              {DOEL_SOORTEN.map((s) => (
                <label key={s} className="rubriek-soort-optie">
                  <input type="checkbox" checked={waarde.has(s)} onChange={() => onToggle(s)} />
                  <span className={`soort-tag rating-${SOORT_KLEUR[s]}`}>{SOORT_LABEL[s]}</span>
                </label>
              ))}
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}
