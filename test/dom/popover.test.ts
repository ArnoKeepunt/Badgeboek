// @vitest-environment jsdom
/**
 * Plaatsing van zwevende menu's (`verticaal` in src/lib/popover.ts): het kleurenmenu mag nooit
 * over het aangeklikte vakje komen — anders landt de volgende klik (op een andere leerling) op
 * een kleur in het menu.
 *
 * Draaien: `npx vitest run test/dom`
 */
import { beforeEach, describe, expect, it } from "vitest";
import { verticaal } from "../../src/lib/popover";

const anker = (top: number, hoogte = 30) =>
  ({ top, bottom: top + hoogte, left: 0, right: 40, width: 40, height: hoogte }) as DOMRect;
const overlapt = (r: DOMRect, p: { top: number; maxHeight: number }, h: number) =>
  p.top < r.bottom && p.top + Math.min(h, p.maxHeight) > r.top;

beforeEach(() => {
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
});

describe("verticaal", () => {
  it("past het eronder, dan eronder", () => {
    expect(verticaal(anker(350), 330)).toEqual({ top: 384, maxHeight: 408 });
  });

  it("past het enkel erboven, dan erboven", () => {
    const p = verticaal(anker(600), 330);
    expect(p.top).toBe(600 - 4 - 330);
  });

  it("past het nergens volledig: grootste kant met intern scrollen, nooit over de cel", () => {
    for (const top of [100, 250, 350, 420, 550, 700]) {
      const r = anker(top);
      const p = verticaal(r, 490);
      expect(overlapt(r, p, 490)).toBe(false);
      expect(p.top).toBeGreaterThanOrEqual(8);
      expect(p.top + p.maxHeight).toBeLessThanOrEqual(792);
    }
  });

  it("heel laag scherm: binnen beeld, desnoods over de cel", () => {
    Object.defineProperty(window, "innerHeight", { value: 260, configurable: true });
    const p = verticaal(anker(110), 400);
    expect(p).toEqual({ top: 8, maxHeight: 244 });
  });
});
