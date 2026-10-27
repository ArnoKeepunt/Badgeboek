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

const fb = vi.hoisted(() => ({
  auth: { currentUser: null as { email: string; uid: string } | null },
  schrijfDocMap: vi.fn<(schrijf: Map<string, object>, verwijder?: string[]) => Promise<void>>(),
  schrijfOverlays: vi.fn<(o: object) => Promise<void>>(),
  /** De serverstand per pad, zoals `leesDoc` die teruggeeft. */
  server: new Map<string, Record<string, unknown>>(),
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
 * vorige pagina stoppen, zoals bij echt herladen — localStorage blijft.
 */
async function laadPagina() {
  vi.clearAllTimers();
  vi.resetModules();
  const { firebasePersistentie } = await import("../../src/lib/data/firebasePersistentie");
  const status = await import("../../src/lib/opslagStatus");
  return { opslag: firebasePersistentie(), status };
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
    expect(status.leesHerstelMelding()).toBeNull();
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

  it("schrijft wel als de server ouder is dan de mislukte poging", async () => {
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
});
