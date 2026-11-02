import { type Unsubscribe, doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebaseApp";

/**
 * Een bewerkslot: "iemand typt nu in dit veld" (`bewerkSloten/{id}`). Geen echte vergrendeling
 * van de inhoud — enkel een afspraak tussen de apps zodat twee mentoren niet tegelijk hetzelfde
 * vrije tekstveld overschrijven. Vervalt vanzelf op `tot` (epoch-ms): een gecrasht of gesloten
 * tabblad houdt het veld zo nooit lang vast. Regels: zie `bewerkSloten` in `firestore.rules`.
 */
export interface BewerkSlot {
  email: string;
  naam: string;
  tot: number;
}

const slotRef = (id: string) => doc(db, "bewerkSloten", id);

export function abonneerBewerkSlot(id: string, cb: (slot: BewerkSlot | null) => void): Unsubscribe {
  return onSnapshot(
    slotRef(id),
    (snap) => cb(snap.exists() ? (snap.data() as BewerkSlot) : null),
    (err) => {
      console.warn("Firestore bewerkslot:", err.message);
      cb(null);
    },
  );
}

/**
 * Neem het slot (of verleng het eigen slot). Geeft de huidige houder terug als iemand anders het
 * nog vasthoudt, anders `null` (= het slot is nu van jou). In een transactie: twee mentoren die
 * tegelijk klikken, krijgen niet allebei het slot.
 */
export async function neemBewerkSlot(
  id: string,
  naam: string,
  duurMs: number,
): Promise<BewerkSlot | null> {
  const email = auth.currentUser?.email;
  if (!email) throw new Error("Niet aangemeld bij Firebase.");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(slotRef(id));
    const huidig = snap.exists() ? (snap.data() as BewerkSlot) : null;
    if (huidig && huidig.email !== email && huidig.tot > Date.now()) return huidig;
    tx.set(slotRef(id), { email, naam, tot: Date.now() + duurMs });
    return null;
  });
}

/** Verleng het eigen slot (hartslag zolang het veld open staat). */
export async function verlengBewerkSlot(id: string, duurMs: number): Promise<void> {
  await updateDoc(slotRef(id), { tot: Date.now() + duurMs });
}

/** Geef het eigen slot vrij. Een slot van iemand anders blijft staan. */
export async function geefBewerkSlotVrij(id: string): Promise<void> {
  const email = auth.currentUser?.email;
  if (!email) return;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(slotRef(id));
    if (snap.exists() && (snap.data() as BewerkSlot).email === email) tx.delete(slotRef(id));
  });
}
