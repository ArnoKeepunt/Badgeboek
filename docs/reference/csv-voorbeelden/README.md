# CSV-formaten (pagina "Gegevens")

Scheidingsteken bij **export**: `;` (Excel-NL). Bij **import** wordt `;` of `,` automatisch
herkend aan de kopregel. UTF-8, met of zonder BOM. Velden met `; , " \n` mogen tussen `"..."`.

## Leerlingen — import & export

Import leest rechtstreeks de **Smartschool-export** (voorbeeld: `leerlingen.csv`, fictieve namen):

| Kolom | Verplicht | Opmerking |
|---|---|---|
| `Intern nummer` | **ja** | De **vaste sleutel** — enkel cijfers. Zet de kolom in Excel als tekst op. |
| `Gebruikersnaam` | nee | Smartschool-gebruikersnaam, informatief (`gebruikersnaam` op de leerling). |
| `Voornaam` | **ja** | |
| `Naam` | **ja** | De achternaam. |
| `Klas- of groepsnaam` | nee | bv. `2B Molenbeek` → leerjaar 2, klasgroep B, vestiging Molenbeek. |

De vestiging uit de klasnaam wordt op de vestigingenlijst afgebeeld: exact, of een afgekapte
naam (`Geraardsberge` → Geraardsbergen), of een gekende vestiging met iets erachter
(`Hasselt Maas` → Hasselt). Elke zo'n omzetting staat in het importverslag; een onbekende
naam blijft letterlijk staan en verschijnt als "ongekoppeld" op Vestigingen.

De eigen **export** gebruikt `id; voornaam; achternaam; vestiging; leerjaar; klasgroep;
gebruikersnaam; leerjaarhistoriek` en kan zo ook weer ingelezen worden. Aparte kolommen
`vestiging`/`leerjaar`/`klasgroep` winnen van wat uit de klasnaam komt.

Import = **upsert op `id`**: bestaande leerlingen worden bijgewerkt (naam, klas, vestiging),
nieuwe toegevoegd, de rest blijft staan. Zo raken evaluaties nooit los bij een jaarovergang.

Er zitten geen fictieve leerlingen meer in de app. Oude demo-leerlingen (id = een naam i.p.v.
een nummer) ruim je op met "Fictieve leerlingen verwijderen" op Gegevens.

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
