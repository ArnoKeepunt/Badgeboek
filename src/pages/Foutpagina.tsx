import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Foutmelding } from "../components/Foutmelding";

/**
 * Vangnet voor onverwachte fouten (route `errorElement`). Toont een vriendelijke boodschap
 * in plaats van een wit scherm, met een weg terug naar de startpagina. Het technische
 * detail staat er klein onder, handig bij het debuggen.
 */
export function Foutpagina() {
  const error = useRouteError();

  let detail: string | undefined;
  if (isRouteErrorResponse(error)) detail = `${error.status} ${error.statusText}`;
  else if (error instanceof Error) detail = error.message;

  return (
    <Foutmelding emoji="🛠️" titel="Er ging iets mis" detail={detail}>
      Er is een onverwachte fout opgetreden. Probeer de pagina te herladen. Blijft het misgaan?
      Laat het weten, dan kijken we ernaar.
    </Foutmelding>
  );
}
