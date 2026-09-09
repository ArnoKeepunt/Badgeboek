#!/usr/bin/env python3
"""
Genereer de gebundelde badge-data uit `docs/reference/deelevaluaties_alle-graden-3.xlsx`.

    python3 scripts/extract_badges.py

Per tabblad (stroom) rijen `Cursus | Deelevaluatie(=groep) | Verplicht Aantal`. Elke rij →
zoveel badges `"<groep> <n>"` (of `"<groep>"` bij 1), plat onder de cursus. De kolommen worden
op naam gezocht (`vind_kolommen`), dus een andere volgorde/benaming blijft werken.

Uitvoer per stroom: `src/lib/curriculum{1A,1B,2A,3A}.ts` met twee arrays:
  - `cursussen{stroom}: CursusRuw[]`  ({ id, stroom, naam, volgorde })
  - `badges{stroom}: BadgeRuw[]`      ({ id, cursusId, groep, omschrijving, volgorde, categorie })

Rubrics + de deelbadge-"types" worden in de app afgeleid (`verrijk()` in curriculum.ts) — niet
opgeslagen. Dit is de *gebundelde* set (offline-terugval); staat er een database-versie klaar
(Firestore `curriculum/{stroom}/cursussen/…/badges/…`), dan gebruikt de app die.
"""
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "docs" / "reference" / "deelevaluaties_alle-graden-3.xlsx"
LIB = ROOT / "src" / "lib"

# xlsx-tabblad -> stroomcode
SHEETS = {
    "1ste Graad A": "1A",
    "1ste Graad B": "1B",
    "2de Graad A": "2A",
    "3de Graad A": "3A",
}


def col_idx(ref: str) -> int:
    letters = "".join(c for c in ref if c.isalpha())
    n = 0
    for c in letters:
        n = n * 26 + (ord(c) - 64)
    return n


def load_rows(z: zipfile.ZipFile, sheet_path: str, strings: list[str]):
    sh = ET.fromstring(z.read(sheet_path))
    for row in sh.iter(M + "row"):
        cells: dict[int, str] = {}
        for c in row.iter(M + "c"):
            ref = c.get("r")
            t = c.get("t")
            v = c.find(M + "v")
            isv = c.find(M + "is")
            if v is not None:
                val = strings[int(v.text)] if t == "s" else (v.text or "")
            elif isv is not None:
                val = "".join(x.text or "" for x in isv.iter(M + "t"))
            else:
                val = ""
            cells[col_idx(ref)] = val.strip()
        yield cells


def sheet_rel_map(z: zipfile.ZipFile) -> dict[str, str]:
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    R = "{http://schemas.openxmlformats.org/package/2006/relationships}"
    rid_to_target = {r.get("Id"): r.get("Target") for r in rels.iter(R + "Relationship")}
    RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    out = {}
    for s in wb.iter(M + "sheet"):
        target = rid_to_target[s.get(RID)]
        if not target.startswith("xl/"):
            target = "xl/" + target
        out[s.get("name")] = target
    return out


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def num(s: str) -> int:
    try:
        return int(float(s)) if s else 0
    except ValueError:
        return 0


def slug(s: str) -> str:
    """Leesbare, ascii-veilige id-component: 'Geïntegreerde opdrachten (GOP)' -> 'geintegreerde-opdrachten-gop'."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "x"


def uniek(basis: str, gebruikt: set[str]) -> str:
    kandidaat, n = basis, 2
    while kandidaat in gebruikt:
        kandidaat = f"{basis}-{n}"
        n += 1
    gebruikt.add(kandidaat)
    return kandidaat


def vind_kolommen(rijen: list[dict[int, str]]) -> dict[str, int]:
    """Kolomindexen uit de kopregel (op naam), met vaste posities als terugval. Zo blijft het
    script werken als de xlsx van vorm verandert (bv. 'Aantal' → 'Verplicht aantal')."""
    for cells in rijen:
        koppen = {i: v.strip().lower() for i, v in cells.items()}
        if "cursus" not in koppen.values():
            continue

        def idx(*namen: str, standaard: int) -> int:
            return next((i for i, v in koppen.items() if v in namen), standaard)

        return {
            "cursus": idx("cursus", standaard=1),
            "groep": idx("deelevaluatie", "deelbadge", "groep", standaard=2),
            # "Aantal" blijft voorrang hebben; een nieuwe xlsx met enkel "Verplicht aantal"
            # wordt daar dan op teruggevonden.
            "aantal": idx("aantal", "verplicht aantal", "aantal verplicht", "verplicht", standaard=3),
        }
    return {"cursus": 1, "groep": 2, "aantal": 3}


def main() -> None:
    z = zipfile.ZipFile(XLSX)
    ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
    strings = ["".join(t.text or "" for t in si.iter(M + "t")) for si in ss]
    rel = sheet_rel_map(z)

    for sheet_name, stroom in SHEETS.items():
        cursussen = []           # [{id, naam, volgorde}]
        cursus_id_van_naam = {}   # naam -> id
        cursus_ids = set()        # gebruikte cursus-slugs binnen deze stroom
        badges = []               # [{id, cursusId, groep, omschrijving, volgorde}]
        doel_teller = {}          # cursusId -> laatste d-index

        rijen = list(load_rows(z, rel[sheet_name], strings))
        kol = vind_kolommen(rijen)
        for cells in rijen:
            cursus = cells.get(kol["cursus"], "")
            groep = cells.get(kol["groep"], "")   # xlsx-kolom "Deelevaluatie" = de badge-groep
            aantal = num(cells.get(kol["aantal"], ""))
            if not cursus or not groep:
                continue
            low = cursus.lower()
            if low == "cursus" or low.startswith("totaal"):
                continue

            if cursus not in cursus_id_van_naam:
                cid = uniek(f"{stroom}-{slug(cursus)}", cursus_ids)
                cursus_id_van_naam[cursus] = cid
                cursussen.append({"id": cid, "naam": cursus, "volgorde": len(cursussen)})
                doel_teller[cid] = 0
            cid = cursus_id_van_naam[cursus]

            hoeveel = max(1, aantal)
            for i in range(1, hoeveel + 1):
                doel_teller[cid] += 1
                # Leesbare id's: cursus op naam (`<stroom>-<cursusslug>`), badge met korte teller
                # (`<cid>-d<n>`). Bij het hernoemen van een cursus/badge in de xlsx verschuift de id.
                did = f"{cid}-d{doel_teller[cid]}"
                omschrijving = groep if hoeveel == 1 else f"{groep} {i}"
                badges.append(
                    {
                        "id": did,
                        "cursusId": cid,
                        "groep": groep,
                        "omschrijving": omschrijving,
                        "volgorde": doel_teller[cid] - 1,
                    }
                )

        write_curriculum(stroom, cursussen, badges)
        print(f"  {stroom}: {len(cursussen)} cursussen, {len(badges)} badges")


def write_curriculum(stroom, cursussen, badges) -> None:
    out = LIB / f"curriculum{stroom}.ts"
    L = [
        "// AUTO-GEGENEREERD via scripts/extract_badges.py",
        "// uit docs/reference/deelevaluaties_alle-graden-2.xlsx — niet met de hand aanpassen.",
        'import type { CursusRuw, BadgeRuw } from "./curriculum";',
        "",
        f"export const cursussen{stroom}: CursusRuw[] = [",
    ]
    for c in cursussen:
        L.append(
            f'  {{ id: "{c["id"]}", stroom: "{stroom}", '
            f'naam: "{esc(c["naam"])}", volgorde: {c["volgorde"]} }},'
        )
    L.append("];")
    L.append("")
    L.append(f"export const badges{stroom}: BadgeRuw[] = [")
    for d in badges:
        L.append(
            f'  {{ id: "{d["id"]}", cursusId: "{d["cursusId"]}", '
            f'groep: "{esc(d["groep"])}", omschrijving: "{esc(d["omschrijving"])}", '
            f'volgorde: {d["volgorde"]}, categorie: "standaard" }},'
        )
    L.append("];")
    L.append("")
    out.write_text("\n".join(L), encoding="utf-8")



if __name__ == "__main__":
    main()
