/** Ronde voortgangsindicator: hoeveel van de badges al behaald zijn (groen of blauw). */
export function Voortgangsring({
  behaald,
  totaal,
  groot = false,
}: {
  behaald: number;
  totaal: number;
  groot?: boolean;
}) {
  const r = groot ? 58 : 30;
  const dikte = groot ? 12 : 7;
  const maat = (r + dikte) * 2 + 4;
  const mid = maat / 2;
  const omtrek = 2 * Math.PI * r;
  const deel = totaal > 0 ? Math.min(1, behaald / totaal) : 0;

  return (
    <svg
      className={`ring${groot ? " ring-groot" : ""}`}
      width={maat}
      height={maat}
      viewBox={`0 0 ${maat} ${maat}`}
      role="img"
      aria-label={`${behaald} van ${totaal} behaald`}
    >
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--border)" strokeWidth={dikte} />
      <circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke="#16a34a"
        strokeWidth={dikte}
        strokeLinecap="round"
        strokeDasharray={omtrek}
        strokeDashoffset={omtrek * (1 - deel)}
        transform={`rotate(-90 ${mid} ${mid})`}
      />
      <text x="50%" y="50%" className="ring-getal" textAnchor="middle" dominantBaseline="central">
        {behaald}
        <tspan className="ring-totaal">/{totaal}</tspan>
      </text>
    </svg>
  );
}
