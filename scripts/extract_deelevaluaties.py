#!/usr/bin/env python3
"""
Genereer src/lib/deelevaluatieTypes.ts uit docs/reference/deelevaluaties_alle-graden.xlsx.

Het bestand geeft per graad/stroom en per cursus de *types* deelevaluatie (deelbadge) met
hun richtaantal en verplicht aantal. Dit is de kapstok: leerkrachten maken hieronder in de
app hun concrete toetsen/opdrachten aan.

    python3 scripts/extract_deelevaluaties.py

Bij een nieuwe versie van het bestand: dit script opnieuw draaien.
"""
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "docs" / "reference" / "deelevaluaties_alle-graden.xlsx"
OUT = ROOT / "src" / "lib" / "deelevaluatieTypes.ts"

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


def main() -> None:
    z = zipfile.ZipFile(XLSX)
    ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
    strings = ["".join(t.text or "" for t in si.iter(M + "t")) for si in ss]
    rel = sheet_rel_map(z)

    entries = []
    n = 0
    for sheet_name, stroom in SHEETS.items():
        for cells in load_rows(z, rel[sheet_name], strings):
            cursus = cells.get(1, "")
            naam = cells.get(2, "")
            richt = cells.get(3, "")
            verplicht = cells.get(4, "")
            if not cursus or not naam:
                continue
            if cursus.lower().startswith("totaal") or cursus.lower() == "cursus":
                continue
            try:
                richt_n = int(float(richt)) if richt else 0
                verplicht_n = int(float(verplicht)) if verplicht else 0
            except ValueError:
                continue
            n += 1
            entries.append(
                {
                    "id": f"det-{stroom}-{n}",
                    "stroom": stroom,
                    "cursus": cursus,
                    "naam": naam,
                    "richtaantal": richt_n,
                    "verplicht": verplicht_n,
                }
            )

    lines = [
        "// AUTO-GEGENEREERD via scripts/extract_deelevaluaties.py",
        "// uit docs/reference/deelevaluaties_alle-graden.xlsx — niet met de hand aanpassen.",
        'import type { Stroom } from "./types";',
        "",
        "/**",
        " * Een *type* deelevaluatie (deelbadge): per stroom en cursus, met het richtaantal en",
        " * het verplichte aantal dat een leerling moet halen. Dit is de kapstok waaronder",
        " * leerkrachten in de app hun concrete toetsen/opdrachten aanmaken.",
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
        "}",
        "",
        f"export const deelevaluatieTypes: DeelevaluatieType[] = [",
    ]
    for e in entries:
        lines.append(
            "  { "
            f'id: "{e["id"]}", stroom: "{e["stroom"]}", '
            f'cursus: "{esc(e["cursus"])}", naam: "{esc(e["naam"])}", '
            f'richtaantal: {e["richtaantal"]}, verplicht: {e["verplicht"]} '
            "},"
        )
    lines.append("];")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    per = {}
    for e in entries:
        per[e["stroom"]] = per.get(e["stroom"], 0) + 1
    print(f"{len(entries)} types weggeschreven naar {OUT.relative_to(ROOT)}")
    print("  per stroom:", per)


if __name__ == "__main__":
    main()
