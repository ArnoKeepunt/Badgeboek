# Badgeboeken (Word) → Badges-curriculum

Bron voor de **Badges**-pagina: de vier Word-badgeboeken (er bestaan geen CSV-versies van).

| Bestand | Stroom | Cursussen | Rubrieken | Badges |
|---|---|---|---|---|
| `2025 Badgeboek 1ste graad A (versie 2025 09 23).docx` | `1A` | 17 | 37 | 240 |
| `2025 Badgeboek 1ste graad B (versie 2025 09 23).docx` | `1B` | 17 | 37 | 232 |
| `2025 Badgeboek 2de graad A (versie 2025 09 23).docx` | `2A` | 17 | 39 | 256 |
| `2025 Badgeboek 3de graad A (versie 2025 09).docx` | `3A` | 2 | 10 | 48 |

Alle cursussen uit de inhoudsopgave zitten erin, behalve "Vrije initiatieven buiten de lijntjes"
(vrije projecten, geen vaste badges). 2A's "Ateliers" heet in de doc "Focusateliers & vrije
ateliers" — via een alias herkend.

## Verwerkt naar code

Regenereren: `python3 scripts/extract_badgeboeken.py` (leest de .docx rechtstreeks — geen CSV nodig).

- `src/lib/curriculum1A.ts` / `1B` / `2A` / `3A` — **auto-gegenereerd** uit de docx.
  Per bestand: `cursussen<STROOM>`, `rubrics<STROOM>`, `leerdoelen<STROOM>`.
- `src/lib/curriculum.ts` — voegt de vier samen + helpers (`cursussenVoorStroom`,
  `leerdoelenVoorStroom`, …).
- Structuur: **Cursus → Rubric → Leerdoel (= badge)**. Een leerdoel draagt optioneel `kleuren`
  (de rubric-omschrijving per kleur blauw/groen/geel/rood), voor de rubrics die dat als
  kleurtabel hadden (Basisvaardigheden).

## Wat de parser meeneemt

- **Kleurrubrics** (Basisvaardigheden): criterium ↔ 4 kleurbeschrijvingen.
- **Coaching-tabellen** (Planning en reflectie): elke criteriumrij.
- **Deelstapjes-/badge-tabellen** (Actua, Boekenronde, Vrije tekst, Communicatie, Ateliers,
  Onderzoek, Cultuur, Levende Wiskunde, Exploratie, Toonmoment, Welzijn, Klaskas, Burgerschap,
  Kring, Klasraad): elke instantie (bv. "NL 1", "Voorzitter", "Domein Natuur") als aparte badge.

## Nog na te kijken

- Enkele **rubrieknamen** zijn ruw ("Als tijdsbewaker" i.p.v. "Rollen", "Domein"). Vrij te
  herbenoemen.
- De **1e/2e-jaar-splitsing** per rapport is platgeslagen (elke badge één keer i.p.v. per jaar).
- **3e graad** is grotendeels modulair (geïntegreerde opdrachten, trajecten, klaswerking+,
  burgerschapsreis) zonder vaste, telbare badges — enkel Basisvaardigheden en Planning &
  reflectie zijn verwerkt. Dat volgt de bron.
- Regenereren bij een nieuwe badgeboekversie i.p.v. handmatig bijwerken.
