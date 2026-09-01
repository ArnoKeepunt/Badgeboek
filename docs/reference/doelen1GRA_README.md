# Eindtermenbestanden — Doelen-pagina

Bron voor de **Doelen**-pagina (`/doelen`) — de decretale minimumdoelen en eindtermen.
Eén bestand per graad/stroom:

| Bestand | Stroom | Doelen | Status |
|---------|--------|--------|--------|
| `doelen1GRA_volledig.xlsx` | `1A` — 1e graad A | **142** | verwerkt |
| `doelen1GRB_volledig.xlsx` | `1B` — 1e graad B | **116** | verwerkt |
| `doelen2GRA_volledig.xlsx` | `2A` — 2e graad A | **155** | verwerkt |
| — | `3A` — 3e graad | — | **nog niet aangeleverd** |

Kolommen (blad met de stroom-naam):

1. Naam van de sleutelcompetentie
2. Nummer van het doel (bv. `01.01`, `BG02.01`, `UD02.01`)
3. Soort doel — `standaard` · `basisgeletterdheid` · `uitbreiding` · `Freinet`
4. Korte omschrijving van het minimumdoel
5. Verdere uitleg (memorie / voetnoot / kenniselementen)
6. Sleutel (unieke code), bv. `1A.ST.01.01`
7. Opmerkingen / mogelijke fouten in de brontekst

## Verwerkt naar code

- `src/lib/minimumdoelen1A.ts`, `minimumdoelen1B.ts`, `minimumdoelen2A.ts` —
  **auto-gegenereerd**, één object per doel (met `stroom`-veld). Niet met de hand herschikken;
  bij een nieuwe export van een xlsx opnieuw genereren (eerste blad, kolommen A–G).
- `src/lib/minimumdoelen.ts` — het `Minimumdoel`-type, `alleMinimumdoelen` (basislijst over
  alle stromen), `metWijzigingen()`, labels, `SOORT_KLEUR` (basisgeletterdheid = rood,
  standaard = groen, uitbreiding = blauw, Freinet = geel) en de groepering per sleutelcompetentie.
- De app bewaart bewerkingen los van de basislijst: `doelWijzigingen` in de store, per code,
  gelegd bovenop `alleMinimumdoelen`. De **Bewerk**-knop op de Doelen-pagina schrijft daarin.
- De Doelen-pagina wordt lui geladen (aparte chunk) omdat de eindtermenlijst fors is.

Aantallen per soort: 1A → standaard 114 / uitbreiding 12 / basisgeletterdheid 10 / Freinet 6;
1B → 88 / 12 / 10 / 6; 2A → 124 / 23 / 0 / 8.
