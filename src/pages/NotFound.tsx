import { Foutmelding } from "../components/Foutmelding";

export function NotFound() {
  return (
    <Foutmelding emoji="🧭" titel="Deze pagina bestaat niet">
      Hier is niets te vinden — de link klopt niet (meer) of je typte iets verkeerd. Geen paniek,
      er ging niets kapot.
    </Foutmelding>
  );
}
