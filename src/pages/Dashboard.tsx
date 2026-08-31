import { RatingBadge } from "../components/RatingBadge";
import { leerdoelen } from "../lib/curriculum";
import { RATINGS } from "../lib/ratings";
import { useStore } from "../lib/store";
import type { Rating } from "../lib/types";

export function Dashboard() {
  const { students, kleuren } = useStore();

  const waarden = Object.values(kleuren);
  const totaalCellen = students.length * leerdoelen.length;
  const nietAangeboden = totaalCellen - waarden.length;

  const buckets: { rating: Rating | null; count: number }[] = [
    ...RATINGS.map((rating) => ({
      rating,
      count: waarden.filter((k) => k === rating).length,
    })),
    { rating: null, count: nietAangeboden },
  ];

  return (
    <section>
      <h1>Overzicht</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Kleur per leerdoel over alle leerlingen (rood → blauw, zwak → excellent). Voorlopige
        versie — later koppelen aan echte data.
      </p>

      <div style={{ display: "flex", gap: 16, margin: "24px 0", flexWrap: "wrap" }}>
        <Stat label="Leerlingen" value={students.length} />
        <Stat label="Leerdoelen" value={leerdoelen.length} />
        <Stat label="Ingevuld" value={waarden.length} />
        <Stat label="Nog niet aangeboden" value={nietAangeboden} />
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
