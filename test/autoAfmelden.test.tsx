// @vitest-environment jsdom
/**
 * Automatisch afmelden na inactiviteit (`src/components/AutoAfmelden.tsx`). Draait met nep-timers
 * en een gemockte Firebase-afmelding: geen emulator, geen echte login nodig. Volgt de grenzen uit
 * `src/lib/inactiviteit.ts`, dus blijft kloppen als die (bv. na testen) terug op 30 min staan.
 *
 * Draaien: `npx vitest run test/autoAfmelden.test.tsx`
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const meldAf = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/data", () => ({ meldAfVanFirebase: meldAf }));

import { AutoAfmelden } from "../src/components/AutoAfmelden";
import {
  ACTIVITEIT_SLEUTEL,
  INACTIEF_MS,
  WAARSCHUWING_MS,
  isAfgemeldWegensInactiviteit,
  zetAfgemeldWegensInactiviteit,
} from "../src/lib/inactiviteit";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** De controle loopt elke 15 s zolang er geen waarschuwing is — zoveel speling nemen we. */
const SPELING = 16_000;
const START = new Date("2026-10-27T09:00:00Z").getTime();

let container: HTMLDivElement;
let root: Root;

const gebruiker = (aangemeldOp = START) =>
  ({ metadata: { lastSignInTime: new Date(aangemeldOp).toUTCString() } }) as unknown as User;

const toon = (u = gebruiker()) => act(() => root.render(<AutoAfmelden gebruiker={u} />));
const wacht = (ms: number) => act(() => vi.advanceTimersByTime(ms));
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
  zetAfgemeldWegensInactiviteit(false);
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
    expect(isAfgemeldWegensInactiviteit()).toBe(true);
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
    expect(isAfgemeldWegensInactiviteit()).toBe(false);
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
});
