/**
 * Een vaste, zachte kleur per cursus voor het icoontje in de leerlingweergave. Puur decoratief —
 * bewust níet de beoordelingskleuren (blauw/groen/geel/rood), zodat een cursus er nooit "rood"
 * uitziet. Afgeleid uit het cursus-id, dus overal en op elk toestel dezelfde.
 */
const PALET = [
  { bg: "#e3efe7", fg: "#2f5a41" },
  { bg: "#e7ecfa", fg: "#34488c" },
  { bg: "#f8ebe0", fg: "#8a4a1c" },
  { bg: "#efe7f8", fg: "#5b3d8a" },
  { bg: "#dff1f1", fg: "#1f6464" },
  { bg: "#f8e6ee", fg: "#8a2f57" },
  { bg: "#f5f0dc", fg: "#6e5714" },
] as const;

export function cursusKleur(cursusId: string): { bg: string; fg: string } {
  let h = 0;
  for (const c of cursusId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALET[h % PALET.length];
}

/** Eén of twee letters voor het icoontje: "Levende Wiskunde" → "LW", "Kring" → "K". */
export function cursusInitialen(naam: string): string {
  const woorden = naam.split(/\s+/).filter((w) => /^[A-ZÀ-Ý]/.test(w));
  const bron = woorden.length > 0 ? woorden : naam.split(/\s+/);
  return bron
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
