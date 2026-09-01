# CSV-formaten (pagina "Gegevens")

Scheidingsteken bij **export**: `;` (Excel-NL). Bij **import** wordt `;` of `,` automatisch
herkend aan de kopregel. UTF-8, met of zonder BOM. Velden met `; , " \n` mogen tussen `"..."`.

## Leerlingen — import & export

| Kolom | Verplicht | Opmerking |
|---|---|---|
| `id` | nee* | De **vaste sleutel**. Bij voorkeur de OneRoster `sourcedId` uit Smartschool. Ontbreekt hij, dan wordt er één afgeleid uit de naam. |
| `voornaam` | **ja** | |
| `achternaam` | **ja** | |
| `vestiging` | nee | Gent / Oudenaarde / Molenbeek |
| `leerjaar` | nee | 1 t/m 6 (default 1) |
| `klasgroep` | nee | bv. A of B (default A) |

Import = **upsert op `id`**: bestaande leerlingen worden bijgewerkt (naam, klas, vestiging),
nieuwe toegevoegd, de rest blijft staan. Zo raken evaluaties nooit los bij een jaarovergang.

Alternatieve kolomnamen die ook gelezen worden: `firstname`, `lastname`, `naam`, `sourcedid`,
`jaar`, `grade`, `groep`, `klas`, `class`.

## Doelen — import & export

Kolommen: `code`, `stroom`, `competentie`, `nummer`, `soort`, `omschrijving`, `uitleg`,
`opmerking`. Verplicht: **`code`** en **`omschrijving`**. Ontbreekt `stroom`, dan wordt die uit
het codevoorvoegsel gehaald (`1A.ST.02.01` → `1A`). `soort` ∈ {standaard, basisgeletterdheid,
uitbreiding, freinet} (ook `st/bg/ub/f`).

Import **vervangt de volledige doelenlijst**. Met "Herstel standaardlijst" ga je terug naar de
lijst uit de decretale eindtermenbestanden.

## Evaluaties — enkel export (de back-up)

Eén rij per ingevulde kleur: `schooljaar; periode; leerling_id; voornaam; achternaam; stroom;
cursus; rubric; badge; kleur; behaald`. `behaald` = ja bij groen of blauw.
