import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  type DocumentData,
  type Unsubscribe,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import type { CurriculumRuw } from "../curriculum";
import { STROMEN } from "../types";
import { type DocData, type DocMap, curriculumNaarDocs } from "./firestoreLayout";
import { type Personeelslid, normaliseerGebruiker } from "../gebruikers";

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// De Firestore-database is een *named* database (bv. "ai-studio-badgeboek-…"), niet "(default)".
// `ignoreUndefinedProperties`: optionele velden (`mentorId?`, …) die niet gezet zijn worden bij
// het schrijven overgeslagen i.p.v. een fout te geven.
export const db = initializeFirestore(
  app,
  { ignoreUndefinedProperties: true },
  firebaseConfig.firestoreDatabaseId || undefined,
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const OperationType = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LIST: "list",
  GET: "get",
  WRITE: "write",
} as const;

export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  throw new Error(JSON.stringify(errInfo));
}

/** Meld aan met Google via een pop-up */
export async function meldAanMetGoogle(): Promise<User | null> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (err) {
    console.error("Fout bij aanmelden met Google:", err);
    throw err;
  }
}

/** Meld af van Firebase */
export async function meldAfVanFirebase(): Promise<void> {
  await signOut(auth);
}

/** Luister naar auth-veranderingen */
export function abonneerAuth(
  callback: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Schrijf de database-versie van de badges naar de subboom
 * `curriculum/{stroom}/cursussen/{cursus}/badges/{badge}` (of wis alles met `null`). Alleen de
 * beheerder mag dit (Firestore-regels).
 */
export async function schrijfCurriculum(ruw: CurriculumRuw | null): Promise<void> {
  if (!auth.currentUser) throw new Error("Niet aangemeld bij Firebase.");
  try {
    // Bestaande curriculum-docs ophalen (via collectionGroup) om verweesde te wissen.
    const bestaand = new Set<string>();
    for (const naam of ["cursussen", "badges"] as const) {
      const snap = await getDocs(collectionGroup(db, naam));
      snap.forEach((d) => bestaand.add(d.ref.path.replace(/^.*?\/documents\//, "")));
    }
    for (const stroom of STROMEN) bestaand.add(`curriculum/${stroom}`);

    const nieuw = ruw ? curriculumNaarDocs(ruw) : new Map<string, DocData>();
    const verwijder: string[] = [];
    for (const pad of bestaand) if (!nieuw.has(pad)) verwijder.push(pad);
    await schrijfDocMap(nieuw, verwijder);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "curriculum");
  }
}

const BATCH_MAX = 450;

/** Documentref uit een pad `a/b/c/d`. */
const refVoorPad = (pad: string) => {
  const [c, ...rest] = pad.split("/");
  return doc(db, c, ...rest);
};

/**
 * Schrijf (`merge`) en verwijder documenten in batches van ≤ 450, met `updatedAt`/`updatedBy`
 * op elk geschreven doc. Gedeeld door de persistentielaag en de migratie.
 */
export async function schrijfDocMap(schrijf: DocMap, verwijder: string[] = []): Promise<void> {
  if (!auth.currentUser) throw new Error("Niet aangemeld bij Firebase.");
  const meta = {
    updatedAt: new Date().toISOString(),
    updatedBy: auth.currentUser.email ?? auth.currentUser.uid,
  };
  const ops: Array<{ soort: "set" | "del"; pad: string; data?: DocData }> = [];
  for (const [pad, data] of schrijf) ops.push({ soort: "set", pad, data: { ...data, ...meta } });
  for (const pad of verwijder) ops.push({ soort: "del", pad });
  for (let i = 0; i < ops.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + BATCH_MAX)) {
      if (op.soort === "set") batch.set(refVoorPad(op.pad), op.data as DocData, { merge: true });
      else batch.delete(refVoorPad(op.pad));
    }
    await batch.commit();
  }
}

/** Alle docs van één collectie ophalen (voor de migratie). */
export async function leesCollectie(pad: string): Promise<Array<{ id: string; data: DocumentData }>> {
  const snap = await getDocs(collection(db, pad));
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

/** Eén document ophalen (voor de migratie). */
export async function leesDoc(...pad: string[]): Promise<DocumentData | null> {
  const [c, ...rest] = pad;
  const snap = await getDoc(doc(db, c, ...rest));
  return snap.exists() ? snap.data() : null;
}

/** Documenten verwijderen (voor de opkuis). */
export async function verwijderDocs(paden: string[][]): Promise<void> {
  const batch = writeBatch(db);
  for (const pad of paden) {
    const [c, ...rest] = pad;
    batch.delete(doc(db, c, ...rest));
  }
  await batch.commit();
}

// --- Personeelsaccounts (collectie /gebruikers, doc-id = e-mailadres) --------------------

const gebruikerRef = (email: string) => doc(db, "gebruikers", email);

/** Luister naar het `gebruikers`-doc van één e-mailadres (voor de toegangspoort + zijbalk). */
export function abonneerGebruiker(
  email: string,
  cb: (p: Personeelslid | null) => void,
): Unsubscribe {
  return onSnapshot(
    gebruikerRef(email),
    (snap) => cb(snap.exists() ? normaliseerGebruiker(snap.data()) : null),
    (err) => {
      console.warn("Firestore gebruiker snapshot melding:", err.message);
      cb(null);
    },
  );
}

/** Luister naar de volledige personeelslijst (alleen bruikbaar als beheerder). */
export function abonneerGebruikers(cb: (lijst: Personeelslid[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, "gebruikers"),
    (snap) => cb(snap.docs.map((d) => normaliseerGebruiker(d.data()))),
    (err) => console.warn("Firestore gebruikers snapshot melding:", err.message),
  );
}

/** Voeg een personeelslid toe of werk het bij (beheerder). */
export async function schrijfGebruiker(p: Personeelslid): Promise<void> {
  if (!auth.currentUser) throw new Error("Niet aangemeld bij Firebase.");
  const vestigingen = p.rol === "mentor" ? [...new Set(p.vestigingen)] : [];
  try {
    await setDoc(gebruikerRef(p.email), {
      email: p.email,
      naam: p.naam,
      rol: p.rol,
      vestigingen,
      // TODO: schrappen zodra alle clients + regels op `vestigingen` draaien. Tijdens de
      // overgang meegeschreven zodat een oude client (die nog `.vestiging` leest) blijft werken.
      vestiging: vestigingen[0] ?? "",
      actief: p.actief,
      dev: p.dev === true,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser.email ?? auth.currentUser.uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `gebruikers/${p.email}`);
  }
}

/** Verwijder een personeelslid definitief (beheerder). Deactiveren gaat via `schrijfGebruiker`. */
export async function verwijderGebruiker(email: string): Promise<void> {
  if (!auth.currentUser) throw new Error("Niet aangemeld bij Firebase.");
  try {
    await deleteDoc(gebruikerRef(email));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `gebruikers/${email}`);
  }
}
