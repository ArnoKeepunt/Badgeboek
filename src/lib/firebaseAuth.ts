import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { abonneerAuth } from "./data";

export interface FirebaseAuthState {
  gebruiker: User | null;
  /** `true` tot Firebase de bewaarde sessie hersteld heeft (eerste `onAuthStateChanged`). */
  laden: boolean;
}

/** De huidige Firebase-gebruiker + of de auth-status al bekend is. */
export function useFirebaseGebruiker(): FirebaseAuthState {
  const [state, setState] = useState<FirebaseAuthState>({ gebruiker: null, laden: true });
  useEffect(() => abonneerAuth((u) => setState({ gebruiker: u, laden: false })), []);
  return state;
}

/**
 * Een geverifieerd Keerpunt-account. Spiegelt `isSchoolStaff()` in `firestore.rules` — een
 * ander account krijgt toch geen data uit Firestore.
 */
export function isKeerpuntAccount(u: User | null): boolean {
  return Boolean(u?.emailVerified) && /@keerpuntscholen\.be$/i.test(u?.email ?? "");
}
