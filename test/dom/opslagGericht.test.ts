// @vitest-environment jsdom
/**
 * Bewaren stuurt enkel wat de gebruiker zelf wijzigde (`openstaand` in `firebasePersistentie.ts`).
 * Een verouderde browserstand mag nooit het werk van collega's wissen: dat gebeurde wel toen een
 * save de hele browserstand tegen de nieuwste serverstand vergeleek.
 *
 * Draaien: `npx vitest run test/dom`
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fb = vi.hoisted(() => {
  const auth = {
    currentUser: { email: "mentor@keerpuntscholen.be", uid: "u1" } as object | null,
    onAuthStateChanged: (cb: (u: object | null) => void) => {
      cb(auth.currentUser);
      return () => undefined;
    },
  };
  return {
    auth,
    schrijfDocMap: vi.fn<(schrijf: Map<string, object>, verwijder?: string[], vorige?: unknown) => Promise<void>>(),
    server: new Map<string, Record<string, unknown>>(),
    luisteraars: [] as Array<() => void>,
  };
});

vi.mock("firebase/firestore", () => ({
  collection: (_db: object, ...pad: string[]) => ({ pad: pad.join("/") }),
  collectionGroup: () => ({ pad: null }),
  query: (ref: object) => ref,
  where: () => null,
  onSnapshot: (
    ref: { pad: string | null },
    volgende: (snap: { forEach: (fn: (d: object) => void) => void }) => void,
  ) => {
    const vuur = () =>
      volgende({
        forEach: (fn) => {
          for (const [pad, data] of fb.server) {
            const i = pad.lastIndexOf("/");
            if (pad.slice(0, i) === ref.pad) fn({ id: pad.slice(i + 1), data: () => data });
          }
        },
      });
    vuur();
    fb.luisteraars.push(vuur);
    return () => undefined;
  },
}));

vi.mock("../../src/lib/data/firebaseApp", () => ({
  auth: fb.auth,
  db: {},
  leesDoc: async () => null,
  schrijfCurriculum: vi.fn(),
  schrijfDocMap: fb.schrijfDocMap,
  schrijfOverlays: vi.fn(),
}));

import { zetFirebaseBereik } from "../../src/lib/data/firebaseBereik";
import { firebasePersistentie } from "../../src/lib/data/firebasePersistentie";
import {
  WEG,
  pasPatchToe,
  storeNaarDocs,
  verschilTussenDocs,
} from "../../src/lib/data/firestoreLayout";
import type { BadgeboekPersistentie, PersistedStore, RauweStore } from "../../src/lib/data/persistentie";
import { HUIDIG_SCHOOLJAAR as SJ, eerdereSchooljaren } from "../../src/lib/schooljaar";

const S1 = `evaluaties/${SJ}/leerlingen/s1`;
const S2 = `evaluaties/${SJ}/leerlingen/s2`;

const store = (over: Partial<PersistedStore> = {}) =>
  ({
    students: [
      { id: "s1", vestiging: "Gent" },
      { id: "s2", vestiging: "Gent" },
    ],
    mentoren: [],
    groepen: [],
    vestigingen: null,
    rubriekenOverride: null,
    deelevaluaties: [],
    deelKleuren: {},
    deelNotities: {},
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
    schooljaar: SJ,
    curriculumOverride: null,
    ...over,
  }) as PersistedStore;

/** Zet de store als serverstand, zoals die in Firestore zou staan. */
const zetServer = (s: PersistedStore) => {
  fb.server.clear();
  for (const [pad, d] of storeNaarDocs(s, SJ)) fb.server.set(pad, d as Record<string, unknown>);
};
const wacht = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const snapshotVanElders = async () => {
  fb.luisteraars.forEach((vuur) => vuur());
  await wacht(60);
};
const laatsteSchrijfactie = () => {
  const [schrijf, verwijder, vorige] = fb.schrijfDocMap.mock.calls.at(-1)!;
  return { schrijf: Object.fromEntries(schrijf), verwijder, vorige };
};

let opslag: BadgeboekPersistentie;
let getoond: RauweStore | null;
const kleurS1 = { [`${SJ}:s1:b1`]: "green" } as PersistedStore["kleuren"];

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fb.luisteraars.length = 0;
  fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
  zetServer(store({ kleuren: kleurS1 }));
  zetFirebaseBereik({ alles: true, vestigingen: [], beheerder: true });
  getoond = null;
  opslag = firebasePersistentie();
  opslag.abonneer!((s) => (getoond = s));
  await wacht(60);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("een verouderde browserstand wist niets van collega's", () => {
  /** De gebruiker kleurt b9 bij s1; de store weet nog niets van wat de collega doet. */
  const mijnKlik = () => {
    const voor = store({ kleuren: kleurS1 });
    opslag.bewaar(store({ kleuren: { ...kleurS1, [`${SJ}:s1:b9`]: "red" } }), voor);
  };
  /** Een collega zet een kleur bij s1 en bij s2 (die laatste had nog geen evaluatie-doc). */
  const collegaBewaart = () =>
    zetServer(
      store({ kleuren: { ...kleurS1, [`${SJ}:s1:b2`]: "blue", [`${SJ}:s2:b1`]: "yellow" } }),
    );

  it("een collega bewaart tijdens de debounce: enkel de eigen klik vertrekt", async () => {
    mijnKlik();
    collegaBewaart();
    await snapshotVanElders();
    await wacht(600);

    const { schrijf, verwijder, vorige } = laatsteSchrijfactie();
    expect(verwijder).toEqual([]);
    expect(vorige).toBeUndefined();
    expect(schrijf).toEqual({ [S1]: { kleuren: { b9: "red" } } });
  });

  it("een herpoging veel later stuurt nog altijd enkel de eigen klik", async () => {
    fb.schrijfDocMap.mockRejectedValueOnce(new Error("permission-denied"));
    mijnKlik();
    await wacht(600);

    collegaBewaart();
    await snapshotVanElders();
    await wacht(30_000);

    expect(fb.schrijfDocMap).toHaveBeenCalledTimes(2);
    const { schrijf, verwijder } = laatsteSchrijfactie();
    expect(verwijder).toEqual([]);
    expect(schrijf).toEqual({ [S1]: { kleuren: { b9: "red" } } });
  });

  it("tijdens een openstaande wijziging blijft het werk van de collega zichtbaar", async () => {
    fb.schrijfDocMap.mockRejectedValue(new Error("permission-denied"));
    mijnKlik();
    await wacht(600);

    collegaBewaart();
    await snapshotVanElders();

    expect(getoond?.kleuren).toEqual({
      ...kleurS1,
      [`${SJ}:s1:b9`]: "red",
      [`${SJ}:s1:b2`]: "blue",
      [`${SJ}:s2:b1`]: "yellow",
    });
    fb.schrijfDocMap.mockResolvedValue(undefined);
  });

  it("een kleur die de store als wees weggooit, verdwijnt niet van de server", async () => {
    // Op de server staat een kleur op een badge die niet meer bestaat; de store kent ze niet.
    zetServer(store({ kleuren: { ...kleurS1, [`${SJ}:s1:weg`]: "blue", [`${SJ}:s2:weg`]: "red" } }));
    await snapshotVanElders();

    const voor = store({ kleuren: kleurS1 });
    opslag.bewaar(store({ kleuren: { ...kleurS1, [`${SJ}:s1:b9`]: "red" } }), voor);
    await wacht(600);

    const { schrijf, verwijder } = laatsteSchrijfactie();
    expect(verwijder).toEqual([]);
    expect(schrijf).toEqual({ [S1]: { kleuren: { b9: "red" } } });
  });
});

describe("een ander schooljaar bekijken", () => {
  // Incident 6/11/2026: alle evaluatie-docs van het huidige schooljaar in één keer gewist.
  it("heen en terug wisselen wist niets van het huidige schooljaar", async () => {
    const eerder = eerdereSchooljaren(SJ)[0];
    const alles = store({
      kleuren: { ...kleurS1, [`${SJ}:s2:b1`]: "red", [`${eerder}:s1:b1`]: "blue" },
    });
    for (const [pad, d] of storeNaarDocs(alles)) fb.server.set(pad, d as Record<string, unknown>);
    await snapshotVanElders();

    // Zoals de store: elke snapshot wordt de nieuwe stand, met het bekeken jaar erbij.
    let staat = { ...alles, ...getoond, schooljaar: SJ } as PersistedStore;
    const wissel = async (schooljaar: string) => {
      const vorige = staat;
      staat = { ...staat, schooljaar };
      opslag.bewaar(staat, vorige);
      await wacht(60);
      staat = { ...staat, ...getoond, schooljaar };
    };

    await wissel(eerder);
    await wacht(700);
    await wissel(SJ);
    await wacht(61_000); // de debounce en twee herprobeer-rondes

    for (const [schrijf, verwijder] of fb.schrijfDocMap.mock.calls) {
      expect(verwijder ?? []).toEqual([]);
      expect([...schrijf.keys()].filter((p) => p.startsWith(`evaluaties/${SJ}/`))).toEqual([]);
    }
  });
});

describe("wat de gebruiker zelf wist, wordt wel gewist", () => {
  it("een eigen kleur wissen stuurt een wis-markering, enkel voor die sleutel", async () => {
    const voor = store({ kleuren: kleurS1 });
    opslag.bewaar(store({ gewist: [`${SJ}:s1:b1`] }), voor);
    await wacht(600);

    expect(laatsteSchrijfactie().schrijf).toEqual({
      [S1]: { kleuren: { b1: WEG }, gewist: ["b1"] },
    });
  });

  it("een hele deelbadge verwijderen verwijdert het document", async () => {
    const de = { id: "d1", schooljaar: SJ, leerdoelIds: [] } as never;
    zetServer(store({ deelevaluaties: [de] }));
    await snapshotVanElders();

    opslag.bewaar(store(), store({ deelevaluaties: [de] }));
    await wacht(600);
    expect(laatsteSchrijfactie().verwijder).toEqual(["deelbadges/d1"]);
  });

  it("een evaluatie-doc dat leeg raakt, blijft bestaan met enkel de eigen sleutels gewist", async () => {
    opslag.bewaar(store(), store({ kleuren: kleurS1 }));
    await wacht(600);

    const { schrijf, verwijder } = laatsteSchrijfactie();
    expect(verwijder).toEqual([]);
    expect(schrijf).toEqual({ [S1]: { kleuren: { b1: WEG } } });
  });

  it("het eerste doc van een leerling is compleet, zonder lege maps die iets kunnen wissen", async () => {
    opslag.bewaar(store({ kleuren: { ...kleurS1, [`${SJ}:s2:b1`]: "red" } }), store({ kleuren: kleurS1 }));
    await wacht(600);

    expect(laatsteSchrijfactie().schrijf).toEqual({
      [S2]: { kleuren: { b1: "red" }, gewist: [], vestiging: "Gent" },
    });
  });
});

describe("verschilTussenDocs", () => {
  it("stuurt een gewiste notitie als geheel weg, niet veld per veld", () => {
    const oud = { notities: { b1: { zichtbaar: "a", verborgen: "b" } } };
    expect(verschilTussenDocs(oud, { notities: {} })).toEqual({ notities: { b1: WEG } });
  });

  it("wist bij een weggelaten teLaat enkel de bekende sleutels", () => {
    expect(verschilTussenDocs({ teLaat: { b1: true } }, {})).toEqual({ teLaat: { b1: WEG } });
  });

  it("stuurt nooit een lege map (een merge zou de map op de server vervangen)", () => {
    expect(verschilTussenDocs({}, { kleuren: {}, notities: {} })).toEqual({});
    expect(verschilTussenDocs({ kleuren: {} }, { kleuren: {} })).toEqual({});
  });

  it("basis + verschil geeft het nieuwe document", () => {
    const oud = { a: 1, m: { x: 1, y: { z: 2 } }, weg: true };
    const nieuw = { a: 2, m: { y: { z: 3 }, n: 4 } };
    expect(pasPatchToe(oud, verschilTussenDocs(oud, nieuw))).toEqual(nieuw);
  });
});
