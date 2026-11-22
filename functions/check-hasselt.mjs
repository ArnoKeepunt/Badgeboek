// Alleen-lezen diagnose: zoekt Hasselt-data die de Firestore-regels voor een MENTOR weigeren
// (een beheerder/coördinator mag elke vestiging schrijven en merkt er dus niets van).
// Schrijft NIETS naar de database.
//
// Gebruik (vanuit de map functions/):
//   gcloud auth application-default login        (eenmalig)
//   node check-hasselt.mjs                          (of: node check-hasselt.mjs 2026-2027)
// Of met een service-account-sleutel:
//   GOOGLE_APPLICATION_CREDENTIALS=/pad/naar/sleutel.json node check-hasselt.mjs

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT = "badgeboek";
const DATABASE = "ai-studio-badgeboek-af2ee9df-cd5d-4667-a2f9-b3c45c821be9";
const HUIDIG = process.argv[2] ?? "2026-2027";
const AFGESLOTEN = ["2024-2025"]; // spiegelt afgeslotenJaren() in firestore.rules
const DOEL = "Hasselt";

const db = getFirestore(
  initializeApp({ credential: applicationDefault(), projectId: PROJECT }),
  DATABASE,
);

const toon = (v) => (v === undefined ? "(ontbreekt)" : JSON.stringify(v));
const norm = (v) =>
  typeof v === "string"
    ? v.normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
    : "";
const lijkt = (v) => norm(v).includes(norm(DOEL));

let problemen = 0;
const meld = (tekst) => {
  problemen++;
  console.log("  ✗ " + tekst);
};
const kop = (t) => console.log(`\n=== ${t} ===`);

const lees = async (pad) => {
  const snap = await db.collection(pad).get();
  return new Map(snap.docs.map((d) => [d.id, d.data()]));
};

const [vestigingen, gebruikers, leerlingen, deelbadges, rapporten, evaluaties] = await Promise.all([
  lees("vestigingen"),
  lees("gebruikers"),
  lees("leerlingen"),
  lees("deelbadges"),
  lees("rapporten"),
  lees(`evaluaties/${HUIDIG}/leerlingen`),
]);

// 1. De vestigingenlijst zelf
kop("Vestigingen-collectie");
const geldigeNamen = new Set();
for (const [id, v] of vestigingen) {
  geldigeNamen.add(v.naam);
  if (lijkt(v.naam) || lijkt(id)) {
    console.log(`  vestigingen/${id}: naam=${toon(v.naam)} actief=${toon(v.actief)}`);
    if (v.naam !== DOEL) meld(`naam is niet exact ${toon(DOEL)}`);
  }
}
if (vestigingen.size === 0) {
  console.log("  (leeg — de app gebruikt dan de ingebouwde lijst)");
  geldigeNamen.add(DOEL);
}

// 2. Alle `vestiging`-waarden die op Hasselt lijken maar niet exact "Hasselt" zijn
kop(`Vestiging-waarden die op ${DOEL} lijken`);
const tel = new Map();
const telOp = (bron, v) => {
  const k = `${bron} ${toon(v)}`;
  tel.set(k, (tel.get(k) ?? 0) + 1);
};
for (const [, d] of leerlingen) if (lijkt(d.vestiging) || typeof d.vestiging !== "string") telOp("leerlingen", d.vestiging);
for (const [, d] of deelbadges) if (lijkt(d.vestiging)) telOp("deelbadges", d.vestiging);
for (const [, d] of rapporten) if (lijkt(d.vestiging)) telOp("rapporten", d.vestiging);
for (const [, d] of evaluaties) if (lijkt(d.vestiging)) telOp(`evaluaties/${HUIDIG}`, d.vestiging);
for (const [k, n] of tel) {
  console.log(`  ${k}: ${n}×`);
  if (!k.endsWith(toon(DOEL))) meld(`${k} — wijkt af van ${toon(DOEL)} (spatie/hoofdletter/type?)`);
}

// 3. Personeel met Hasselt
kop(`Personeel met ${DOEL}`);
for (const [id, g] of gebruikers) {
  const lijst = Array.isArray(g.vestigingen) ? g.vestigingen : g.vestiging ? [g.vestiging] : [];
  if (!lijst.some(lijkt)) continue;
  console.log(`  ${id}: rol=${toon(g.rol)} actief=${toon(g.actief)} vestigingen=${toon(lijst)}`);
  for (const v of lijst) if (lijkt(v) && v !== DOEL) meld(`${id} heeft ${toon(v)} i.p.v. ${toon(DOEL)}`);
}

// 4. Hasselt-leerlingen
kop(`Leerlingen in ${DOEL}`);
const hasseltIds = new Set();
for (const [id, d] of leerlingen) {
  if (!lijkt(d.vestiging)) continue;
  hasseltIds.add(id);
  if (!/^\d+$/.test(id)) meld(`leerlingen/${id}: id is geen nummer (een ":" of spatie breekt de sleutels in de app)`);
}
console.log(`  ${hasseltIds.size} leerling(en)`);

// 5. Evaluaties van het huidige jaar
kop(`Evaluaties ${HUIDIG}`);
for (const [id, d] of evaluaties) {
  const l = leerlingen.get(id);
  if (!lijkt(d.vestiging) && !hasseltIds.has(id)) continue;
  if (!l) meld(`evaluaties/${HUIDIG}/leerlingen/${id}: vestiging=${toon(d.vestiging)}, maar de leerling bestaat niet (meer)`);
  else if (d.vestiging !== l.vestiging)
    meld(`evaluaties/${HUIDIG}/leerlingen/${id}: vestiging=${toon(d.vestiging)} ≠ leerling ${toon(l.vestiging)}`);
}

// 6. Rapporten
kop("Rapporten");
for (const [id, d] of rapporten) {
  const l = leerlingen.get(d.studentId);
  if (!lijkt(d.vestiging) && !hasseltIds.has(d.studentId)) continue;
  if (!l) meld(`rapporten/${id}: leerling ${toon(d.studentId)} bestaat niet (meer), vestiging=${toon(d.vestiging)}`);
  else if (d.vestiging !== l.vestiging)
    meld(`rapporten/${id}: vestiging=${toon(d.vestiging)} ≠ leerling ${toon(l.vestiging)} (status ${toon(d.status)})`);
}

// 7. Deelbadges
kop("Deelbadges");
for (const [id, d] of deelbadges) {
  const scoreIds = Object.keys(d.scores ?? {});
  const raaktHasselt = lijkt(d.vestiging) || scoreIds.some((s) => hasseltIds.has(s));
  if (!raaktHasselt) continue;
  const sj = d.schooljaar;
  if (lijkt(d.vestiging) && AFGESLOTEN.includes(sj))
    meld(`deelbadges/${id} (${toon(d.titel)}): afgesloten schooljaar ${toon(sj)} — elke wijziging wordt geweigerd`);
  if (sj !== undefined && typeof sj !== "string") meld(`deelbadges/${id}: schooljaar heeft type ${typeof sj}`);
  if (d.vestiging === "" && scoreIds.some((s) => hasseltIds.has(s)))
    meld(`deelbadges/${id} (${toon(d.titel)}): overkoepelend (vestiging "") met scores van Hasselt-leerlingen — mentor mag dit niet schrijven`);
  const vreemd = scoreIds.filter((s) => lijkt(d.vestiging) && leerlingen.get(s) && !lijkt(leerlingen.get(s).vestiging));
  if (vreemd.length) console.log(`  · deelbadges/${id}: scores van ${vreemd.length} leerling(en) buiten ${DOEL} (info)`);
}

kop("Samenvatting");
console.log(problemen === 0 ? "  Niets verdachts gevonden." : `  ${problemen} verdacht(e) punt(en) — zie ✗ hierboven.`);
process.exit(0);
