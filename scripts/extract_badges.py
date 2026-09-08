#!/usr/bin/env python3
"""
Genereer de badge- én deelbadge-data uit één bron:
`docs/reference/deelevaluaties_alle-graden-2.xlsx` (het "Minimalistisch Overzicht").

Vervangt `extract_badgeboeken.py` + `extract_deelevaluaties.py`: badges en deelbadge-types
komen nu uit hetzelfde bestand, zodat ze per definitie in sync zijn.

    python3 scripts/extract_badges.py

Structuur van het bestand: per tabblad (graad/stroom) rijen `Cursus | Type | Aantal |
Verplicht Aantal`. Elke rij wordt:
  - `Aantal` losse badges "<Type> <n>" (of "<Type>" als Aantal = 1), plat onder de cursus;
  - één deelbadge-type met `richtaantal` (= Aantal), `verplicht` (= Verplicht Aantal) en
    `leerdoelIds` (de badge-ids van die rij).

Uitvoer:
  - src/lib/curriculum{1A,1B,2A,3A}.ts  (Cursus -> 1 Rubric per cursus -> Leerdoel)
  - src/lib/deelevaluatieTypes.ts
"""
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "docs" / "reference" / "deelevaluaties_alle-graden-2.xlsx"
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


def main() -> None:
    z = zipfile.ZipFile(XLSX)
    ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
    strings = ["".join(t.text or "" for t in si.iter(M + "t")) for si in ss]
    rel = sheet_rel_map(z)

    type_entries = []  # voor deelevaluatieTypes.ts
    type_n = 0
    samenvatting = {}

    for sheet_name, stroom in SHEETS.items():
        cursussen = []          # [{id, naam}]
        cursus_id_van_naam = {}  # naam -> id
        rubrics = []            # [{id, cursusId, naam}]
        leerdoelen = []         # [{id, rubricId, omschrijving}]
        doel_teller = {}        # cursusId -> laatste d-index

        for cells in load_rows(z, rel[sheet_name], strings):
            cursus = cells.get(1, "")
            naam = cells.get(2, "")
            aantal = num(cells.get(3, ""))
            verplicht = num(cells.get(4, ""))
            if not cursus or not naam:
                continue
            low = cursus.lower()
            if low == "cursus" or low.startswith("totaal"):
                continue

            if cursus not in cursus_id_van_naam:
                cid = f"{stroom}-c{len(cursussen) + 1}"
                cursus_id_van_naam[cursus] = cid
                cursussen.append({"id": cid, "naam": cursus})
                rubrics.append({"id": f"{cid}-r1", "cursusId": cid, "naam": cursus})
                doel_teller[cid] = 0
            cid = cursus_id_van_naam[cursus]
            rid = f"{cid}-r1"

            hoeveel = max(1, aantal)
            rij_ids = []
            for i in range(1, hoeveel + 1):
                doel_teller[cid] += 1
                did = f"{rid}-d{doel_teller[cid]}"
                omschrijving = naam if hoeveel == 1 else f"{naam} {i}"
                leerdoelen.append(
                    {"id": did, "rubricId": rid, "omschrijving": omschrijving}
                )
                rij_ids.append(did)

            type_n += 1
            type_entries.append(
                {
                    "id": f"det-{stroom}-{type_n}",
                    "stroom": stroom,
                    "cursus": cursus,
                    "naam": naam,
                    "richtaantal": aantal,
                    "verplicht": verplicht,
                    "leerdoelIds": rij_ids,
                }
            )

        write_curriculum(stroom, cursussen, rubrics, leerdoelen)
        samenvatting[stroom] = {
            "cursussen": len(cursussen),
            "badges": len(leerdoelen),
        }

    write_types(type_entries)

    per_type = {}
    for e in type_entries:
        per_type[e["stroom"]] = per_type.get(e["stroom"], 0) + 1
    for stroom, s in samenvatting.items():
        print(
            f"  {stroom}: {s['cursussen']} cursussen, {s['badges']} badges, "
            f"{per_type[stroom]} deelbadge-types"
        )
    print(f"{len(type_entries)} types weggeschreven naar src/lib/deelevaluatieTypes.ts")


def write_curriculum(stroom, cursussen, rubrics, leerdoelen) -> None:
    out = LIB / f"curriculum{stroom}.ts"
    L = [
        "// AUTO-GEGENEREERD via scripts/extract_badges.py",
        "// uit docs/reference/deelevaluaties_alle-graden-2.xlsx — niet met de hand aanpassen.",
        'import type { Cursus, Leerdoel, Rubric } from "./types";',
        "",
        f"export const cursussen{stroom}: Cursus[] = [",
    ]
    for c in cursussen:
        L.append(
            f'  {{ id: "{c["id"]}", stroom: "{stroom}", naam: "{esc(c["naam"])}" }},'
        )
    L.append("];")
    L.append("")
    L.append(f"export const rubrics{stroom}: Rubric[] = [")
    for r in rubrics:
        L.append(
            f'  {{ id: "{r["id"]}", cursusId: "{r["cursusId"]}", naam: "{esc(r["naam"])}" }},'
        )
    L.append("];")
    L.append("")
    L.append(f"export const leerdoelen{stroom}: Leerdoel[] = [")
    for d in leerdoelen:
        L.append(
            f'  {{ id: "{d["id"]}", rubricId: "{d["rubricId"]}", '
            f'omschrijving: "{esc(d["omschrijving"])}", categorie: "standaard" }},'
        )
    L.append("];")
    L.append("")
    out.write_text("\n".join(L), encoding="utf-8")


def write_types(entries) -> None:
    out = LIB / "deelevaluatieTypes.ts"
    L = [
        "// AUTO-GEGENEREERD via scripts/extract_badges.py",
        "// uit docs/reference/deelevaluaties_alle-graden-2.xlsx — niet met de hand aanpassen.",
        'import type { Stroom } from "./types";',
        "",
        "/**",
        " * Een *type* deelbadge: per stroom en cursus, met het richtaantal en het verplichte",
        " * aantal dat een leerling moet halen. `leerdoelIds` = de badges die deze rij in de",
        " * badgematrix vertegenwoordigt (dezelfde bron). Leerkrachten maken hieronder in de app",
        " * hun concrete toetsen/opdrachten aan.",
        " */",
        "export interface DeelevaluatieType {",
        "  id: string;",
        "  stroom: Stroom;",
        "  cursus: string;",
        "  naam: string;",
        "  /** Richtaantal: hoeveel er in totaal kunnen worden aangeboden. */",
        "  richtaantal: number;",
        "  /** Verplicht aantal om de cursus af te ronden. */",
        "  verplicht: number;",
        "  /** De badge-ids (leerdoelen) die bij dit type horen. */",
        "  leerdoelIds: string[];",
        "}",
        "",
        "export const deelevaluatieTypes: DeelevaluatieType[] = [",
    ]
    for e in entries:
        ids = ", ".join(f'"{i}"' for i in e["leerdoelIds"])
        L.append(
            "  { "
            f'id: "{e["id"]}", stroom: "{e["stroom"]}", '
            f'cursus: "{esc(e["cursus"])}", naam: "{esc(e["naam"])}", '
            f'richtaantal: {e["richtaantal"]}, verplicht: {e["verplicht"]}, '
            f"leerdoelIds: [{ids}] "
            "},"
        )
    L.append("];")
    L.append("")
    out.write_text("\n".join(L), encoding="utf-8")


if __name__ == "__main__":
    main()
