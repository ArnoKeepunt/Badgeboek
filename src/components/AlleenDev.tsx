import type { ReactNode } from "react";
import { useDevToegang } from "../lib/firebaseAuth";

/**
 * Routewachter voor pagina's die nog in ontwikkeling zijn: de bootstrap-beheerder (Arno),
 * iemand met de `dev`-vlag op zijn account, of local-(dev-)modus. Anderen krijgen een neutrale
 * melding, ook via een rechtstreekse URL.
 */
export function AlleenDev({ children }: { children: ReactNode }) {
  if (useDevToegang()) return <>{children}</>;
  return (
    <section>
      <p className="lege-staat">Deze pagina is nog in ontwikkeling.</p>
    </section>
  );
}
