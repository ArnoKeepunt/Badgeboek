// @vitest-environment jsdom
/**
 * Back-up van onbewaarde wijzigingen (`src/lib/data/onbewaardBackup.ts` +
 * `herstelBackups` in `firebasePersistentie.ts`): wat niet bewaard raakte, overleeft herladen en
 * wordt bij de volgende login van hetzelfde account alsnog verstuurd — zonder werk van anderen
 * te overschrijven. "Herladen" = de modules opnieuw inladen terwijl localStorage blijft staan.
 *
 * Draaien: `npx vitest run test/dom`
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fb = vi.hoisted(() => {
  const auth = {
    currentUser: null as { email: string; uid: string } | null,
    onAuthStateChanged: (cb: (u: object | null) => void) => {
      cb(auth.currentUser);
      return () => undefined;
    },
  };
  return {
    auth,
    schrijfDocMap: vi.fn<(schrijf: Map<string, object>, verwijder?: string[]) => Promise<void>>(),
    schrijfOverlays: vi.fn<(o: object) => Promise<void>>(),
    /** De serverstand per pad, zoals `leesDoc` en de eerste snapshot die teruggeven. */
    server: new Map<string, Record<string, unknown>>(),
  };
});

// Firestore-luisteraars: elke collectie levert meteen een eerste snapshot uit `fb.server`.
vi.mock("firebase/firestore", () => ({
  collection: (_db: object, ...pad: string[]) => ({ pad: pad.join("/") }),
  collectionGroup: () => ({ pad: null }),
  query: (ref: object) => ref,
  where: () => null,
  onSnapshot: (
    ref: { pad: string | null },
    volgende: (snap: { forEach: (fn: (d: object) => void) => void }) => void,
  ) => {
    volgende({
      forEach: (fn) => {
        for (const [pad, data] of fb.server) {
          const i = pad.lastIndexOf("/");
          if (pad.slice(0, i) === ref.pad) fn({ id: pad.slice(i + 1), data: () => data });
        }
      },
    });
    return () => undefined;
  },
}));

vi.mock("../../src/lib/data/firebaseApp", () => ({
  auth: fb.auth,
  db: {},
  leesDoc: async (...pad: string[]) => fb.server.get(pad.join("/")) ?? null,
  schrijfCurriculum: vi.fn(),
  schrijfDocMap: fb.schrijfDocMap,
  schrijfOverlays: fb.schrijfOverlays,
}));
vi.mock("../../src/lib/data/firestoreLayout", async (origineel) => ({
  ...(await origineel<typeof import("../../src/lib/data/firestoreLayout")>()),
  storeNaarDocs: (store: { docs: Record<string, object> }) => new Map(Object.entries(store.docs)),
}));

import type { PersistedStore } from "../../src/lib/data/persistentie";
import { HUIDIG_SCHOOLJAAR } from "../../src/lib/schooljaar";

const MENTOR = { email: "mentor@keerpuntscholen.be", uid: "u1" };
const ANDER = { email: "ander@keerpuntscholen.be", uid: "u2" };
const PAD = "leerlingen/l1";

/** Echte, gedeelde localStorage over "paginaladingen" heen. */
let opslagData: Map<string, string>;
function geheugenOpslag(): Storage {
  return {
    get length() {
      return opslagData.size;
    },
    clear: () => opslagData.clear(),
    getItem: (k) => opslagData.get(k) ?? null,
    key: (i) => [...opslagData.keys()][i] ?? null,
    removeItem: (k) => void opslagData.delete(k),
    setItem: (k, v) => void opslagData.set(k, String(v)),
  };
}
const backups = () => [...opslagData.keys()].filter((k) => k.includes(":onbewaard:"));

/**
 * Een nieuwe paginalading: verse modules (nieuwe tabblad-id, leeg geheugen). De timers van de
 * vorige pagina stoppen, zoals bij echt herladen — localStorage blijft. Zoals in de app komt
 * eerst de eerste snapshot binnen (en start het herstel), pas dan kan er iets gewijzigd worden.
 */
async function laadPagina({ beheerder = false } = {}) {
  vi.clearAllTimers();
  vi.resetModules();
  const { firebasePersistentie } = await import("../../src/lib/data/firebasePersistentie");
  const { zetFirebaseBereik } = await import("../../src/lib/data/firebaseBereik");
  const status = await import("../../src/lib/opslagStatus");
  zetFirebaseBereik({ alles: true, vestigingen: [], beheerder });
  const opslag = firebasePersistentie();
  opslag.abonneer!(() => undefined);
  await wacht(60);
  return { opslag, status };
}

const store = (naam: string) =>
  ({ schooljaar: HUIDIG_SCHOOLJAAR, docs: { [PAD]: { naam } } }) as unknown as PersistedStore;
const geenVerbinding = () => Promise.reject(new Error("unavailable: offline"));
const wacht = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const geschreven = (oproep: number) => Object.fromEntries(fb.schrijfDocMap.mock.calls[oproep][0]);

beforeEach(() => {
  // Enkel de timers nabootsen, niet de klok: na `vi.resetModules()` zien de opnieuw ingeladen
  // modules anders een andere klok dan de test, en dan kloppen de tijdvergelijkingen niet.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  opslagData = new Map();
  vi.stubGlobal("localStorage", geheugenOpslag());
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  fb.auth.currentUser = MENTOR;
  fb.server.clear();
  fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
  fb.schrijfOverlays.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("back-up van onbewaarde wijzigingen", () => {
  it("een geslaagde schrijfactie laat geen back-up achter", async () => {
    const { opslag } = await laadPagina();
    opslag.bewaar(store("Anna"));
    await wacht(600);
    expect(backups()).toHaveLength(0);
  });

  it("een mislukte schrijfactie wel — en die wordt na herladen alsnog verstuurd", async () => {
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    const eerste = await laadPagina();
    eerste.opslag.bewaar(store("Anna"));
    await wacht(600);
    expect(backups()).toHaveLength(1);

    // Herladen (verbinding terug): de nieuwe pagina herstelt de back-up.
    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    await laadPagina();
    await wacht(30_000);

    expect(fb.schrijfDocMap).toHaveBeenCalledTimes(1);
    expect(geschreven(0)).toEqual({ [PAD]: { naam: "Anna" } });
    expect(backups()).toHaveLength(0);
  });

  it("ook een offline hangende schrijfactie overleeft herladen", async () => {
    fb.schrijfDocMap.mockImplementation(() => new Promise(() => undefined)); // blijft hangen
    const eerste = await laadPagina();
    eerste.opslag.bewaar(store("Anna"));
    await wacht(600);
    expect(backups()).toHaveLength(1);

    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    await laadPagina();
    await wacht(30_000);
    expect(geschreven(0)).toEqual({ [PAD]: { naam: "Anna" } });
  });

  it("toont een melding na het herstellen", async () => {
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    (await laadPagina()).opslag.bewaar(store("Anna"));
    await wacht(600);

    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    const { status } = await laadPagina();
    await wacht(30_000);
    expect(status.leesHerstelMelding()).toEqual({ hersteld: 1, overgeslagen: 0 });
  });

  it("wordt nooit onder een ander account verstuurd", async () => {
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    (await laadPagina()).opslag.bewaar(store("Anna"));
    await wacht(600);

    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    fb.auth.currentUser = ANDER; // iemand anders meldt aan in dezelfde browser
    await laadPagina();
    await wacht(30_000);

    expect(fb.schrijfDocMap).not.toHaveBeenCalled();
    expect(backups()).toHaveLength(1); // blijft staan voor de mentor zelf

    fb.auth.currentUser = MENTOR;
    await laadPagina();
    await wacht(30_000);
    expect(geschreven(0)).toEqual({ [PAD]: { naam: "Anna" } });
  });

  it("overschrijft geen werk dat iemand anders intussen bewaarde", async () => {
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    (await laadPagina()).opslag.bewaar(store("Anna"));
    await wacht(600);

    // Een collega past dezelfde leerling later aan.
    fb.server.set(PAD, { naam: "Annabel", updatedAt: new Date(Date.now() + 60_000).toISOString() });
    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    const { status } = await laadPagina();
    await wacht(30_000);

    expect(fb.schrijfDocMap).not.toHaveBeenCalled();
    expect(backups()).toHaveLength(0); // afgehandeld (bewust overgeslagen)
    expect(status.leesHerstelMelding()).toEqual({ hersteld: 0, overgeslagen: 1 });
  });

  it("schrijft wel als de server nog staat zoals vóór de mislukte poging", async () => {
    fb.server.set(PAD, { naam: "Oud", updatedAt: new Date(Date.now() - 60_000).toISOString() });
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    (await laadPagina()).opslag.bewaar(store("Anna"));
    await wacht(600);

    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    await laadPagina();
    await wacht(30_000);
    expect(geschreven(0)).toEqual({ [PAD]: { naam: "Anna" } });
  });

  it("lukt herstellen nog niet (bv. sessie verlopen), dan blijft de back-up staan", async () => {
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    (await laadPagina()).opslag.bewaar(store("Anna"));
    await wacht(600);

    fb.schrijfDocMap.mockReset().mockRejectedValue(new Error("permission-denied"));
    await laadPagina();
    await wacht(30_000);
    expect(backups()).toHaveLength(1);

    // Opnieuw aangemeld: nu lukt het wel.
    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    await wacht(30_000);
    expect(geschreven(0)).toEqual({ [PAD]: { naam: "Anna" } });
    expect(backups()).toHaveLength(0);
  });

  it("back-ups ouder dan een week worden opgeruimd, niet meer verstuurd", async () => {
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    (await laadPagina()).opslag.bewaar(store("Anna"));
    await wacht(600);

    // De back-up is ondertussen acht dagen oud.
    for (const k of backups()) {
      const b = JSON.parse(opslagData.get(k)!);
      opslagData.set(k, JSON.stringify({ ...b, tijd: b.tijd - 8 * 24 * 3600_000 }));
    }
    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    await laadPagina();
    await wacht(30_000);

    expect(fb.schrijfDocMap).not.toHaveBeenCalled();
    expect(backups()).toHaveLength(0);
  });

  it("een levend tweede tabblad laat de back-up van het eerste met rust zolang dat het zelf afhandelt", async () => {
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    const eerste = await laadPagina();
    eerste.opslag.bewaar(store("Anna"));
    await wacht(600);

    // Het eerste tabblad herprobeert zelf (verbinding terug) en wist zijn eigen back-up.
    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    await wacht(30_000);
    expect(backups()).toHaveLength(0);
  });

  it("ook mislukte overlays (doelen/rubrieken) overleven herladen", async () => {
    fb.schrijfOverlays.mockImplementation(geenVerbinding);
    await (await laadPagina()).opslag.schrijfOverlays!({ doelWijzigingen: { d1: {} } } as never);
    expect(backups()).toHaveLength(1);

    fb.schrijfOverlays.mockReset().mockResolvedValue(undefined);
    await laadPagina();
    await wacht(30_000);
    expect(fb.schrijfOverlays).toHaveBeenCalledWith({ doelWijzigingen: { d1: {} } });
    expect(backups()).toHaveLength(0);
  });

  it("overschrijft ook geen werk van vóór de mislukte poging dat dit tabblad nog niet zag", async () => {
    fb.server.set(PAD, { naam: "Oud" });
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    (await laadPagina()).opslag.bewaar(store("Anna"));
    await wacht(600);

    // Een collega bewaarde net vóór onze poging; die snapshot was hier nog niet binnen.
    fb.server.set(PAD, {
      naam: "Collega",
      updatedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    const { status } = await laadPagina();
    await wacht(30_000);

    expect(fb.schrijfDocMap).not.toHaveBeenCalled();
    expect(status.leesHerstelMelding()).toEqual({ hersteld: 0, overgeslagen: 1 });
  });

  it("back-ups van een oudere versie (zonder serverstand) worden niet meer verstuurd", async () => {
    // Zo zag een back-up eruit vóór 28/10 — mogelijk de volledige, oude cache.
    opslagData.set(
      "keerpunt-badgeboek:onbewaard:docs:oud-tabblad",
      JSON.stringify({
        email: MENTOR.email,
        tijd: Date.now() - 60_000,
        nr: 1,
        schrijf: [[PAD, { naam: "Uit de cache" }], ["groepen/g1", { naam: "Oud" }]],
        verwijder: [],
      }),
    );
    const { status } = await laadPagina();
    await wacht(30_000);

    expect(fb.schrijfDocMap).not.toHaveBeenCalled();
    expect(backups()).toHaveLength(0);
    expect(status.leesHerstelMelding()).toEqual({ hersteld: 0, overgeslagen: 2 });
  });

  it("een mentor herstelt geen afgewerkt rapport, maar de rest wel", async () => {
    fb.server.set("rapporten/r1", { status: "afgewerkt", leerlingId: "l1" });
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    const eerste = await laadPagina();
    eerste.opslag.bewaar(store("Anna"));
    await wacht(600);

    // De back-up bevat (door een vroegere fout) ook het afgewerkte rapport, ongewijzigd t.o.v.
    // de server: zonder filter zou de hele batch geweigerd worden.
    const k = backups()[0];
    const b = JSON.parse(opslagData.get(k)!);
    const rapport = { status: "afgewerkt", leerlingId: "l1", opmerking: "x" };
    b.schrijf.push(["rapporten/r1", rapport]);
    b.voor["rapporten/r1"] = (await import("../../src/lib/data/firestoreLayout")).normaliseerRapportDoc(
      { status: "afgewerkt", leerlingId: "l1" },
    );
    opslagData.set(k, JSON.stringify(b));

    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    await laadPagina();
    await wacht(30_000);
    expect(geschreven(0)).toEqual({ [PAD]: { naam: "Anna" } });
  });

  it("lukt het herstel niet, dan toont de foutbalk dat", async () => {
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    (await laadPagina()).opslag.bewaar(store("Anna"));
    await wacht(600);

    fb.schrijfDocMap.mockReset().mockRejectedValue(new Error("permission-denied"));
    const { status } = await laadPagina();
    await wacht(0);
    expect(status.leesOpslagStatus()).toMatchObject({ soort: "fout", reden: "rechten" });

    fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
    await wacht(30_000);
    expect(status.leesOpslagStatus().soort).toBe("ok");
  });
});
