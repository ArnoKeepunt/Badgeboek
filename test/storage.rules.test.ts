/**
 * Storage-regels (`storage.rules`): de bewaarde pdf's van afgewerkte rapporten.
 *
 * Draaien: `npm run test:rules` (start de Firestore- en Storage-emulator via
 * `firebase emulators:exec`; vergt een Java-runtime).
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

type Storage = ReturnType<RulesTestContext["storage"]>;

let testEnv: RulesTestEnvironment;
let personeel: Storage;
let leerling: Storage;
let extern: Storage; // geen Keerpunt-account
let onbevestigd: Storage;
let verlopen: Storage; // laatste login > 12 uur geleden
let anoniem: Storage;

function emulatorHost(): { host: string; port: number } {
  const [host, port] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199").split(":");
  return { host, port: Number(port) };
}

const nuInSeconden = () => Math.floor(Date.now() / 1000);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
// Elke test een eigen pad: `clearStorage` wist niet betrouwbaar alles tussen de tests, en een
// bestaand bestand weigert (terecht) een nieuwe upload op hetzelfde pad.
let PAD = "";
const pdf = { contentType: "application/pdf" };
// `.put()` geeft een UploadTask (thenable, geen Promise) — `.then()` maakt er een Promise van.

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-keerpunt",
    storage: { rules: readFileSync("storage.rules", "utf8"), ...emulatorHost() },
  });
  const ctx = (uid: string, email: string, verified = true, authTime = nuInSeconden()) =>
    testEnv
      .authenticatedContext(uid, { email, email_verified: verified, auth_time: authTime })
      .storage();
  personeel = ctx("mentor", "mentor@keerpuntscholen.be");
  leerling = ctx("ll", "kristel.de.jonghe.leerling@keerpuntscholen.be");
  extern = ctx("gmail", "iemand@gmail.com");
  onbevestigd = ctx("onb", "mentor@keerpuntscholen.be", false);
  verlopen = ctx("oud", "mentor@keerpuntscholen.be", true, nuInSeconden() - 13 * 3600);
  anoniem = testEnv.unauthenticatedContext().storage();
});

afterAll(async () => {
  await testEnv?.cleanup();
});

let teller = 0;
beforeEach(async () => {
  await testEnv.clearStorage();
  PAD = `rapporten/rap${++teller}/${Date.now()}.pdf`;
});

describe("rapport-pdf's in Storage", () => {
  it("personeel bewaart een nieuwe pdf en kan ze (via de download-link) opvragen", async () => {
    await assertSucceeds(personeel.ref(PAD).put(PDF, pdf).then());
    await assertSucceeds(personeel.ref(PAD).getMetadata());
  });

  it("leerlingen, externe accounts, niet-bevestigd, verlopen sessie en anoniem: niets", async () => {
    for (const wie of [leerling, extern, onbevestigd, verlopen, anoniem]) {
      await assertFails(wie.ref(PAD).put(PDF, pdf).then());
    }
    await assertSucceeds(personeel.ref(PAD).put(PDF, pdf).then());
    for (const wie of [leerling, extern, anoniem]) {
      await assertFails(wie.ref(PAD).getMetadata());
    }
  });

  it("een bewaarde versie is niet te overschrijven of te wissen", async () => {
    await assertSucceeds(personeel.ref(PAD).put(PDF, pdf).then());
    await assertFails(personeel.ref(PAD).put(PDF, pdf).then());
    await assertFails(personeel.ref(PAD).delete());
  });

  it("enkel pdf's met een geldige naam, en oplijsten mag niet", async () => {
    await assertFails(personeel.ref("rapporten/rap1/1730000000000.pdf").put(PDF, { contentType: "text/html" }).then());
    await assertFails(personeel.ref("rapporten/rap1/iets.pdf").put(PDF, pdf).then());
    await assertFails(personeel.ref("ander/1730000000000.pdf").put(PDF, pdf).then());
    await assertFails(personeel.ref("rapporten/rap1").listAll());
  });
});
