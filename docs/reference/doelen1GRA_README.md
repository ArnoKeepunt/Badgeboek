# doelen1GRA_volledig.xlsx

Bron voor de **Doelen**-pagina (`/doelen`) — de decretale minimumdoelen en eindtermen.

## Inhoud

| Blad | Graad/stroom | Status |
|------|--------------|--------|
| `1A` | 1e graad A | **142 doelen** — verwerkt in de app |
| `1B` | 1e graad B | leeg |
| `2A` | 2e graad A | leeg |
| `3A` | 3e graad | leeg |

Kolommen op blad `1A`:

1. Naam van de sleutelcompetentie
2. Nummer van het doel (bv. `01.01`, `BG02.01`, `UD02.01`)
3. Soort doel — `standaard` · `basisgeletterdheid` · `uitbreiding` · `Freinet`
4. Korte omschrijving van het minimumdoel
5. Verdere uitleg (memorie / voetnoot / kenniselementen)
6. Sleutel (unieke code), bv. `1A.ST.01.01`
7. Opmerkingen / mogelijke fouten in de brontekst

## Verwerkt naar code

- `src/lib/minimumdoelen1A.ts` — **auto-gegenereerd**, één object per doel. Niet met de hand
  herschikken; bij een nieuwe export van de xlsx opnieuw genereren (blad `1A`, kolommen A–G).
- `src/lib/minimumdoelen.ts` — het `Minimumdoel`-type, labels, `SOORT_KLEUR` (kleurcode per
  soort: basisgeletterdheid = rood, standaard = groen, uitbreiding = blauw, Freinet = geel) en
  de groepering per sleutelcompetentie.

142 doelen: standaard 114 · uitbreiding 12 · basisgeletterdheid 10 · Freinet 6.
Sleutelcompetenties aanwezig: 1–9, 11, 13, 15, 16, 17 (Freinetvaardigheden).
