#!/usr/bin/env python3
"""
Genereer src/lib/rubriekenData.ts uit docs/reference/rubrics_overzicht.xlsx.

Het bestand bundelt per cursus en stroom de rubrics met:
  - de volledige naam van de rubric
  - de doelcodes die eronder vallen
  - de omschrijving per kleur (blauw / groen / geel / rood)
  - een tekst over de leerlijn (waar komt de leerling vandaan, waar gaat het naartoe)

Nog niet alle cursussen staan in het bestand — dit script draait gewoon over wat er is.
Bij een nieuwe versie van het bestand: dit script opnieuw draaien.

    python3 scripts/extract_rubrics.py
"""
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "docs" / "reference" / "rubrics_overzicht.xlsx"
OUT = ROOT / "src" / "lib" / "rubriekenData.ts"

# De "Graad"-kolom bevat eigenlijk de stroomcode.
GELDIGE_STROMEN = {"1A", "1B", "2A", "3A"}


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


def split_doelen(ruw: str) -> list[str]:
    return [d.strip() for d in ruw.replace(";", ",").split(",") if d.strip()]


def main() -> None:
    z = zipfile.ZipFile(XLSX)
    ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
    strings = ["".join(t.text or "" for t in si.iter(M + "t")) for si in ss]
    rel = sheet_rel_map(z)
    sheet_path = next(iter(rel.values()))  # één tabblad

    entries = []
    per_stroom: dict[str, int] = {}
    for cells in load_rows(z, sheet_path, strings):
        cursus = cells.get(1, "")
        stroom = cells.get(2, "").upper()
        naam = cells.get(3, "")
        if stroom not in GELDIGE_STROMEN or not cursus or not naam:
            continue
        per_stroom[stroom] = per_stroom.get(stroom, 0) + 1
        entries.append(
            {
                "id": f"rbr-{stroom}-{per_stroom[stroom]}",
                "cursus": cursus,
                "stroom": stroom,
                "naam": naam,
                "doelen": split_doelen(cells.get(4, "")),
                "criteria": {
                    "blauw": cells.get(5, ""),
                    "groen": cells.get(6, ""),
                    "geel": cells.get(7, ""),
                    "rood": cells.get(8, ""),
                },
                "leerlijn": cells.get(9, ""),
            }
        )

    lines = [
        "// AUTO-GEGENEREERD via scripts/extract_rubrics.py",
        "// uit docs/reference/rubrics_overzicht.xlsx — niet met de hand aanpassen.",
        'import type { Rubriek } from "./types";',
        "",
        "export const rubrieken: Rubriek[] = [",
    ]
    for e in entries:
        lines.append("  {")
        lines.append(f'    id: {json.dumps(e["id"])},')
        lines.append(f'    cursus: {json.dumps(e["cursus"], ensure_ascii=False)},')
        lines.append(f'    stroom: {json.dumps(e["stroom"])},')
        lines.append(f'    naam: {json.dumps(e["naam"], ensure_ascii=False)},')
        lines.append(f'    doelen: {json.dumps(e["doelen"], ensure_ascii=False)},')
        lines.append("    criteria: {")
        for kleur in ("blauw", "groen", "geel", "rood"):
            lines.append(f'      {kleur}: {json.dumps(e["criteria"][kleur], ensure_ascii=False)},')
        lines.append("    },")
        lines.append(f'    leerlijn: {json.dumps(e["leerlijn"], ensure_ascii=False)},')
        lines.append("  },")
    lines.append("];")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"{len(entries)} rubrieken weggeschreven naar {OUT.relative_to(ROOT)}")
    print("  per stroom:", per_stroom)
    print("  cursussen:", sorted({e["cursus"] for e in entries}))


if __name__ == "__main__":
    main()
