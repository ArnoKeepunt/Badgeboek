// @vitest-environment jsdom
/**
 * Automatisch afmelden na inactiviteit (`src/components/AutoAfmelden.tsx`). Draait met nep-timers
 * en een gemockte Firebase-afmelding: geen emulator, geen echte login nodig. De opslag wordt
 * nagebootst via `registreerOpslagBron` (zoals de echte Firestore-laag doet). Volgt de grenzen uit
 * `src/lib/inactiviteit.ts`, dus blijft kloppen als die (bv. na testen) terug op 30 min staan.
 *
 * Draaien: `npx vitest run test/dom`
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { meldAf, bevestig, sessieBegin } = vi.hoisted(() => ({
  meldAf: vi.fn(),
  bevestig: vi.fn<() => Promise<void>>(),
  sessieBegin: vi.fn<() => Promise<number>>(),
}));
vi.mock("../../src/lib/data", () => ({
  meldAfVanFirebase: meldAf,
  bevestigAanmelding: bevestig,
  sessieBeginVan: sessieBegin,
}));

import { AutoAfmelden } from "../../src/components/AutoAfmelden";
import {
  ACTIVITEIT_SLEUTEL,
  INACTIEF_MS,
  MAX_SESSIE_MS,
  SESSIE_WAARSCHUWING_MS,
  WAARSCHUWING_MS,
  leesAfmeldReden,
  zetAfmeldReden,
} from "../../src/lib/inactiviteit";
import { registreerOpslagBron } from "../../src/lib/opslagStatus";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** De controle loopt elke 15 s zolang er geen waarschuwing is — zoveel speling nemen we. */
const SPELING = 16_000;
const START = new Date("2026-10-27T09:00:00Z").getTime();

let container: HTMLDivElement;
let root: Root;

const gebruiker = (aangemeldOp = START) =>
  ({ metadata: { lastSignInTime: new Date(aangemeldOp).toUTCString() } }) as unknown as User;

const toon = (u = gebruiker()) => act(() => root.render(<AutoAfmelden gebruiker={u} />));
// Async `act`: zo lopen ook de beloftes (bewaren → afmelden) na elke stap af.
const wacht = (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });

/** Nagebootste opslag met onbewaard werk; `lukt` bepaalt of bewaren slaagt. */
function onbewaardWerk(lukt: boolean) {
  const opslag = { open: true, lukt, pogingen: 0 };
  registreerOpslagBron({
    onbewaard: () => opslag.open,
    bewaarAlles: async () => {
      opslag.pogingen++;
      if (opslag.lukt) opslag.open = false;
    },
  });
  return opslag;
}
const dialoog = () => document.querySelector('[role="dialog"]');
const knop = (tekst: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === tekst)!;

/** Nieuwere Node-versies hebben een eigen (onbruikbare) `localStorage` die die van jsdom verdringt. */
function geheugenOpslag(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  vi.stubGlobal("localStorage", geheugenOpslag());
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  meldAf.mockReset();
  bevestig.mockReset().mockResolvedValue(undefined);
  sessieBegin.mockReset().mockResolvedValue(START); // aangemeld bij de start van de test
  zetAfmeldReden(null);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  registreerOpslagBron(null);
});

describe("automatisch afmelden", () => {
  it("toont eerst de waarschuwing en meldt daarna af", async () => {
    await toon();
    await wacht(INACTIEF_MS - WAARSCHUWING_MS - SPELING);
    expect(dialoog()).toBeNull();

    await wacht(SPELING + 1000);
    expect(dialoog()?.textContent).toContain("Ben je er nog?");
    expect(meldAf).not.toHaveBeenCalled();

    await wacht(WAARSCHUWING_MS);
    expect(meldAf).toHaveBeenCalledTimes(1);
    expect(leesAfmeldReden()).toBe("inactief");
  });

  it("activiteit schuift de teller op", async () => {
    await toon();
    await wacht(INACTIEF_MS - WAARSCHUWING_MS - SPELING);
    await act(() => window.dispatchEvent(new Event("keydown")));

    await wacht(WAARSCHUWING_MS + SPELING);
    expect(dialoog()).toBeNull();
    expect(meldAf).not.toHaveBeenCalled();
  });

  it("'Aangemeld blijven' sluit de waarschuwing en start opnieuw", async () => {
    await toon();
    await wacht(INACTIEF_MS - WAARSCHUWING_MS + SPELING);
    expect(dialoog()).not.toBeNull();

    await act(() => knop("Aangemeld blijven").click());
    expect(dialoog()).toBeNull();

    await wacht(INACTIEF_MS - WAARSCHUWING_MS - SPELING);
    expect(dialoog()).toBeNull();
    expect(meldAf).not.toHaveBeenCalled();
  });

  it("de muis bewegen tijdens de waarschuwing telt niet als 'ik ben er'", async () => {
    await toon();
    await wacht(INACTIEF_MS - WAARSCHUWING_MS + SPELING);
    await act(() => window.dispatchEvent(new Event("pointermove")));

    await wacht(WAARSCHUWING_MS);
    expect(meldAf).toHaveBeenCalledTimes(1);
  });

  it("'Nu afmelden' meldt af zonder de inactiviteitsmelding", async () => {
    await toon();
    await wacht(INACTIEF_MS - WAARSCHUWING_MS + SPELING);
    await act(() => knop("Nu afmelden").click());

    expect(meldAf).toHaveBeenCalledTimes(1);
    expect(leesAfmeldReden()).toBeNull();
  });

  it("na slaapstand: meteen afmelden zodra het tabblad weer zichtbaar wordt", async () => {
    await toon();
    // Laptop dicht: de klok loopt door, maar er vuren geen timers.
    vi.setSystemTime(START + INACTIEF_MS + 60_000);
    await act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(meldAf).toHaveBeenCalledTimes(1);
  });

  it("herladen na lange inactiviteit is geen achterpoortje", async () => {
    // Aangemeld om 09:00, laatste activiteit 09:05, tabblad herladen een uur later.
    localStorage.setItem(ACTIVITEIT_SLEUTEL, String(START + 5 * 60_000));
    vi.setSystemTime(START + 5 * 60_000 + INACTIEF_MS + 60 * 60_000);
    await toon(gebruiker(START));

    expect(meldAf).toHaveBeenCalledTimes(1);
  });

  it("een verse login start een nieuwe teller, ook met oude activiteit in de opslag", async () => {
    localStorage.setItem(ACTIVITEIT_SLEUTEL, String(START - 24 * 60 * 60_000)); // gisteren
    await toon(gebruiker(START));

    expect(meldAf).not.toHaveBeenCalled();
    expect(Number(localStorage.getItem(ACTIVITEIT_SLEUTEL))).toBe(START);
  });

  it("werken in een andere app of website houdt het Badgeboek niet aangemeld", async () => {
    // Badgeboek zichtbaar op een tweede scherm, maar zonder focus: de browser geeft
    // muisbewegingen nog door, die mogen niet tellen.
    vi.mocked(document.hasFocus).mockReturnValue(false);
    await toon();
    for (let t = 0; t < INACTIEF_MS; t += 30_000) {
      await act(() => window.dispatchEvent(new Event("pointermove")));
      await wacht(30_000);
    }
    expect(meldAf).toHaveBeenCalledTimes(1);
  });

  it("andere websites kunnen de gedeelde activiteit niet aanraken", async () => {
    await toon();
    // Een `storage`-event bestaat enkel binnen dezelfde website; een andere sleutel (van een
    // ander deel van de app) telt sowieso niet als activiteit.
    await act(() => window.dispatchEvent(new StorageEvent("storage", { key: "iets-anders" })));
    await wacht(INACTIEF_MS + SPELING);
    expect(meldAf).toHaveBeenCalledTimes(1);
  });

  it("activiteit in een ander Badgeboek-tabblad houdt dit tabblad aangemeld", async () => {
    await toon();
    await wacht(INACTIEF_MS - WAARSCHUWING_MS + SPELING);
    expect(dialoog()).not.toBeNull();

    // Een tweede Badgeboek-tab (zelfde website!) schrijft verse activiteit weg → `storage`-event
    // in dit tabblad. Andere websites kunnen dit niet: localStorage is per website afgeschermd.
    localStorage.setItem(ACTIVITEIT_SLEUTEL, String(Date.now()));
    await act(() =>
      window.dispatchEvent(new StorageEvent("storage", { key: ACTIVITEIT_SLEUTEL })),
    );

    expect(dialoog()).toBeNull();
    await wacht(WAARSCHUWING_MS);
    expect(meldAf).not.toHaveBeenCalled();
  });

  describe("onbewaard werk", () => {
    it("bewaart eerst en meldt dan af", async () => {
      const opslag = onbewaardWerk(true);
      await toon();
      await wacht(INACTIEF_MS + SPELING);

      expect(opslag.pogingen).toBe(1);
      expect(opslag.open).toBe(false);
      expect(meldAf).toHaveBeenCalledTimes(1);
    });

    it("meldt niet af zolang bewaren mislukt, en wel zodra het lukt", async () => {
      const opslag = onbewaardWerk(false);
      await toon();
      await wacht(INACTIEF_MS + SPELING);

      expect(meldAf).not.toHaveBeenCalled();
      expect(dialoog()?.textContent).toContain("Wijzigingen nog niet bewaard");

      // Blijft het proberen bij elke controle…
      await wacht(60_000);
      expect(opslag.pogingen).toBeGreaterThan(1);
      expect(meldAf).not.toHaveBeenCalled();

      // …en zodra de verbinding terug is, wordt alsnog afgemeld.
      opslag.lukt = true;
      await wacht(SPELING);
      expect(meldAf).toHaveBeenCalledTimes(1);
      expect(leesAfmeldReden()).toBe("inactief");
    });

    it("'Aangemeld blijven' tijdens het wachten houdt de gebruiker aangemeld", async () => {
      onbewaardWerk(false);
      await toon();
      await wacht(INACTIEF_MS + SPELING);
      await act(() => knop("Aangemeld blijven").click());

      expect(dialoog()).toBeNull();
      await wacht(INACTIEF_MS - WAARSCHUWING_MS - SPELING);
      expect(meldAf).not.toHaveBeenCalled();
    });

    it("'Nu afmelden' vraagt eerst bevestiging als er werk verloren zou gaan", async () => {
      onbewaardWerk(false);
      const bevestig = vi.spyOn(window, "confirm").mockReturnValue(false);
      await toon();
      await wacht(INACTIEF_MS - WAARSCHUWING_MS + SPELING);
      await act(async () => knop("Nu afmelden").click());
      await wacht(10_000); // `bewaarAlles` wacht hooguit 10 s

      expect(bevestig).toHaveBeenCalledTimes(1);
      expect(meldAf).not.toHaveBeenCalled();

      bevestig.mockReturnValue(true);
      await act(async () => knop("Nu afmelden").click());
      await wacht(10_000);
      expect(meldAf).toHaveBeenCalledTimes(1);
    });
  });

  describe("maximale sessieduur", () => {
    /** Blijf de hele tijd actief (elke 10 min een klik), zodat enkel de sessieduur telt. */
    async function blijfActiefTot(tijd: number) {
      while (Date.now() + 10 * 60_000 < tijd) {
        await act(() => window.dispatchEvent(new Event("pointerdown")));
        await wacht(10 * 60_000);
      }
      await act(() => window.dispatchEvent(new Event("pointerdown")));
      await wacht(tijd - Date.now());
    }

    it("vraagt vooraf om te bevestigen en meldt af na de maximale duur, ook bij activiteit", async () => {
      await toon();
      await blijfActiefTot(START + MAX_SESSIE_MS - SESSIE_WAARSCHUWING_MS - SPELING);
      expect(dialoog()).toBeNull();

      await wacht(SPELING + 1000);
      expect(dialoog()?.textContent).toContain("Bevestig je login");

      // Activiteit of "wegklikken" verlengt de sessie niet.
      await act(() => window.dispatchEvent(new Event("pointerdown")));
      await act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
      await wacht(SESSIE_WAARSCHUWING_MS);
      expect(meldAf).toHaveBeenCalledTimes(1);
      expect(leesAfmeldReden()).toBe("sessie");
    });

    it("'Login bevestigen' start een nieuwe sessie, zonder af te melden", async () => {
      await toon();
      await blijfActiefTot(START + MAX_SESSIE_MS - SESSIE_WAARSCHUWING_MS + SPELING);
      expect(dialoog()?.textContent).toContain("Bevestig je login");

      sessieBegin.mockResolvedValue(Date.now()); // de Google-pop-up zet een nieuwe auth_time
      await act(async () => knop("Login bevestigen").click());

      expect(bevestig).toHaveBeenCalledTimes(1);
      expect(dialoog()).toBeNull();
      await blijfActiefTot(START + MAX_SESSIE_MS + 60 * 60_000);
      expect(meldAf).not.toHaveBeenCalled();
    });

    it("toont een fout als met een ander account bevestigd wordt", async () => {
      bevestig.mockRejectedValue(Object.assign(new Error("mismatch"), { code: "auth/user-mismatch" }));
      await toon();
      await blijfActiefTot(START + MAX_SESSIE_MS - SESSIE_WAARSCHUWING_MS + SPELING);
      await act(async () => knop("Login bevestigen").click());

      expect(dialoog()?.textContent).toContain("Dat is een ander account");
      expect(meldAf).not.toHaveBeenCalled();
    });

    it("een tabblad dat na het einde van de sessie terug opengaat, meldt meteen af", async () => {
      sessieBegin.mockResolvedValue(START - MAX_SESSIE_MS - 60_000); // gisteren aangemeld
      await toon(gebruiker(START - MAX_SESSIE_MS - 60_000));
      await wacht(0);

      expect(meldAf).toHaveBeenCalledTimes(1);
      expect(leesAfmeldReden()).toBe("sessie");
    });
  });
});
