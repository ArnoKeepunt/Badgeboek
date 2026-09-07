import { useCallback, useRef } from "react";

/**
 * Synchroniseert de horizontale scrollpositie van een groepje scroll-kaders. Elk kader
 * registreert zich via de teruggegeven ref-callback; scrollt de gebruiker er één, dan volgen
 * de andere mee. Gebruikt voor de badge- en deelevaluatiematrix die in de split naast elkaar
 * staan met exact even brede kolommen, zodat dezelfde leerlingkolom bij beide in beeld blijft.
 */
export function useScrollSync() {
  const kaders = useRef(new Set<HTMLElement>());
  // Kaders waarvan het eerstvolgende scroll-event de echo van een sync is (niet doorsturen).
  const negeer = useRef(new Set<HTMLElement>());

  return useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const set = kaders.current;
    set.add(el);

    const onScroll = () => {
      if (negeer.current.delete(el)) return;
      for (const ander of set) {
        if (ander === el || Math.round(ander.scrollLeft) === Math.round(el.scrollLeft)) continue;
        negeer.current.add(ander);
        ander.scrollLeft = el.scrollLeft;
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      set.delete(el);
      negeer.current.delete(el);
    };
  }, []);
}
