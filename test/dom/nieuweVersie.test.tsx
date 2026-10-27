// @vitest-environment jsdom
/**
 * De versiemelding (`src/components/NieuweVersie.tsx`): enkel zichtbaar wie een oudere versie
 * draait dan wat online staat. `fetch` is nagebootst.
 *
 * Draaien: `npx vitest run test/dom`
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NieuweVersie } from "../../src/components/NieuweVersie";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TIEN_MIN = 10 * 60_000;
let container: HTMLDivElement;
let root: Root;
let online: string | Error;
const fetchMock = vi.fn(async () => {
  if (online instanceof Error) throw online;
  return new Response(JSON.stringify({ versie: online }), { status: 200 });
});

const toon = (versie: string) => act(async () => root.render(<NieuweVersie versie={versie} />));
const wacht = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const melding = () => container.querySelector(".nieuwe-versie");

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
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

describe("versiemelding", () => {
  it("wie de huidige versie draait, ziet niets", async () => {
    online = "v2";
    await toon("v2");
    await wacht(3 * TIEN_MIN);

    expect(fetchMock).toHaveBeenCalled();
    expect(melding()).toBeNull();
  });

  it("wie een oudere versie draait, krijgt de melding", async () => {
    online = "v2";
    await toon("v1");
    expect(melding()).toBeNull(); // niet meteen bij het openen

    await wacht(TIEN_MIN);
    expect(melding()?.textContent).toContain("nieuwe versie");
  });

  it("controleert ook zodra het tabblad weer zichtbaar wordt", async () => {
    online = "v2";
    await toon("v1");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    await wacht(0);

    expect(melding()).not.toBeNull();
  });

  it("offline of geen versiebestand: geen (verkeerde) melding", async () => {
    online = new Error("offline");
    await toon("v1");
    await wacht(TIEN_MIN);

    expect(melding()).toBeNull();
  });

  it("zonder eigen versie (vite dev) wordt er niets opgehaald", async () => {
    online = "v2";
    await toon("");
    await wacht(3 * TIEN_MIN);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(melding()).toBeNull();
  });
});
