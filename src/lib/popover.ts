import { type RefObject, useEffect, useLayoutEffect, useState } from "react";

export interface PopoverPos {
  top: number;
  left: number;
}

/**
 * Positioneer een zwevend menu/paneel t.o.v. een ankerknop met vaste (`fixed`) coördinaten,
 * zodat het via een portal buiten het rooster kan vallen (geen clipping, geen inner-scroll).
 * Sluit bij Escape, en bij scrollen/herschalen (een `fixed` element volgt het anker niet mee).
 */
export function usePopover(
  open: boolean,
  anker: RefObject<HTMLElement | null>,
  sluit: () => void,
  opties: {
    breedte: number;
    hoogte: number;
    uitlijn?: "links" | "rechts" | "midden";
    /**
     * Optioneel: het paneel zelf. Scrollt er intern iets in het paneel (bv. een lange lijst),
     * dan mag dat het paneel niet sluiten — enkel een scroll ERBUITEN (de pagina, of een andere
     * scrollcontainer waar het anker in zit) betekent dat het anker verschoven is.
     */
    paneel?: RefObject<HTMLElement | null>;
  },
): PopoverPos | null {
  const { breedte, hoogte, uitlijn = "links", paneel } = opties;
  const [pos, setPos] = useState<PopoverPos | null>(null);

  useLayoutEffect(() => {
    if (!open || !anker.current) {
      setPos(null);
      return;
    }
    const r = anker.current.getBoundingClientRect();
    const marge = 8;
    let left =
      uitlijn === "rechts"
        ? r.right - breedte
        : uitlijn === "midden"
          ? r.left + r.width / 2 - breedte / 2
          : r.left;
    left = Math.min(Math.max(marge, left), window.innerWidth - breedte - marge);
    const onder = r.bottom + 4;
    const top =
      onder + hoogte > window.innerHeight && r.top > hoogte ? r.top - 4 - hoogte : onder;
    setPos({ top, left });
    // Alleen herberekenen wanneer het menu opengaat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") sluit();
    };
    // Capture-phase: zo vangen we ook een scroll op een willekeurige voorouder-scrollcontainer
    // (bv. de badgematrix) op, niet enkel de pagina zelf. Maar scrolt het net binnenin dit
    // paneel (`e.target` zit in `paneel`), dan is het anker niet verschoven — niet sluiten.
    const onScroll = (e: Event) => {
      const p = paneel?.current;
      if (p && e.target instanceof Node && p.contains(e.target)) return;
      sluit();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", sluit);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", sluit);
    };
  }, [open, sluit, paneel]);

  return pos;
}
