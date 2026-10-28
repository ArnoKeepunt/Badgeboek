// @vitest-environment jsdom
/**
 * Opslag in firebase-modus (`src/lib/data/firebasePersistentie.ts`): mislukte schrijfacties
 * worden vanzelf opnieuw geprobeerd, sluiten met onbewaard werk vraagt bevestiging, en
 * `bewaarAlles` (gebruikt bij het afmelden) stuurt alles meteen door. Firestore zelf is
 * nagebootst: geen emulator nodig.
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
    schrijfDocMap: vi.fn<(...args: unknown[]) => Promise<void>>(),
    schrijfOverlays: vi.fn<(...args: unknown[]) => Promise<void>>(),
  };
});

// Firestore-luisteraars: elke collectie levert meteen een (lege) eerste snapshot.
vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  collectionGroup: () => ({}),
  query: (ref: object) => ref,
  where: () => null,
  onSnapshot: (_ref: object, volgende: (snap: { forEach: () => void }) => void) => {
    volgende({ forEach: () => undefined });
    return () => undefined;
  },
}));

vi.mock("../../src/lib/data/firebaseApp", () => ({
  auth: fb.auth,
  db: {},
  schrijfCurriculum: vi.fn(),
  schrijfDocMap: fb.schrijfDocMap,
  schrijfOverlays: fb.schrijfOverlays,
}));
// De echte omzetting store → documenten vraagt een volledige store; hier volstaat een kaart.
vi.mock("../../src/lib/data/firestoreLayout", async (origineel) => ({
  ...(await origineel<typeof import("../../src/lib/data/firestoreLayout")>()),
  storeNaarDocs: (store: { docs: Record<string, object> }) => new Map(Object.entries(store.docs)),
}));

import { zetFirebaseBereik } from "../../src/lib/data/firebaseBereik";
import { firebasePersistentie } from "../../src/lib/data/firebasePersistentie";
import type { BadgeboekPersistentie, Overlays, PersistedStore } from "../../src/lib/data/persistentie";
import {
  bewaarAlles,
  heeftOnbewaardeWijzigingen,
  leesGesynct,
  leesOpslagStatus,
  zetOpslagStatus,
} from "../../src/lib/opslagStatus";
import { HUIDIG_SCHOOLJAAR } from "../../src/lib/schooljaar";

let opslag: BadgeboekPersistentie;
let stopAbonnement: () => void;

/** Een store met één gewijzigde leerling (genoeg om een schrijfactie uit te lokken). */
const store = (naam: string) =>
  ({ schooljaar: HUIDIG_SCHOOLJAAR, docs: { "leerlingen/l1": { naam } } }) as unknown as PersistedStore;

const geenVerbinding = () => Promise.reject(new Error("unavailable: offline"));
/** `act` voor beloftes: timers vooruit én de microtaken laten aflopen. */
const wacht = (ms: number) => vi.advanceTimersByTimeAsync(ms);

const sluitTabblad = () => {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented; // true = de browser vraagt "Pagina verlaten?"
};

beforeEach(async () => {
  vi.useFakeTimers();
  fb.auth.currentUser = { email: "mentor@keerpuntscholen.be", uid: "u1" };
  fb.schrijfDocMap.mockReset().mockResolvedValue(undefined);
  fb.schrijfOverlays.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  zetOpslagStatus({ soort: "ok" });
  zetFirebaseBereik({ alles: true, vestigingen: [], beheerder: false });
  opslag = firebasePersistentie();
  // Zoals in de app: eerst de eerste snapshot, pas dan wijzigingen.
  stopAbonnement = opslag.abonneer!(() => undefined);
  await wacht(60);
});

afterEach(async () => {
  // Elke test laat de opslag leeg achter, anders proberen latere tests nog oude schrijfacties.
  fb.schrijfDocMap.mockResolvedValue(undefined);
  fb.schrijfOverlays.mockResolvedValue(undefined);
  await bewaarAlles();
  stopAbonnement();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("opslag: niets stil verliezen", () => {
  it("een gewone wijziging is na de debounce bewaard", async () => {
    opslag.bewaar(store("Anna"));
    expect(heeftOnbewaardeWijzigingen()).toBe(true);

    await wacht(600);
    expect(fb.schrijfDocMap).toHaveBeenCalledTimes(1);
    expect(heeftOnbewaardeWijzigingen()).toBe(false);
  });

  it("een mislukte schrijfactie wordt vanzelf opnieuw geprobeerd, zonder nieuwe wijziging", async () => {
    fb.schrijfDocMap.mockImplementationOnce(geenVerbinding);
    opslag.bewaar(store("Anna"));
    await wacht(600);
    expect(heeftOnbewaardeWijzigingen()).toBe(true);

    await wacht(30_000);
    expect(fb.schrijfDocMap).toHaveBeenCalledTimes(2);
    expect(heeftOnbewaardeWijzigingen()).toBe(false);
  });

  it("probeert meteen opnieuw zodra de verbinding terug is", async () => {
    fb.schrijfDocMap.mockImplementationOnce(geenVerbinding);
    opslag.bewaar(store("Anna"));
    await wacht(600);

    window.dispatchEvent(new Event("online"));
    await wacht(0);
    expect(fb.schrijfDocMap).toHaveBeenCalledTimes(2);
    expect(heeftOnbewaardeWijzigingen()).toBe(false);
  });

  it("stuurt een hangende (offline) schrijfactie niet dubbel", async () => {
    let klaar!: () => void;
    fb.schrijfDocMap.mockImplementationOnce(() => new Promise<void>((r) => (klaar = r)));
    opslag.bewaar(store("Anna"));
    await wacht(600);

    await wacht(90_000); // drie herprobeer-rondes
    expect(fb.schrijfDocMap).toHaveBeenCalledTimes(1);
    expect(heeftOnbewaardeWijzigingen()).toBe(true);

    klaar();
    await wacht(0);
    expect(heeftOnbewaardeWijzigingen()).toBe(false);
  });

  it("sluiten met onbewaard werk vraagt bevestiging, met alles bewaard niet", async () => {
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    opslag.bewaar(store("Anna"));
    await wacht(600);
    expect(sluitTabblad()).toBe(true);

    fb.schrijfDocMap.mockResolvedValue(undefined);
    await wacht(30_000);
    expect(sluitTabblad()).toBe(false);
  });

  it("bewaarAlles (bij afmelden) wacht niet op de debounce", async () => {
    opslag.bewaar(store("Anna"));
    expect(await bewaarAlles()).toBe(true);
    expect(fb.schrijfDocMap).toHaveBeenCalledTimes(1);
  });

  it("bewaarAlles meldt het als bewaren niet lukt", async () => {
    fb.schrijfDocMap.mockImplementation(geenVerbinding);
    opslag.bewaar(store("Anna"));
    expect(await bewaarAlles()).toBe(false);
  });

  it("ook mislukte overlays (doelen/rubrieken) worden opnieuw geprobeerd", async () => {
    fb.schrijfOverlays.mockImplementationOnce(geenVerbinding);
    await opslag.schrijfOverlays!({} as Overlays);
    expect(heeftOnbewaardeWijzigingen()).toBe(true);

    await wacht(30_000);
    expect(fb.schrijfOverlays).toHaveBeenCalledTimes(2);
    expect(heeftOnbewaardeWijzigingen()).toBe(false);
  });
});

describe("melding als de database niet bevestigt", () => {
  /** Een schrijfactie die blijft hangen (offline) tot de test ze laat slagen. */
  const hangend = () => {
    let klaar!: () => void;
    fb.schrijfDocMap.mockImplementationOnce(() => new Promise<void>((r) => (klaar = r)));
    return () => klaar();
  };

  it("een weigering toont meteen de foutbalk", async () => {
    fb.schrijfDocMap.mockImplementationOnce(() => Promise.reject(new Error("permission-denied")));
    opslag.bewaar(store("Anna"));
    await wacht(600);
    expect(leesOpslagStatus()).toMatchObject({ soort: "fout", reden: "rechten" });
  });

  it("een schrijfactie die blijft hangen, toont na 10 seconden toch een melding", async () => {
    const verbindingTerug = hangend();
    opslag.bewaar(store("Anna"));
    await wacht(600 + 9_000);
    expect(leesOpslagStatus().soort).toBe("ok"); // even trager is nog geen probleem

    await wacht(1_000);
    expect(leesOpslagStatus()).toMatchObject({ soort: "fout", reden: "verbinding" });

    verbindingTerug();
    await wacht(0);
    expect(leesOpslagStatus().soort).toBe("ok");
    expect(heeftOnbewaardeWijzigingen()).toBe(false);
  });

  it("een snelle schrijfactie laat geen melding achter", async () => {
    opslag.bewaar(store("Anna"));
    await wacht(600 + 60_000);
    expect(leesOpslagStatus().soort).toBe("ok");
  });

  it("ook hangende overlays (doelen/rubrieken) geven een melding", async () => {
    fb.schrijfOverlays.mockImplementationOnce(() => new Promise(() => undefined));
    void opslag.schrijfOverlays!({ doelWijzigingen: {} } as unknown as Overlays);
    await wacht(10_000);
    expect(leesOpslagStatus()).toMatchObject({ soort: "fout", reden: "verbinding" });
  });
});

describe("nooit schrijven op de lokale cache", () => {
  it("een wijziging van vóór de eerste snapshot vertrekt nooit, ook niet erna", async () => {
    const vers = firebasePersistentie(); // nog niet geabonneerd: enkel de cache is bekend
    vers.bewaar(store("Uit een oude cache"));
    await wacht(600);
    expect(fb.schrijfDocMap).not.toHaveBeenCalled();

    const stop = vers.abonneer!(() => undefined);
    await wacht(60 + 30_000);
    expect(fb.schrijfDocMap).not.toHaveBeenCalled();
    expect(leesGesynct()).toBe(true);
    stop();
  });
});

describe("de foutbalk verdwijnt zodra alles bewaard is", () => {
  it("ook als de herpoging niets meer te doen heeft", async () => {
    fb.schrijfDocMap.mockImplementationOnce(() => Promise.reject(new Error("permission-denied")));
    opslag.bewaar(store("Anna"));
    await wacht(600);
    expect(leesOpslagStatus().soort).toBe("fout");

    // De wijziging wordt teruggedraaid: er valt niets meer te schrijven.
    opslag.bewaar({ schooljaar: HUIDIG_SCHOOLJAAR, docs: {} } as unknown as PersistedStore);
    await wacht(600);
    expect(heeftOnbewaardeWijzigingen()).toBe(false);
    expect(leesOpslagStatus().soort).toBe("ok");
  });

  it("niet zolang er nog iets anders openstaat", async () => {
    fb.schrijfOverlays.mockImplementationOnce(geenVerbinding);
    await opslag.schrijfOverlays!({} as Overlays);
    expect(leesOpslagStatus().soort).toBe("fout");

    opslag.bewaar(store("Anna")); // lukt wel, maar de overlays staan er nog niet
    await wacht(600);
    expect(leesOpslagStatus().soort).toBe("fout");

    await wacht(30_000); // de herpoging van de overlays lukt
    expect(leesOpslagStatus().soort).toBe("ok");
  });
});
