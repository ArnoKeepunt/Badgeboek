import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

/**
 * Leerling-login via Smartschool (OAuth 2, "authorization code"), zie smartschool.be/oauth.
 *
 * 1. De app stuurt de leerling naar `https://<platform>/OAuth?client_id=…&redirect_uri=…&
 *    response_type=code&scope=userinfo&state=…`. De leerling typt zijn wachtwoord dus enkel bij
 *    Smartschool zelf — deze app ziet het nooit.
 * 2. Smartschool stuurt terug naar de redirect-URI met `?code=…&state=…`.
 * 3. `smartschoolAanmelden` ruilt die code (met het client secret, dat enkel hier leeft) voor een
 *    access token, haalt `/Api/V1/userinfo` op en zoekt de leerling op gebruikersnaam. Terug: een
 *    Firebase custom token met `{ rol: "leerling", leerlingId }`.
 *
 * Zo'n account heeft geen e-mailadres, dus de Firestore-regels (`isPersoneel()`) laten het
 * nergens binnen. Wat de leerling te zien krijgt, komt uitsluitend uit `mijnBadgeboek`: een
 * gefilterde kopie van enkel zijn eigen gegevens (geen verborgen notities, geen scores van
 * klasgenoten, enkel afgewerkte rapporten).
 *
 * Instellen (eenmalig):
 *   firebase functions:secrets:set SMARTSCHOOL_CLIENT_SECRET
 *   SMARTSCHOOL_CLIENT_ID in functions/.env (geen geheim; `firebase deploy` vraagt erom als hij
 *   ontbreekt). Het service-account van de functies heeft de rol "Service Account Token Creator"
 *   nodig om custom tokens te tekenen.
 */

const DB_ID = "ai-studio-badgeboek-af2ee9df-cd5d-4667-a2f9-b3c45c821be9";
const db = () => getFirestore(DB_ID);

const CLIENT_SECRET = defineSecret("SMARTSCHOOL_CLIENT_SECRET");
const CLIENT_ID = defineString("SMARTSCHOOL_CLIENT_ID");
const PLATFORM = defineString("SMARTSCHOOL_PLATFORM", { default: "keerpunt.smartschool.be" });
/** Moet exact overeenkomen met wat bij Smartschool geregistreerd is (en met de app). */
const REDIRECT_URI = defineString("SMARTSCHOOL_REDIRECT_URI", {
  default: "https://evaluatie.keerpuntscholen.be",
});

const OPTIES = { region: "europe-west1", timeoutSeconds: 30, memory: "256MiB" };
/**
 * Maximale sessieduur voor leerlingen/ouders: 30 dagen (elke nieuwe Smartschool-login vraagt de
 * geboortedatum). Hou gelijk met `LEERLING_MAX_SESSIE_MS` in `src/lib/inactiviteit.ts`.
 */
const LEERLING_MAX_SESSIE_S = 30 * 24 * 3600;

export const smartschoolAanmelden = onCall(
  { ...OPTIES, secrets: [CLIENT_SECRET] },
  async (request) => {
    const code = request.data?.code;
    if (typeof code !== "string" || code.length === 0 || code.length > 2000) {
      throw new HttpsError("invalid-argument", "Ongeldige aanmeldcode.");
    }

    const basis = `https://${PLATFORM.value()}`;
    const tokenAntwoord = await fetch(`${basis}/OAuth/index/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI.value(),
        client_id: CLIENT_ID.value(),
        client_secret: CLIENT_SECRET.value(),
      }),
    });
    const token = await tokenAntwoord.json().catch(() => null);
    if (!tokenAntwoord.ok || !token?.access_token) {
      // Het antwoord bevat geen geheimen (enkel foutcode + uitleg); het secret zit in ons verzoek.
      console.warn("Smartschool token mislukt:", tokenAntwoord.status, JSON.stringify(token ?? {}), {
        redirect_uri: REDIRECT_URI.value(),
      });
      throw new HttpsError("unauthenticated", "Smartschool weigerde de aanmelding.");
    }

    const infoAntwoord = await fetch(
      `${basis}/Api/V1/userinfo?access_token=${encodeURIComponent(token.access_token)}`,
    );
    const info = await infoAntwoord.json().catch(() => null);
    const gebruikersnaam = String(info?.username ?? info?.userName ?? "").trim();
    if (!infoAntwoord.ok || !gebruikersnaam) {
      // Enkel de veldnamen loggen, geen persoonsgegevens.
      console.warn("Smartschool userinfo onbruikbaar:", infoAntwoord.status, Object.keys(info ?? {}));
      throw new HttpsError("unavailable", "Smartschool gaf geen gebruikersnaam terug.");
    }

    const leerlingId = await zoekLeerling(gebruikersnaam);
    if (!leerlingId) {
      throw new HttpsError(
        "not-found",
        // Meestal personeel dat het via Smartschool probeert, of een leerling die nog niet
        // (met gebruikersnaam) geïmporteerd is.
        `"${gebruikersnaam}" is geen leerling in het badgeboek. Ben je personeel? Meld je dan ` +
          "aan via de personeelsaanmelding met je Keerpunt-account.",
      );
    }

    const firebaseToken = await getAuth().createCustomToken(`leerling:${leerlingId}`, {
      rol: "leerling",
      leerlingId,
    });
    return { token: firebaseToken };
  },
);

/**
 * De leerling-id (het interne nummer) bij een Smartschool-gebruikersnaam. Het id zelf is nooit
 * de gebruikersnaam (`isGeldigLeerlingId`: enkel cijfers) — die staat in het veld
 * `gebruikersnaam` uit de import. Zowel zoals Smartschool hem geeft als in kleine letters, voor
 * het geval de import hoofdletters bewaarde. Twee treffers = dubbel in de import → weigeren.
 */
async function zoekLeerling(gebruikersnaam) {
  const varianten = [...new Set([gebruikersnaam, gebruikersnaam.toLowerCase()])];
  const q = await db()
    .collection("leerlingen")
    .where("gebruikersnaam", "in", varianten)
    .limit(2)
    .get();
  return q.size === 1 ? q.docs[0].id : null;
}

/** De leerling-id uit het custom token, of een fout (geen leerling / sessie verlopen). */
function leerlingVan(auth) {
  const t = auth?.token;
  if (t?.rol !== "leerling" || typeof t.leerlingId !== "string") {
    throw new HttpsError("permission-denied", "Enkel voor leerlingen.");
  }
  if (Date.now() / 1000 > (t.auth_time ?? 0) + LEERLING_MAX_SESSIE_S) {
    throw new HttpsError("unauthenticated", "Je sessie is verlopen.");
  }
  return t.leerlingId;
}

/** Firestore-data → gewone JSON, zonder de schrijf-metadata. */
function schoon(data) {
  const { updatedAt: _a, updatedBy: _b, ...rest } = data;
  return rest;
}

/** Enkel de laatste kleurwijziging (wie beoordeelde), zonder de oude waarde. */
function laatsteBeoordeling(regels) {
  const kleur = (regels ?? []).filter((r) => r.veld === "kleur" && r.naar !== "");
  const r = kleur.at(-1);
  return r ? [{ op: r.op, door: r.door, doorNaam: r.doorNaam ?? "", veld: "kleur", van: "", naar: r.naar }] : [];
}

const zonderVerborgen = (n) => ({ zichtbaar: n?.zichtbaar ?? "", verborgen: "" });

/**
 * Alles wat de leerlingweergave nodig heeft, als `pad → data` (zelfde vorm als de Firestore-docs,
 * zodat de app het met `docsNaarStore` inleest), maar gefilterd tot deze ene leerling.
 */
export const mijnBadgeboek = onCall(OPTIES, async (request) => {
  const id = leerlingVan(request.auth);
  const docs = {};
  const zet = (snap, data = schoon(snap.data())) => {
    docs[snap.ref.path] = data;
  };

  const leerling = await db().doc(`leerlingen/${id}`).get();
  if (!leerling.exists) throw new HttpsError("not-found", "Leerling niet gevonden.");
  const { wachtwoord: _w, ...leerlingData } = schoon(leerling.data());
  zet(leerling, leerlingData);
  const vestiging = leerlingData.vestiging ?? "";

  const [evaluaties, deelbadges, rapporten, melding, ...algemeen] = await Promise.all([
    // Alle schooljaren: de leerling ziet ook de kleuren die binnen de graad overgenomen worden.
    // `listDocuments` geeft ook de jaar-docs die zelf niet bestaan (enkel een subcollectie).
    db()
      .collection("evaluaties")
      .listDocuments()
      .then((jaren) => Promise.all(jaren.map((j) => j.collection("leerlingen").doc(id).get()))),
    db().collection("deelbadges").where("vestiging", "in", [...new Set([vestiging, ""])]).get(),
    db().collection("rapporten").where("studentId", "==", id).get(),
    db().doc(`meldingen/${id}`).get(),
    db().doc("instellingen/app").get(),
    db().doc("instellingen/overlays").get(),
    db().collection("vestigingen").get(),
    db().collectionGroup("cursussen").get(),
    db().collectionGroup("badges").get(),
    db().collectionGroup("lijst").get(),
  ]);

  for (const e of evaluaties) {
    if (!e.exists) continue;
    const d = schoon(e.data());
    const notities = {};
    for (const [b, n] of Object.entries(d.notities ?? {})) {
      if (n?.zichtbaar) notities[b] = zonderVerborgen(n);
    }
    const auditLog = {};
    for (const [k, regels] of Object.entries(d.auditLog ?? {})) {
      const r = laatsteBeoordeling(regels);
      if (r.length) auditLog[k] = r;
    }
    zet(e, {
      kleuren: d.kleuren ?? {},
      notities,
      gewist: d.gewist ?? [],
      auditLog,
      teLaat: d.teLaat ?? {},
      vestiging,
    });
  }

  for (const s of deelbadges.docs) {
    const { scores, scoreNotities, scoreAudit, teLaat, ...def } = schoon(s.data());
    if (def.verborgenVoorLeerlingen) continue;
    const sleutel = `${def.id ?? s.id}:${id}`;
    const eigenNotitie = scoreNotities?.[id];
    const audit = laatsteBeoordeling(scoreAudit?.[sleutel]);
    zet(s, {
      ...def,
      scores: scores?.[id] ? { [id]: scores[id] } : {},
      scoreNotities: eigenNotitie?.zichtbaar ? { [id]: zonderVerborgen(eigenNotitie) } : {},
      scoreAudit: audit.length ? { [sleutel]: audit } : {},
      teLaat: teLaat?.[id] ? { [id]: true } : {},
    });
  }

  for (const r of rapporten.docs) {
    const { itemAudit: _audit, ...rapport } = schoon(r.data());
    if (rapport.status === "afgewerkt") zet(r, rapport);
  }

  if (melding.exists) zet(melding);

  const [app, overlays, vestigingen, cursussen, badges, lijst] = algemeen;
  if (app.exists) zet(app);
  if (overlays.exists) zet(overlays);
  for (const s of vestigingen.docs) zet(s);
  // `cursussen` bestaat onder zowel curriculum/ als rubrieken/; `badges`/`lijst` enkel daar.
  for (const s of [...cursussen.docs, ...badges.docs, ...lijst.docs]) {
    if (/^(curriculum|rubrieken)\//.test(s.ref.path)) zet(s);
  }
  // De stroom-markers (`curriculum/{stroom}`, `rubrieken/{stroom}`) zijn lege docs die
  // `docsNaarStore` negeert — niet nodig.

  return { docs };
});

/** De leerling opende zijn meldingen: enkel `gezienOp` van het eigen meldingen-doc. */
export const mijnMeldingenGezien = onCall(OPTIES, async (request) => {
  const id = leerlingVan(request.auth);
  await db().doc(`meldingen/${id}`).set({ gezienOp: Date.now() }, { merge: true });
  return { ok: true };
});
