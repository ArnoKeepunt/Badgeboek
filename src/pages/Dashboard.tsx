import { RatingBadge } from "../components/RatingBadge";
import { leerdoelen } from "../lib/curriculum";
import { telKleuren } from "../lib/kleurstats";
import { ALGEMEEN } from "../lib/periode";
import { isAfgesloten } from "../lib/schooljaar";
import { getDoelKleur, useStore } from "../lib/store";
import type { Rating } from "../lib/types";

export function Dashboard() {
  const { students, kleuren, schooljaar } = useStore();

  const telling = telKleuren(
    students.flatMap((s) =>
      leerdoelen.map((d) => getDoelKleur(kleuren, schooljaar, ALGEMEEN, s.id, d.id)),
    ),
  );
  const totaalCellen = students.length * leerdoelen.length;
  const ingevuld = totaalCellen - telling.leeg;

  const buckets: { rating: Rating | null; count: number }[] = [
    { rating: "red", count: telling.red },
    { rating: "yellow", count: telling.yellow },
    { rating: "green", count: telling.green },
    { rating: "blue", count: telling.blue },
    { rating: null, count: telling.leeg },
  ];

  return (
    <section>
      <h1>Overzicht</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Algemene kleur per badge over alle leerlingen, schooljaar <strong>{schooljaar}</strong>
        {isAfgesloten(schooljaar) ? " (afgesloten)" : ""}. Voorlopige versie — later koppelen
        aan echte data.
      </p>

      <div style={{ display: "flex", gap: 16, margin: "24px 0", flexWrap: "wrap" }}>
        <Stat label="Leerlingen" value={students.length} />
        <Stat label="Badges" value={leerdoelen.length} />
        <Stat label="Ingevuld" value={ingevuld} />
        <Stat label="Nog niet aangeboden" value={telling.leeg} />
      </div>

      <h2>Verdeling van de kleuren</h2>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {buckets.map(({ rating, count }) => (
          <div key={rating ?? "empty"} style={card}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{count}</div>
            <RatingBadge rating={rating} />
          </div>
        ))}
      </div>
    </section>
  );
}

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px 20px",
  minWidth: 140,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  alignItems: "flex-start",
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{label}</div>
    </div>
  );
}
