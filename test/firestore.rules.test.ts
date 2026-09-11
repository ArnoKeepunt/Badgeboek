/**
 * Firestore-regels: uitvoerbare versie van `security_spec.md` §3 ("Payloads designed to fail")
 * plus de tegenhanger — de dingen die wél moeten lukken.
 *
 * Draaien: `npm run test:rules` (start de Firestore-emulator errond via `firebase emulators:exec`;
 * vergt een Java-runtime). Of: start zelf `firebase emulators:start --only firestore` en run `npm test`.
 *
 * De test-context geeft een **compat** Firestore terug (`db.doc(...)`, `db.collection(...)`),
 * niet de modulaire `firebase/firestore`-API.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

type Firestore = ReturnType<RulesTestContext["firestore"]>;

const BOOTSTRAP = "arno.boriau@keerpuntscholen.be";
const JAAR = "2026-2027"; // open
const OUD = "2024-2025"; // afgesloten (AFGESLOTEN_SCHOOLJAREN)

let testEnv: RulesTestEnvironment;

// De personas — elk een geverifieerd Google-account met (of zonder) een `gebruikers`-doc.
let beheerder: Firestore;
let coordinator: Firestore;
let mentor: Firestore; // vestigingen: ["Gent"]
let mentor2: Firestore; // vestigingen: ["Gent", "Oudenaarde"]
let inactief: Firestore;
let bootstrap: Firestore;
let geenAccount: Firestore;
let onbevestigd: Firestore;
let anoniem: Firestore;

function emulatorHost(): { host: string; port: number } {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
  return { host, port: Number(port) };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-keerpunt",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), ...emulatorHost() },
  });

  const ctx = (uid: string, email: string, verified = true): Firestore =>
    testEnv.authenticatedContext(uid, { email, email_verified: verified }).firestore();

  beheerder = ctx("beheerder", "beheerder@keerpuntscholen.be");
  coordinator = ctx("coord", "coord@keerpuntscholen.be");
  mentor = ctx("mentor", "mentor@keerpuntscholen.be");
  mentor2 = ctx("mentor2", "mentor2@keerpuntscholen.be");
  inactief = ctx("inactief", "inactief@keerpuntscholen.be");
  bootstrap = ctx("bootstrap", BOOTSTRAP);
  geenAccount = ctx("nieuw", "nieuw@keerpuntscholen.be");
  onbevestigd = ctx("onbevestigd", "mentor@keerpuntscholen.be", false);
  anoniem = testEnv.unauthenticatedContext().firestore();
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      db.doc("gebruikers/beheerder@keerpuntscholen.be").set({
        email: "beheerder@keerpuntscholen.be", naam: "Bea", rol: "beheerder", actief: true, vestigingen: [],
      }),
      db.doc("gebruikers/coord@keerpuntscholen.be").set({
        email: "coord@keerpuntscholen.be", naam: "Coos", rol: "coordinator", actief: true, vestigingen: [],
      }),
      db.doc("gebruikers/mentor@keerpuntscholen.be").set({
        email: "mentor@keerpuntscholen.be", naam: "Mien", rol: "mentor", actief: true, vestigingen: ["Gent"],
      }),
      db.doc("gebruikers/mentor2@keerpuntscholen.be").set({
        email: "mentor2@keerpuntscholen.be", naam: "Moos", rol: "mentor", actief: true, vestigingen: ["Gent", "Oudenaarde"],
      }),
      db.doc("gebruikers/inactief@keerpuntscholen.be").set({
        email: "inactief@keerpuntscholen.be", naam: "Ina", rol: "mentor", actief: false, vestigingen: ["Gent"],
      }),
      db.doc("leerlingen/ll-gent").set({ naam: "Leerling", vestiging: "Gent" }),
      db.doc("leerlingen/ll-molenbeek").set({ naam: "Ander", vestiging: "Molenbeek" }),
      db.doc("mentoren/m-1").set({ naam: "Demo mentor", vestiging: "Gent" }),
      db.doc("groepen/g-1").set({ naam: "Groep", leerlingIds: [] }),
      db.doc("meldingen/ll-gent").set({ meldingen: [], gezienOp: null }),
      db.doc(`evaluaties/${JAAR}/leerlingen/ll-gent`).set({ kleuren: {}, notities: {}, gewist: [], auditLog: {}, vestiging: "Gent" }),
      db.doc(`evaluaties/${JAAR}/leerlingen/ll-molenbeek`).set({ kleuren: {}, notities: {}, gewist: [], auditLog: {}, vestiging: "Molenbeek" }),
      db.doc(`evaluaties/${OUD}/leerlingen/ll-gent`).set({ kleuren: {}, notities: {}, gewist: [], auditLog: {}, vestiging: "Gent" }),
      db.doc(`evaluaties/${OUD}/leerlingen/ll-nietgemigreerd`).set({ kleuren: {}, notities: {}, gewist: [], auditLog: {} }),
      db.doc("deelbadges/de-nu").set({ titel: "Toets", schooljaar: JAAR, scores: {}, vestiging: "Gent" }),
      db.doc("deelbadges/de-molenbeek").set({ titel: "MB", schooljaar: JAAR, scores: {}, vestiging: "Molenbeek" }),
      db.doc("deelbadges/de-overkoepelend").set({ titel: "Alle", schooljaar: JAAR, scores: {}, vestiging: "" }),
      db.doc("deelbadges/de-oud").set({ titel: "Oude toets", schooljaar: OUD, scores: {}, vestiging: "Gent" }),
      db.doc("curriculum/1A").set({}),
      db.doc("curriculum/1A/cursussen/c1").set({ naam: "Cursus", volgorde: 0 }),
      db.doc("curriculum/1A/cursussen/c1/badges/b1").set({
        groep: "g", omschrijving: "o", volgorde: 0, categorie: "standaard",
      }),
      db.doc("instellingen/app").set({ schooljaar: JAAR, matrixStromen: [], matrixCursus: "" }),
      db.doc("instellingen/overlays").set({ doelWijzigingen: {}, doelenImport: null, rubriekWijzigingen: {} }),
      db.doc("vestigingen/gent").set({ naam: "Gent", actief: true, volgorde: 0 }),
      // Rubrieken: zelfde structuur als curriculum/1A/cursussen/c1 (cursus-id's komen overeen).
      db.doc("rubrieken/1A").set({}),
      db.doc("rubrieken/1A/cursussen/c1").set({ naam: "Cursus", volgorde: 0 }),
      db.doc("rubrieken/1A/cursussen/c1/lijst/c1-r1").set({
        naam: "Rubric", doelen: [], criteria: { blauw: "", groen: "", geel: "", rood: "" }, leerlijn: "", volgorde: 0,
      }),
      db.doc("badgeboek/_globaal").set({ legacy: true }),
      db.doc("test/oud").set({ legacy: true }),
    ]);
  });
});

// --- §3.1 / §3.2 — niet aangemeld of niet geverifieerd -------------------------
describe("niet aangemeld / niet geverifieerd", () => {
  it("anoniem mag niets lezen of schrijven", async () => {
    await assertFails(anoniem.doc("leerlingen/ll-gent").get());
    await assertFails(anoniem.doc("leerlingen/ll-nieuw").set({ naam: "X" }));
    await assertFails(anoniem.collection("gebruikers").get());
    await assertFails(anoniem.doc(`evaluaties/${JAAR}/leerlingen/ll-gent`).get());
  });

  it("email_verified:false telt niet als personeel, ook mét een gebruikers-doc", async () => {
    await assertFails(onbevestigd.doc("leerlingen/ll-gent").get());
    await assertFails(onbevestigd.doc(`evaluaties/${JAAR}/leerlingen/ll-gent`).update({ kleuren: {} }));
  });
});

// --- §3.3 / §3.4 / §3.8 — geverifieerd maar geen (actief) account -------------
describe("geen actief personeelsaccount", () => {
  it("een geverifieerd account zonder gebruikers-doc mag geen data lezen", async () => {
    await assertFails(geenAccount.doc("leerlingen/ll-gent").get());
    await assertFails(geenAccount.doc(`evaluaties/${JAAR}/leerlingen/ll-gent`).get());
    await assertFails(geenAccount.collection("gebruikers").get());
  });

  it("mag wél zijn eigen gebruikers-doc lezen (voor de toegangspoort), niet dat van een ander", async () => {
    await assertSucceeds(geenAccount.doc("gebruikers/nieuw@keerpuntscholen.be").get());
    await assertFails(geenAccount.doc("gebruikers/mentor@keerpuntscholen.be").get());
  });

  it("een account met actief:false wordt overal geweigerd", async () => {
    await assertFails(inactief.doc("leerlingen/ll-gent").get());
    await assertFails(inactief.doc(`evaluaties/${JAAR}/leerlingen/ll-gent`).get());
    await assertFails(inactief.doc("badgeboek/_globaal").get());
  });
});

// --- Personeel: de dingen die moeten lukken ----------------------------------
describe("actief personeel — toegestaan", () => {
  it("mentor leest en schrijft binnen de eigen vestiging + het personeel-brede roster", async () => {
    await assertSucceeds(mentor.doc("leerlingen/ll-gent").get());
    await assertSucceeds(mentor.doc("leerlingen/ll-nieuw").set({ naam: "Nieuw", vestiging: "Gent" }));
    await assertSucceeds(mentor.collection("leerlingen").where("vestiging", "in", ["Gent"]).get());
    await assertSucceeds(
      mentor.doc(`evaluaties/${JAAR}/leerlingen/ll-gent`).set({ kleuren: { b1: "green" } }, { merge: true }),
    );
    await assertSucceeds(mentor.doc("groepen/g-2").set({ naam: "Nieuw", leerlingIds: [] }));
    await assertSucceeds(mentor.doc("meldingen/ll-gent").update({ gezienOp: 1 }));
    await assertSucceeds(mentor.collection("mentoren").get());
  });

  it("mentor leest het curriculum (incl. collectionGroup) maar schrijft het niet", async () => {
    await assertSucceeds(mentor.doc("curriculum/1A/cursussen/c1/badges/b1").get());
    await assertSucceeds(mentor.collectionGroup("badges").get());
    await assertSucceeds(mentor.collectionGroup("cursussen").get());
  });

  it("instellingen/app rijdt mee in de app-save en is personeel-schrijfbaar", async () => {
    await assertSucceeds(mentor.doc("instellingen/app").set({ schooljaar: JAAR }, { merge: true }));
    await assertSucceeds(coordinator.doc("instellingen/app").update({ matrixCursus: "x" }));
  });

  it("instellingen/overlays (doel-/rubriekwijzigingen) is beheerder-only", async () => {
    await assertSucceeds(mentor.doc("instellingen/overlays").get());
    await assertFails(
      mentor.doc("instellingen/overlays").set({ doelWijzigingen: { x: {} } }, { merge: true }),
    );
    await assertFails(mentor.doc("instellingen/overlays").update({ rubriekWijzigingen: { y: {} } }));
    await assertFails(coordinator.doc("instellingen/overlays").set({ doelenImport: [] }, { merge: true }));
    await assertSucceeds(
      beheerder.doc("instellingen/overlays").set(
        { doelWijzigingen: { d1: { titel: "x" } }, doelenImport: null, rubriekWijzigingen: {} },
      ),
    );
  });

  it("iedereen van het personeel leest vestigingen en rubrieken (incl. collectionGroup)", async () => {
    await assertSucceeds(mentor.collection("vestigingen").get());
    await assertSucceeds(coordinator.collection("rubrieken").get());
    await assertSucceeds(mentor.doc("rubrieken/1A/cursussen/c1/lijst/c1-r1").get());
    await assertSucceeds(mentor.collectionGroup("lijst").get());
  });
});

// --- §3.5 — curriculum is beheerder-only ------------------------------------
describe("curriculum — alleen de beheerder schrijft", () => {
  const badge = "curriculum/1A/cursussen/c1/badges/b1";

  it("mentor en coördinator mogen niet schrijven", async () => {
    await assertFails(mentor.doc(badge).set({ omschrijving: "gehackt" }, { merge: true }));
    await assertFails(coordinator.doc(badge).set({ omschrijving: "gehackt" }, { merge: true }));
    await assertFails(mentor.doc("curriculum/1A/cursussen/c1").update({ naam: "x" }));
    await assertFails(mentor.doc("curriculum/1A").set({ x: 1 }));
  });

  it("de beheerder en de bootstrap-admin mogen wel", async () => {
    await assertSucceeds(beheerder.doc(badge).set({ omschrijving: "ok" }, { merge: true }));
    await assertSucceeds(bootstrap.doc("curriculum/1A/cursussen/c2").set({ naam: "Nieuw", volgorde: 1 }));
  });
});

// --- §3.6 / §3.7 — /gebruikers ---------------------------------------------
describe("/gebruikers — beheer + shape", () => {
  it("een mentor kan geen account aanmaken of zijn eigen rol opblazen", async () => {
    await assertFails(
      mentor.doc("gebruikers/mentor@keerpuntscholen.be").set(
        { email: "mentor@keerpuntscholen.be", naam: "Mien", rol: "beheerder", actief: true, vestigingen: [] },
      ),
    );
    await assertFails(
      mentor.doc("gebruikers/vriend@keerpuntscholen.be").set(
        { email: "vriend@keerpuntscholen.be", naam: "V", rol: "mentor", actief: true, vestigingen: ["Gent"] },
      ),
    );
    await assertFails(mentor.collection("gebruikers").get());
  });

  it("de beheerder maakt een geldig account aan, en de lijst is leesbaar", async () => {
    await assertSucceeds(
      beheerder.doc("gebruikers/nieuwe@keerpuntscholen.be").set({
        email: "nieuwe@keerpuntscholen.be", naam: "Nieuw", rol: "mentor", actief: true, vestigingen: ["Gent", "Oudenaarde"],
      }),
    );
    await assertSucceeds(beheerder.collection("gebruikers").get());
    await assertSucceeds(beheerder.doc("gebruikers/mentor@keerpuntscholen.be").delete());
  });

  it("het oude `vestiging`-stringveld blijft toegelaten tijdens de overgang", async () => {
    await assertSucceeds(
      beheerder.doc("gebruikers/oud@keerpuntscholen.be").set({
        email: "oud@keerpuntscholen.be", naam: "Oud", rol: "mentor", actief: true, vestiging: "Gent", vestigingen: ["Gent"],
      }),
    );
  });

  it("weigert een fout gevormd account", async () => {
    const basis = { email: "x@keerpuntscholen.be", naam: "X", rol: "mentor", actief: true, vestigingen: [] };
    await assertFails(beheerder.doc("gebruikers/x@keerpuntscholen.be").set({ ...basis, wachtwoord: "geheim" }));
    await assertFails(beheerder.doc("gebruikers/x@keerpuntscholen.be").set({ ...basis, rol: "root" }));
    await assertFails(beheerder.doc("gebruikers/x@keerpuntscholen.be").set({ ...basis, actief: "ja" }));
    await assertFails(beheerder.doc("gebruikers/x@keerpuntscholen.be").set({ ...basis, vestigingen: "Gent" }));
    await assertFails(beheerder.doc("gebruikers/x@keerpuntscholen.be").set({ ...basis, dev: "ja" }));
  });
});

// --- Bootstrap-admin: noodluik ------------------------------------------------
describe("bootstrap-admin", () => {
  it("kan binnen en accounts beheren, ook zonder eigen gebruikers-doc", async () => {
    await assertSucceeds(bootstrap.doc("leerlingen/ll-gent").get());
    await assertSucceeds(
      bootstrap.doc("gebruikers/eerste@keerpuntscholen.be").set({
        email: "eerste@keerpuntscholen.be", naam: "Eerste", rol: "beheerder", actief: true, vestigingen: [],
      }),
    );
  });
});

// --- §3.10 / §3.11 — afgesloten schooljaar is alleen-lezen -------------------
describe("afgesloten schooljaar (2024-2025) — alleen-lezen", () => {
  it("lezen mag, elke schrijfvorm op evaluaties niet", async () => {
    await assertSucceeds(mentor.doc(`evaluaties/${OUD}/leerlingen/ll-gent`).get());
    await assertFails(mentor.doc(`evaluaties/${OUD}/leerlingen/ll-gent`).set({ kleuren: {} }, { merge: true }));
    await assertFails(mentor.doc(`evaluaties/${OUD}/leerlingen/ll-gent`).update({ kleuren: {} }));
    await assertFails(mentor.doc(`evaluaties/${OUD}/leerlingen/ll-gent`).delete());
    await assertFails(mentor.doc(`evaluaties/${OUD}/leerlingen/ll-nieuw`).set({ kleuren: {} }));
    await assertFails(beheerder.doc(`evaluaties/${OUD}/leerlingen/ll-gent`).update({ kleuren: {} }));
  });

  it("een deelbadge van een afgesloten jaar is niet meer te wijzigen of te verwijderen", async () => {
    await assertFails(mentor.doc("deelbadges/de-oud").update({ titel: "x" }));
    await assertFails(mentor.doc("deelbadges/de-oud").delete());
    await assertFails(mentor.doc("deelbadges/de-nieuw-oud").set({ titel: "x", schooljaar: OUD, scores: {} }));
  });

  it("het lopende schooljaar blijft gewoon schrijfbaar", async () => {
    await assertSucceeds(mentor.doc(`evaluaties/${JAAR}/leerlingen/ll-gent`).update({ kleuren: {} }));
    await assertSucceeds(mentor.doc("deelbadges/de-nu").update({ titel: "Aangepast" }));
    await assertSucceeds(
      mentor.doc("deelbadges/de-nieuw").set({ titel: "Nieuw", schooljaar: JAAR, scores: {}, vestiging: "Gent" }),
    );
  });
});

// --- Vestigingen / rubrieken = beheerder-write ------------------------------
describe("vestigingen en rubrieken — beheerder-write", () => {
  it("mentor mag niet schrijven, beheerder wel", async () => {
    await assertFails(mentor.doc("vestigingen/nieuw").set({ naam: "Nieuw", actief: true, volgorde: 1 }));
    await assertFails(mentor.doc("rubrieken/1A/cursussen/c1").set({ naam: "Cursus" }));
    await assertFails(mentor.doc("rubrieken/1A/cursussen/c1/lijst/c1-r2").set({ naam: "R2" }));
    await assertSucceeds(beheerder.doc("vestigingen/nieuw").set({ naam: "Nieuw", actief: true, volgorde: 1 }));
    await assertSucceeds(beheerder.doc("rubrieken/1A/cursussen/c1").set({ naam: "Cursus", volgorde: 0 }));
    await assertSucceeds(
      beheerder.doc("rubrieken/1A/cursussen/c1/lijst/c1-r2").set({
        naam: "R2", doelen: [], criteria: { blauw: "", groen: "", geel: "", rood: "" }, leerlijn: "", volgorde: 1,
      }),
    );
  });
});

// --- Vestiging-afscherming (leerlingen / evaluaties / deelbadges) -----------
describe("vestiging-afscherming", () => {
  it("een mentor leest enkel leerlingen van zijn eigen vestiging(en)", async () => {
    // Enkelvoudige get: eigen vestiging mag, andere niet.
    await assertSucceeds(mentor.doc("leerlingen/ll-gent").get());
    await assertFails(mentor.doc("leerlingen/ll-molenbeek").get());
    // Query: alleen binnen het eigen bereik; een bredere query wordt geweigerd.
    await assertSucceeds(mentor.collection("leerlingen").where("vestiging", "in", ["Gent"]).get());
    await assertFails(mentor.collection("leerlingen").where("vestiging", "in", ["Gent", "Molenbeek"]).get());
    await assertFails(mentor.collection("leerlingen").get());
  });

  it("een mentor met twee vestigingen ziet beide, maar geen derde", async () => {
    await assertSucceeds(
      mentor2.collection("leerlingen").where("vestiging", "in", ["Gent", "Oudenaarde"]).get(),
    );
    await assertSucceeds(mentor2.doc("leerlingen/ll-gent").get());
    await assertFails(mentor2.doc("leerlingen/ll-molenbeek").get());
  });

  it("coördinator en beheerder zien alle vestigingen (onbeperkte query)", async () => {
    await assertSucceeds(coordinator.collection("leerlingen").get());
    await assertSucceeds(beheerder.collection("leerlingen").get());
    await assertSucceeds(beheerder.doc("leerlingen/ll-molenbeek").get());
  });

  it("evaluaties volgen dezelfde afscherming (via het gedenormaliseerde vestiging-veld)", async () => {
    await assertSucceeds(mentor.doc(`evaluaties/${JAAR}/leerlingen/ll-gent`).get());
    await assertFails(mentor.doc(`evaluaties/${JAAR}/leerlingen/ll-molenbeek`).get());
    await assertSucceeds(
      mentor.collection(`evaluaties/${JAAR}/leerlingen`).where("vestiging", "in", ["Gent"]).get(),
    );
    await assertFails(mentor.collection(`evaluaties/${JAAR}/leerlingen`).get());
    // Schrijven naar een leerling buiten het bereik kan niet.
    await assertFails(
      mentor.doc(`evaluaties/${JAAR}/leerlingen/ll-molenbeek`).set({ kleuren: {}, vestiging: "Molenbeek" }, { merge: true }),
    );
  });

  it("deelbadges: mentor enkel de eigen vestiging; overkoepelende (vestiging == '') = coördinator+", async () => {
    await assertSucceeds(mentor.doc("deelbadges/de-nu").get());
    await assertFails(mentor.doc("deelbadges/de-molenbeek").get());
    await assertFails(mentor.doc("deelbadges/de-overkoepelend").get());
    await assertSucceeds(mentor.collection("deelbadges").where("vestiging", "in", ["Gent"]).get());
    await assertFails(mentor.collection("deelbadges").where("vestiging", "in", ["Gent", ""]).get());
    await assertFails(mentor.collection("deelbadges").get());
    // Coördinator/beheerder zien de overkoepelende wél.
    await assertSucceeds(coordinator.doc("deelbadges/de-overkoepelend").get());
    await assertSucceeds(coordinator.collection("deelbadges").get());
    // Een mentor kan geen overkoepelende deelbadge aanmaken (alleen coördinator/beheerder).
    await assertFails(
      mentor.doc("deelbadges/de-nieuw2").set({ titel: "x", schooljaar: JAAR, scores: {}, vestiging: "" }),
    );
  });

  it("migratie-uitzondering: het vestiging-veld mag toegevoegd worden aan een afgesloten-jaar doc", async () => {
    // Enkel het vestiging-veld erbij zetten mag (backfill), inhoud wijzigen niet.
    await assertSucceeds(
      beheerder.doc(`evaluaties/${OUD}/leerlingen/ll-nietgemigreerd`).set({ vestiging: "Gent" }, { merge: true }),
    );
    await assertFails(
      beheerder.doc(`evaluaties/${OUD}/leerlingen/ll-gent`).set({ vestiging: "Gent", kleuren: { b1: "green" } }, { merge: true }),
    );
  });
});

// --- Legacy + catch-all ----------------------------------------------------
describe("legacy-documenten en de catch-all", () => {
  it("legacy `badgeboek`/`test` zijn beheerder-only (lezen + wissen)", async () => {
    await assertFails(mentor.doc("badgeboek/_globaal").get());
    await assertSucceeds(beheerder.doc("badgeboek/_globaal").get());
    await assertSucceeds(beheerder.doc("test/oud").delete());
  });

  it("een niet-gedefinieerde collectie valt in de default-deny", async () => {
    await assertFails(beheerder.doc("willekeurig/doc").get());
    await assertFails(beheerder.doc("willekeurig/doc").set({ x: 1 }));
    await assertFails(bootstrap.doc("willekeurig/doc").set({ x: 1 }));
  });
});
