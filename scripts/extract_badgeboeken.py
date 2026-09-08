#!/usr/bin/env python3
"""
VERVANGEN door scripts/extract_badges.py — badges + deelbadge-types komen nu uit één bestand
(docs/reference/deelevaluaties_alle-graden-2.xlsx). Dit script en de Word-badgeboeken blijven
alleen als historische referentie bewaard; niet meer draaien.

Genereer src/lib/curriculum{1A,1B,2A,3A}.ts uit de Word-badgeboeken in docs/reference/.

Er bestaan geen CSV-versies van de badgeboeken; deze parser leest de .docx rechtstreeks.
De badgeboeken hebben geen strakke opmaak (geen stijlen, losse tabellen), dus dit is een
heuristische extractie. Bij een nieuwe badgeboekversie: dit script opnieuw draaien.

    python3 scripts/extract_badgeboeken.py

Structuur die eruit komt: Cursus -> Rubric -> Leerdoel (= badge), met optioneel
`kleuren` (de rubric-omschrijving per kleur) voor de kleurtabellen.
"""
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "docs" / "reference"
LIB = ROOT / "src" / "lib"

FILES = {
    "1A": "2025 Badgeboek 1ste graad A (versie 2025 09 23).docx",
    "1B": "2025 Badgeboek 1ste graad B (versie 2025 09 23).docx",
    "2A": "2025 Badgeboek 2de graad A (versie 2025 09 23).docx",
    "3A": "2025 Badgeboek 3de graad A (versie 2025 09).docx",
}

BOIL = ("sleutelcompetenties", "deze cursus is deel", "optie freinet")
LANG = {"nederlands", "frans", "engels", "nl", "fr", "en", "extra"}
JAAR = {f"{n}{s} jaar" for n in "123456" for s in ("e", "ste", "de")}
ALIAS = [("focusateliers", "ateliers")]
NUM = re.compile(r"^(\d+|extra)$", re.I)


def norm(s):
    return re.sub(r"\s+", " ", (s or "").replace("&", "en")).strip().lower()


def run_text(p):
    out = []
    for node in p.iter():
        tag = node.tag.split("}")[1]
        if tag == "t":
            out.append(node.text or "")
        elif tag in ("tab", "br"):
            out.append(" ")
    return re.sub(r"\s+", " ", "".join(out)).strip()


def is_bold(p):
    for r in p.findall(W + "r"):
        rpr, t = r.find(W + "rPr"), r.find(W + "t")
        if (
            rpr is not None
            and rpr.find(W + "b") is not None
            and t is not None
            and (t.text or "").strip()
            and rpr.find(W + "b").get(W + "val") not in ("0", "false")
        ):
            return True
    return False


def clean_rub(s):
    s = re.sub(r"^criteria\s+", "", s, flags=re.I).strip()
    s = re.split(r"\s*[:–]\s*van\b", s, flags=re.I)[0].strip().rstrip(":").strip()
    if re.match(r"als (voorzitter|secretaris|tijdsbewaker)$", s, re.I):
        return "Rollen"
    s = re.sub(r"^als\s+", "", s, flags=re.I).strip()
    return (s[:1].upper() + s[1:]) if s else s


def parse(path):
    body = ET.fromstring(zipfile.ZipFile(path).read("word/document.xml")).find(W + "body")
    blocks = []
    for ch in list(body):
        tag = ch.tag.split("}")[1]
        if tag == "p":
            t = run_text(ch)
            if t:
                blocks.append(("p", is_bold(ch), t))
        elif tag == "tbl":
            blocks.append(
                ("t", False, [[run_text(c) for c in tr.findall(W + "tc")] for tr in ch.findall(W + "tr")])
            )

    # inhoudstabel = eerste tabel waarvan de meeste rijen eindigen op een paginanummer
    names = []
    for kind, _b, v in blocks:
        if kind == "t" and len(v) >= 4 and sum(1 for r in v if r and r[-1].strip().isdigit()) >= max(3, len(v) // 2):
            for r in v:
                nm = r[0].strip()
                if nm and not nm.isdigit() and norm(nm) != "cursus" and not norm(nm).startswith("overzicht"):
                    names.append(nm)
            break
    cset = {norm(c): c for c in names}

    def match_cursus(n):
        if n in cset:
            return cset[n]
        for cn, orig in cset.items():
            if len(n) >= 4 and len(cn) >= 4 and (n.startswith(cn) or cn.startswith(n)):
                return orig
        for frag, inh in ALIAS:
            if frag in n and norm(inh) in cset:
                return cset[norm(inh)]
        return None

    cursussen, order = {}, []
    st = {"cur": None, "rub": None, "sect": None}

    def cursus(nm):
        k = norm(nm)
        if k not in cursussen:
            cursussen[k] = {"naam": nm, "kerndoelen": [], "rubrieken": {}, "ro": []}
            order.append(k)
        return cursussen[k]

    def rub(nm):
        c = st["cur"]
        if not c:
            return
        nm = clean_rub(nm) or c["naam"]
        k = norm(nm)
        if k not in c["rubrieken"]:
            c["rubrieken"][k] = {"naam": nm, "leerdoelen": []}
            c["ro"].append(k)
        st["rub"] = c["rubrieken"][k]

    def add(txt, kl=None):
        if st["rub"] is None:
            rub(st["sect"] or (st["cur"]["naam"] if st["cur"] else "Badges"))
        txt = txt.strip()
        if not txt:
            return
        if NUM.match(txt):
            txt = f"{st['rub']['naam']} {txt}"
        if any(x["tekst"] == txt for x in st["rub"]["leerdoelen"]):
            return
        d = {"tekst": txt}
        if kl:
            d["kleuren"] = kl
        st["rub"]["leerdoelen"].append(d)

    i, started = 0, False
    while i < len(blocks):
        kind, b, v = blocks[i]
        if kind == "p":
            n = norm(v)
            hit = match_cursus(n) if len(v) < 60 else None
            if hit:
                st.update(cur=cursus(hit), rub=None, sect=None)
                started = True
                i += 1
                continue
            if not started:
                i += 1
                continue
            if n.startswith("sleutelcompetenties"):
                i += 1
                while i < len(blocks) and not (
                    blocks[i][0] == "p" and norm(blocks[i][2]).startswith(("kerndoelen", "criteria"))
                ) and blocks[i][0] != "t":
                    i += 1
                continue
            if n.startswith("kerndoelen"):
                i += 1
                while i < len(blocks) and blocks[i][0] == "p" and not norm(blocks[i][2]).startswith(
                    ("criteria", "kerndoelen")
                ):
                    st["cur"]["kerndoelen"].append(blocks[i][2].lstrip("- ").strip())
                    i += 1
                continue
            if n.startswith("criteria"):
                st["sect"] = None
                i += 1
                continue
            if n.startswith(BOIL):
                i += 1
                continue
            if b and st["cur"] and len(v) < 90:
                st["sect"] = v.strip()
            i += 1
            continue

        rows = v
        if not rows:
            i += 1
            continue
        h0 = [c.lower() for c in rows[0]]
        h1 = [c.lower() for c in rows[1]] if len(rows) > 1 else []
        flat = " | ".join(h0) + " || " + " | ".join(h1)

        # kleurtabel: criterium <-> beschrijving per kleur
        if len(rows[0]) >= 4 and h0[:4] == ["blauw", "groen", "geel", "rood"]:
            j, crit = i - 1, []
            while (
                j >= 0
                and blocks[j][0] == "p"
                and not norm(blocks[j][2]).startswith(("kerndoelen", "criteria", "sleutel"))
                and not (blocks[j][1] and norm(blocks[j][2]).startswith("als "))
            ):
                crit.insert(0, blocks[j][2])
                j -= 1
            rn, jj = None, i - 1
            while jj >= 0:
                bj = blocks[jj]
                if bj[0] == "t" and bj[2] and bj[2][0] and bj[2][0][0].strip() and norm(bj[2][0][0]) != "blauw":
                    rn = bj[2][0][0].strip()
                    break
                if bj[0] == "p" and bj[1] and len(bj[2]) < 90 and not norm(bj[2]).startswith(
                    BOIL + ("kerndoelen", "criteria")
                ):
                    rn = bj[2].strip()
                    break
                jj -= 1
            if st["rub"] is None or (rn and norm(st["rub"]["naam"]) != norm(clean_rub(rn))):
                rub(rn or "Rubric")
            desc = rows[1:]
            for idx, ct in enumerate(crit):
                kl = None
                if idx < len(desc) and len(desc[idx]) >= 4:
                    dd = desc[idx]
                    kl = {"blauw": dd[0], "groen": dd[1], "geel": dd[2], "rood": dd[3]}
                add(ct, kl)
            i += 1
            continue

        # deelstapjes-/badge-/coaching-tabellen
        deel = (
            "badge behaald" in flat
            or "coaching 1" in flat
            or "rapport 1" in flat
            or (i > 0 and blocks[i - 1][0] == "p" and norm(blocks[i - 1][2]).startswith("criteria"))
            or (i > 0 and blocks[i - 1][0] == "p" and blocks[i - 1][1] and norm(blocks[i - 1][2]).startswith("als "))
        )
        if deel:
            first = rows[0][0].strip()
            rn = None
            if first and "badge behaald" not in first.lower() and norm(first) not in JAAR | {"", "reeks", "domein", "units"}:
                rn = first
            rn = rn or st["sect"]
            if not rn:
                jj = i - 1
                while jj >= 0:
                    if blocks[jj][0] == "p" and norm(blocks[jj][2]).startswith("criteria"):
                        rn = blocks[jj][2]
                        break
                    if blocks[jj][0] == "p" and blocks[jj][1] and len(blocks[jj][2]) < 90 and not norm(
                        blocks[jj][2]
                    ).startswith(BOIL):
                        rn = blocks[jj][2]
                        break
                    jj -= 1
            if st["rub"] is None or (rn and norm(st["rub"]["naam"]) != norm(clean_rub(rn or ""))):
                rub(rn or "Criteria")
            prefix = ""
            for r in rows[1:]:
                if not r:
                    continue
                c0 = r[0].strip()
                c1 = r[1].strip() if len(r) > 1 else ""
                if norm(c0) in LANG:
                    prefix = c0 + " "
                    continue
                if not c0 and c1 and norm(c1) not in JAAR:
                    add(prefix + c1 if prefix else c1)
                    continue
                if c0 and norm(c0) not in JAAR:
                    add(prefix + c0 if (prefix and NUM.match(c0)) else c0)
            i += 1
            continue
        i += 1

    res = []
    for k in order:
        c = cursussen[k]
        rubs = [c["rubrieken"][rk] for rk in c["ro"] if c["rubrieken"][rk]["leerdoelen"]]
        if rubs:
            res.append({"naam": c["naam"], "rubrieken": rubs})
    return res


DOMEIN_ITEM = re.compile(r"^\d+\.\d+\b")


def groepeer_domeinen(cursussen):
    """In een rubriek met items als '1.2 …', '2.3 …' (Levende Wiskunde › Inzicht …) hoort een
    reeks genummerde items bij het domein (Getallenleer, Meetkunde, …) dat er net boven staat.
    De domeinnaam wordt de `subgroep` (een uitklapbaar submenu) en verdwijnt als aparte badge.
    Een domeinnaam zonder genummerde items eronder (Statistiek, Verzamelingenleer, Logica)
    blijft een gewone badge, los onder de rubriek."""
    for c in cursussen:
        for r in c["rubrieken"]:
            lds = r["leerdoelen"]
            if not any(DOMEIN_ITEM.match(x["tekst"]) for x in lds):
                continue
            nieuw = []
            subgroep = None
            for idx, x in enumerate(lds):
                if DOMEIN_ITEM.match(x["tekst"]):
                    if subgroep:
                        x["subgroep"] = subgroep
                    nieuw.append(x)
                    continue
                volgende = lds[idx + 1]["tekst"] if idx + 1 < len(lds) else ""
                if DOMEIN_ITEM.match(volgende):
                    subgroep = x["tekst"]  # enkel de submenunaam, geen eigen badge
                else:
                    subgroep = None
                    nieuw.append(x)
            r["leerdoelen"] = nieuw
    return cursussen


def esc(s):
    return (s or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").replace("\r", " ").strip()


def generate(stroom, cursussen):
    out = [
        f'// AUTO-GEGENEREERD via scripts/extract_badgeboeken.py uit "2025 Badgeboek … ({stroom})".',
        "// Niet met de hand herschikken; regenereer bij een nieuwe badgeboekversie.",
        'import type { Cursus, Leerdoel, Rubric } from "./types";',
        "",
        f"export const cursussen{stroom}: Cursus[] = [",
    ]
    cl, rl, ll = [], [], []
    for ci, c in enumerate(cursussen, 1):
        cid = f"{stroom}-c{ci}"
        cl.append(f'  {{ id: "{cid}", stroom: "{stroom}", naam: "{esc(c["naam"])}" }},')
        for ri, r in enumerate(c["rubrieken"], 1):
            rid = f"{cid}-r{ri}"
            rl.append(f'  {{ id: "{rid}", cursusId: "{cid}", naam: "{esc(r["naam"])}" }},')
            for di, ld in enumerate(r["leerdoelen"], 1):
                parts = [
                    f'id: "{rid}-d{di}"',
                    f'rubricId: "{rid}"',
                    f'omschrijving: "{esc(ld["tekst"])}"',
                    'categorie: "standaard"',
                ]
                if ld.get("kleuren"):
                    k = ld["kleuren"]
                    parts.append(
                        'kleuren: { blauw: "%s", groen: "%s", geel: "%s", rood: "%s" }'
                        % (esc(k["blauw"]), esc(k["groen"]), esc(k["geel"]), esc(k["rood"]))
                    )
                if ld.get("subgroep"):
                    parts.append(f'subgroep: "{esc(ld["subgroep"])}"')
                ll.append("  { " + ", ".join(parts) + " },")
    out += cl + ["];", "", f"export const rubrics{stroom}: Rubric[] = ["] + rl
    out += ["];", "", f"export const leerdoelen{stroom}: Leerdoel[] = ["] + ll + ["];", ""]
    (LIB / f"curriculum{stroom}.ts").write_text("\n".join(out))
    return len(cl), len(rl), len(ll)


if __name__ == "__main__":
    for stroom, fn in FILES.items():
        cursussen = groepeer_domeinen(parse(REF / fn))
        nc, nr, nl = generate(stroom, cursussen)
        print(f"curriculum{stroom}.ts: {nc} cursussen / {nr} rubrieken / {nl} badges")
