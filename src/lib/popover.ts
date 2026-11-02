import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface PopoverPos {
  top: number;
  left: number;
  /**
   * Zo hoog mag het paneel maximaal zijn om binnen het scherm te blijven. Op een laag scherm
   * (laptop, ingezoomd) kleiner dan het menu zelf → het paneel scrollt dan intern
   * (`.zwevend-menu` heeft `overflow-y: auto`).
   */
  maxHeight: number;
}

/**
 * Positioneer een zwevend menu/paneel t.o.v. een ankerknop met vaste (`fixed`) coördinaten,
 * zodat het via een portal buiten het rooster kan vallen (geen clipping, geen inner-scroll).
 * Sluit bij Escape, en bij scrollen/herschalen (een `fixed` element volgt het anker niet mee).
 */
const MARGE = 8;
/** Minder ruimte dan dit aan beide kanten (heel laag scherm): dan mag het menu over het anker. */
const MIN_RUIMTE = 160;

/**
 * Verticale plaats voor een paneel van hoogte `h` bij anker `r`: onder het anker als het daar
 * past, anders erboven. Past het nergens volledig, dan de kant met de meeste ruimte, met intern
 * scrollen (`maxHeight`) — maar **nooit over het aangeklikte vakje** heen: dan landde een
 * volgende klik (bv. op de leerling ernaast) op een kleur in het menu.
 */
export function verticaal(r: DOMRect, h: number): { top: number; maxHeight: number } {
  const vh = window.innerHeight;
  const onder = r.bottom + 4;
  const ruimteOnder = vh - MARGE - onder;
  const ruimteBoven = r.top - 4 - MARGE;
  if (h <= ruimteOnder) return { top: onder, maxHeight: ruimteOnder };
  // Erboven: precies tot tegen het anker — groeit het menu later (bv. "Geschiedenis" openklappen),
  // dan scrollt het intern i.p.v. naar beneden over het vakje te schuiven.
  if (h <= ruimteBoven) return { top: r.top - 4 - h, maxHeight: h };
  if (Math.max(ruimteOnder, ruimteBoven) >= MIN_RUIMTE) {
    return ruimteOnder >= ruimteBoven
      ? { top: onder, maxHeight: ruimteOnder }
      : { top: MARGE, maxHeight: ruimteBoven };
  }
  return { top: MARGE, maxHeight: vh - 2 * MARGE };
}

export function usePopover(
  open: boolean,
  anker: RefObject<HTMLElement | null>,
  sluit: () => void,
  opties: {
    breedte: number;
    /** Geschatte hoogte, voor de eerste plaatsing. Met `paneel` wordt daarna de echte gemeten. */
    hoogte: number;
    uitlijn?: "links" | "rechts" | "midden";
    /**
     * Optioneel: het paneel zelf. Daarmee meet de hook na het openen de échte hoogte (een
     * schatting zat er soms ver naast, waardoor het menu zonder reden over de cel kwam). En
     * scrollt er intern iets in het paneel (bv. een lange lijst), dan sluit dat het paneel niet —
     * enkel een scroll ERBUITEN (de pagina, of een andere scrollcontainer waar het anker in zit)
     * betekent dat het anker verschoven is.
     */
    paneel?: RefObject<HTMLElement | null>;
  },
): PopoverPos | null {
  const { breedte, hoogte, uitlijn = "links", paneel } = opties;
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const gemeten = useRef(false);

  useLayoutEffect(() => {
    gemeten.current = false;
    if (!open || !anker.current) {
      setPos(null);
      return;
    }
    const r = anker.current.getBoundingClientRect();
    let left =
      uitlijn === "rechts"
        ? r.right - breedte
        : uitlijn === "midden"
          ? r.left + r.width / 2 - breedte / 2
          : r.left;
    left = Math.min(Math.max(MARGE, left), window.innerWidth - breedte - MARGE);
    setPos({ left, ...verticaal(r, hoogte) });
    // Alleen herberekenen wanneer het menu opengaat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tweede beurt, zodra het paneel er staat (nog vóór het getekend wordt): met de echte hoogte
  // opnieuw plaatsen. Eén keer per openen.
  useLayoutEffect(() => {
    const p = paneel?.current;
    if (!open || !pos || !p || !anker.current || gemeten.current) return;
    gemeten.current = true;
    const echt = p.scrollHeight + (p.offsetHeight - p.clientHeight); // inhoud + randen
    const v = verticaal(anker.current.getBoundingClientRect(), echt);
    if (v.top !== pos.top || v.maxHeight !== pos.maxHeight) setPos({ ...pos, ...v });
  }, [open, pos, paneel, anker]);

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
