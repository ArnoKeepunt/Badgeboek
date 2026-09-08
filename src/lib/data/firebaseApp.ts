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
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  setDoc,
} from "firebase/firestore";
import type { CurriculumData } from "../curriculum";

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/** Firestore-document waarin de bewerkbare badge-set leeft. */
export const CURRICULUM_DOC = ["curriculum", "actief"] as const;

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// De Firestore-database is een *named* database (bv. "ai-studio-badgeboek-…"), niet "(default)".
// Is de id niet meegegeven bij het bouwen, dan valt Firebase terug op de default database.
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

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

// CRITICAL CONSTRAINT: Test connection to Firestore upon initialization
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
void testConnection();

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
 * Schrijf de database-versie van de badges naar `curriculum/actief` (of wis ze met `null`).
 * De Firestore-regels laten dit enkel toe voor de beheerder (`isAdmin()`).
 */
export async function schrijfCurriculum(
  data: CurriculumData | null,
): Promise<void> {
  if (!auth.currentUser) throw new Error("Niet aangemeld bij Firebase.");
  const ref = doc(db, CURRICULUM_DOC[0], CURRICULUM_DOC[1]);
  try {
    if (data) {
      await setDoc(ref, {
        ...data,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser.email ?? auth.currentUser.uid,
      });
    } else {
      await deleteDoc(ref);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "curriculum/actief");
  }
}
