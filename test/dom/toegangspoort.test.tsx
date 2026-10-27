// @vitest-environment jsdom
/**
 * De toegangspoort (`src/components/Toegangspoort.tsx`) bij een verlopen sessie. Dan weigert de
 * database ook het eigen account — de poort mag dat niet als "geen toegang" tonen, maar moet
 * afmelden met "Je sessie is verlopen".
 *
 * Draaien: `npx vitest run test/dom`
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  meldAf: vi.fn(),
  sessieBegin: vi.fn<() => Promise<number>>(),
  status: { gebruiker: null as unknown, persoon: null as unknown, laden: false },
}));
vi.mock("../../src/lib/data", () => ({
  PERSISTENTIE_MODUS: "firebase",
  meldAanMetGoogle: vi.fn(),
  meldAfVanFirebase: m.meldAf,
  sessieBeginVan: m.sessieBegin,
  bevestigAanmelding: vi.fn(),
}));
vi.mock("../../src/lib/firebaseAuth", () => ({
  useAuthStatus: () => m.status,
  isKeerpuntAccount: () => true,
  heeftToegang: (s: { persoon: { actief?: boolean } | null }) => Boolean(s.persoon?.actief),
}));

import { Toegangspoort } from "../../src/components/Toegangspoort";
import { MAX_SESSIE_MS, leesAfmeldReden, zetAfmeldReden } from "../../src/lib/inactiviteit";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NU = new Date("2026-10-28T09:00:00Z").getTime();
const gebruiker = {
  uid: "u1",
  email: "mentor@keerpuntscholen.be",
  metadata: { lastSignInTime: new Date(NU - 13 * 3600_000).toUTCString() },
} as unknown as User;

let container: HTMLDivElement;
let root: Root;

const toon = () =>
  act(async () => {
    root.render(
      <Toegangspoort>
        <p>de app</p>
      </Toegangspoort>,
    );
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NU);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
  m.meldAf.mockReset();
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
});

describe("toegangspoort en sessieduur", () => {
  it("verlopen sessie + geweigerd account: afmelden met 'sessie verlopen', niet 'geen toegang'", async () => {
    m.sessieBegin.mockResolvedValue(NU - MAX_SESSIE_MS - 60_000);
    m.status = { gebruiker, persoon: null, laden: false }; // de regels weigerden het account

    await toon();
    expect(m.meldAf).toHaveBeenCalledTimes(1);
    expect(leesAfmeldReden()).toBe("sessie");
    expect(container.textContent).not.toContain("nog geen toegang");
  });

  it("geldige sessie zonder account: wel 'geen toegang'", async () => {
    m.sessieBegin.mockResolvedValue(NU - 60_000);
    m.status = { gebruiker, persoon: null, laden: false };

    await toon();
    expect(m.meldAf).not.toHaveBeenCalled();
    expect(container.textContent).toContain("nog geen toegang");
  });

  it("geldige sessie met account: de app verschijnt", async () => {
    m.sessieBegin.mockResolvedValue(NU - 60_000);
    m.status = { gebruiker, persoon: { actief: true }, laden: false };

    await toon();
    expect(container.textContent).toContain("de app");
  });

  it("na het afmelden toont het inlogscherm waarom", async () => {
    zetAfmeldReden("sessie");
    m.status = { gebruiker: null, persoon: null, laden: false };

    await toon();
    expect(container.textContent).toContain("Je sessie is verlopen");
  });
});
