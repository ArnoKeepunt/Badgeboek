/**
 * `metWissingen` (`src/lib/data/firestoreLayout.ts`): bewaren gebeurt met `merge: true`, dus wat
 * je lokaal uit een map haalt (een gewiste notitie, een weggehaald "te laat"-vinkje) moet als
 * `deleteField()` mee — anders blijft het op de server staan en springt het terug.
 *
 * Draaien: `npx vitest run test/dom`
 */
import { describe, expect, it } from "vitest";
import { metWissingen, storeNaarDocs } from "../../src/lib/data/firestoreLayout";

const WIS = "__WIS__";
const wis = () => WIS;

describe("metWissingen", () => {
  it("wist een verwijderde deelbadge-notitie in de geneste map", () => {
    const oud = {
      id: "d1",
      scores: { s1: "green" },
      scoreNotities: { s1: { zichtbaar: "fout", verborgen: "" }, s2: { zichtbaar: "ok", verborgen: "" } },
    };
    const nieuw = {
      id: "d1",
      scores: { s1: "green" },
      scoreNotities: { s2: { zichtbaar: "ok", verborgen: "" } },
    };
    expect(metWissingen(oud, nieuw, wis)).toEqual({
      id: "d1",
      scores: { s1: "green" },
      scoreNotities: { s1: WIS, s2: { zichtbaar: "ok", verborgen: "" } },
    });
  });

  it("wist een weggelaten teLaat-veld, maar laat onbekende velden ongemoeid", () => {
    const oud = { kleuren: {}, teLaat: { b1: true }, veldVanNieuwereVersie: 1 };
    const nieuw = { kleuren: {} };
    expect(metWissingen(oud, nieuw, wis)).toEqual({ kleuren: {}, teLaat: WIS });
  });

  it("wist een top-level veld dat expliciet undefined is (bv. afgewerktOp bij heropenen)", () => {
    const oud = { status: "afgewerkt", afgewerktOp: 5 };
    const nieuw = { status: "concept", afgewerktOp: undefined };
    expect(metWissingen(oud, nieuw, wis)).toEqual({ status: "concept", afgewerktOp: WIS });
  });

  it("zonder serverstand: ongewijzigd", () => {
    const nieuw = { a: { b: 1 } };
    expect(metWissingen(undefined, nieuw, wis)).toBe(nieuw);
  });

  it("notitie wissen via de store-vorm geeft een wis-markering op het deelbadge-doc", () => {
    const basis = {
      students: [{ id: "s1", vestiging: "A" }],
      mentoren: [],
      groepen: [],
      vestigingen: null,
      rubriekenOverride: null,
      deelevaluaties: [{ id: "d1", schooljaar: "2026-2027", leerdoelIds: [] }],
      deelKleuren: {},
      kleuren: {},
      notities: {},
      gewist: [],
      auditLog: {},
      meldingen: [],
      meldingGezien: {},
      rapporten: [],
      afgeslotenSchooljaren: null,
      doelWijzigingen: {},
      doelenImport: null,
      rubriekWijzigingen: {},
      teLaat: {},
      schooljaar: "2026-2027",
      curriculumOverride: null,
    } as unknown as Parameters<typeof storeNaarDocs>[0];
    const voor = storeNaarDocs({
      ...basis,
      deelNotities: { "d1:s1": { zichtbaar: "verkeerd", verborgen: "" } },
    }).get("deelbadges/d1");
    const na = storeNaarDocs({ ...basis, deelNotities: {} }).get("deelbadges/d1")!;
    expect(metWissingen(voor, na, wis).scoreNotities).toEqual({ s1: WIS });
  });
});
